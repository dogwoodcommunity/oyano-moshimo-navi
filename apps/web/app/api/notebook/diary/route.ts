import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type JsonRecord = Record<string, unknown>;
type StorageDeletionJob = {
  id?: unknown;
  bucket?: unknown;
  storagePath?: unknown;
  storage_bucket?: unknown;
  storage_path?: unknown;
  status?: unknown;
  attemptCount?: unknown;
  attempt_count?: unknown;
};

const notebookPhotoBucket = "home-photos";
const familyEditorRoles = new Set(["owner", "admin", "member"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/i;

function jsonError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeLocalIdentity(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 200 ? normalized : "";
}

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

function personLocalCaseId(person: { id?: unknown; profile?: unknown }) {
  const profile = asRecord(person.profile);
  return safeLocalIdentity(profile.localCaseId) || safeLocalIdentity(person.id);
}

function postgrestMessage(error: unknown) {
  const row = asRecord(error);
  return [row.message, row.details, row.hint, row.code]
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .join(" ");
}

function diaryDeleteRpcError(error: unknown) {
  const message = postgrestMessage(error);
  if (/viewer_read_only/i.test(message)) {
    return jsonError("viewer_read_only", "閲覧のみの家族は記録を削除できません。", 403);
  }
  if (/family_access_denied|storage_owner_denied/i.test(message)) {
    return jsonError("family_access_denied", "この家族の記録を削除する権限がありません。", 403);
  }
  if (/person_not_found/i.test(message)) {
    return jsonError("diary_not_found", "削除する記録を確認できませんでした。", 404);
  }
  if (/invalid_identity|invalid_storage_identity/i.test(message)) {
    return jsonError("invalid_identity", "削除する家族・対象者・記録を安全に確認できませんでした。", 400);
  }
  if (/unsupported_storage_bucket/i.test(message)) {
    return jsonError("unsupported_storage_bucket", "対応していない保存先の添付があるため、安全のため記録の削除を止めました。", 409);
  }
  if (/shared_storage_reference/i.test(message)) {
    return jsonError("shared_storage_reference", "同じ写真が別の記録でも使われているため、安全のため削除を止めました。", 409);
  }
  if (/conflict|storage_path_pending_deletion/i.test(message)) {
    return jsonError("diary_conflict", "別の端末でこの記録が更新されています。クラウドの控えを読み直してから削除してください。", 409);
  }
  return jsonError("diary_delete_failed", "記録をクラウドから削除できませんでした。もう一度お試しください。", 500);
}

function normalizeStorageJobs(value: unknown) {
  const jobs: Array<{
    id: string;
    bucket: string;
    storagePath: string;
    status: "pending" | "completed" | null;
    attemptCount: number;
  }> = [];
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  for (const rawJob of asRows<StorageDeletionJob>(value)) {
    const id = safeLocalIdentity(rawJob.id);
    const bucket = safeLocalIdentity(rawJob.bucket ?? rawJob.storage_bucket);
    const storagePath = safeLocalIdentity(rawJob.storagePath ?? rawJob.storage_path);
    const rawStatus = safeLocalIdentity(rawJob.status);
    const status = rawStatus === "pending" || rawStatus === "completed" ? rawStatus : null;
    const rawAttemptCount = rawJob.attemptCount ?? rawJob.attempt_count;
    const attemptCount = typeof rawAttemptCount === "number"
      && Number.isInteger(rawAttemptCount)
      && rawAttemptCount >= 0
      ? rawAttemptCount
      : 0;
    const segments = storagePath.split("/");
    const safePath = segments.length === 3
      && segments[0] === "notebook"
      && uuidPattern.test(segments[1] ?? "")
      && Boolean(segments[2])
      && segments[2] !== "."
      && segments[2] !== "..";
    const pathKey = `${bucket}:${storagePath}`;
    if (!uuidPattern.test(id) || bucket !== notebookPhotoBucket || !safePath
      || seenIds.has(id) || seenPaths.has(pathKey)) return null;
    seenIds.add(id);
    seenPaths.add(pathKey);
    jobs.push({ id, bucket, storagePath, status, attemptCount });
  }
  return jobs;
}

async function verifyStorageObjectAbsent(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  storageBucket: string,
  storagePath: string
): Promise<"absent" | "present" | "unknown"> {
  const pathParts = storagePath.split("/");
  const objectName = pathParts.pop() ?? "";
  const directory = pathParts.join("/");
  for (let offset = 0; offset < 10_000; offset += 100) {
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .list(directory, { limit: 100, offset, search: objectName });
    if (error || !Array.isArray(data)) return "unknown";
    if (data.some((item) => item?.name === objectName)) return "present";
    if (data.length < 100) return "absent";
  }
  return "unknown";
}

export async function DELETE(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return jsonError("not_configured", "クラウド保存の環境設定がありません。", 501);
  }

  const token = bearerToken(request);
  if (!token) {
    return jsonError("unauthorized", "ログイン確認が必要です。", 401);
  }

  const { data: authenticated, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authenticated.user) {
    return jsonError("unauthorized", "ログインを確認できませんでした。", 401);
  }

  const body = asRecord(await request.json().catch(() => ({})));
  const familyId = safeLocalIdentity(body.familyId);
  const personId = safeLocalIdentity(body.personId);
  const localCaseId = safeLocalIdentity(body.localCaseId);
  const localDiaryId = safeLocalIdentity(body.localDiaryId);
  if (!uuidPattern.test(familyId) || !uuidPattern.test(personId) || !localCaseId || !localDiaryId) {
    return jsonError("invalid_identity", "削除する家族・対象者・記録を確認できませんでした。", 400);
  }

  const expectedCloudRevision = typeof body.cloudRevision === "number"
    && Number.isInteger(body.cloudRevision)
    && body.cloudRevision >= 1
    ? body.cloudRevision
    : null;
  const expectedCloudHash = typeof body.cloudHash === "string" && sha256Pattern.test(body.cloudHash.trim())
    ? body.cloudHash.trim().toLowerCase()
    : null;
  if ((body.cloudRevision != null || body.cloudHash != null) && (!expectedCloudRevision || !expectedCloudHash)) {
    return jsonError("invalid_cloud_version", "記録のクラウド版を確認できません。クラウドの控えを読み直してください。", 409);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("user_id,role")
    .eq("family_id", familyId)
    .limit(1000);
  if (membershipError) {
    return jsonError("membership_check_failed", "家族の編集権限を確認できませんでした。", 500);
  }
  const membershipRows = asRows<{ user_id?: string | null; role?: string | null }>(memberships);
  const membership = membershipRows.find((row) => row.user_id === authenticated.user.id);
  const role = typeof membership?.role === "string" ? membership.role : "";
  if (!membership || !familyEditorRoles.has(role)) {
    return role === "viewer"
      ? jsonError("viewer_read_only", "閲覧のみの家族は記録を削除できません。", 403)
      : jsonError("family_access_denied", "この家族の記録を削除する権限がありません。", 403);
  }

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id,family_id,profile")
    .eq("id", personId)
    .eq("family_id", familyId)
    .limit(1)
    .maybeSingle();
  if (personError) {
    return jsonError("person_check_failed", "削除する対象者を確認できませんでした。", 500);
  }
  if (!person || personLocalCaseId(person) !== localCaseId) {
    return jsonError("diary_not_found", "削除する記録を確認できませんでした。", 404);
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("delete_notebook_diary_v1", {
    p_actor_user_id: authenticated.user.id,
    p_family_id: familyId,
    p_person_id: personId,
    p_local_case_id: localCaseId,
    p_local_diary_id: localDiaryId,
    p_expected_cloud_revision: expectedCloudRevision,
    p_expected_cloud_hash: expectedCloudHash
  });
  if (rpcError) return diaryDeleteRpcError(rpcError);

  const rpcResult = asRecord(rpcData);
  if (rpcResult.ok !== true || rpcResult.receiptRecorded !== true) {
    return jsonError("diary_delete_receipt_failed", "記録の削除済み情報を安全に保存できませんでした。もう一度お試しください。", 500);
  }
  const requestedJobs = normalizeStorageJobs(rpcResult.storageJobs);
  if (!requestedJobs) {
    return jsonError("invalid_storage_job", "添付写真の削除情報を安全に確認できませんでした。", 500);
  }

  // The RPC already scoped these rows transactionally. Re-read the durable,
  // service-only rows before touching Storage so a forged/malformed RPC payload
  // cannot widen deletion. Do not depend on the original uploader still being a
  // family member: the job deliberately survives member/account removal.
  let jobs = requestedJobs;
  if (requestedJobs.length > 0) {
    const { data: persistedRows, error: persistedError } = await supabase
      .from("notebook_storage_deletion_jobs")
      .select("id,storage_bucket,storage_path,status,attempt_count")
      .in("id", requestedJobs.map((job) => job.id))
      .eq("family_id", familyId)
      .eq("person_id", personId)
      .eq("local_case_id", localCaseId)
      .eq("local_diary_id", localDiaryId);
    const persistedJobs = normalizeStorageJobs(persistedRows);
    const requestedById = new Map(requestedJobs.map((job) => [job.id, job]));
    const persistedRowsMatch = persistedJobs?.length === requestedJobs.length
      && persistedJobs.every((job) => {
        const requested = requestedById.get(job.id);
        return requested
          && requested.bucket === job.bucket
          && requested.storagePath === job.storagePath
          && job.status !== null;
      });
    if (persistedError || !persistedJobs || !persistedRowsMatch) {
      return jsonError("invalid_storage_job", "添付写真の削除情報を安全に確認できませんでした。", 500);
    }
    jobs = persistedJobs.filter((job) => job.status === "pending");
  }

  let completedStorageObjects = 0;
  let pendingStorageJobs = jobs.length;
  if (jobs.length > 0) {
    const attemptedAt = new Date().toISOString();
    const recordFailure = async (job: (typeof jobs)[number], code: string) => {
      await supabase
        .from("notebook_storage_deletion_jobs")
        .update({
          attempt_count: job.attemptCount + 1,
          last_attempt_at: attemptedAt,
          last_error: code
        })
        .eq("id", job.id)
        .eq("status", "pending");
    };

    const { error: storageError } = await supabase.storage
      .from(notebookPhotoBucket)
      .remove(jobs.map((job) => job.storagePath));
    if (storageError) {
      await Promise.all(jobs.map((job) => recordFailure(job, "storage_delete_failed")));
    } else {
      for (const job of jobs) {
        const absence = await verifyStorageObjectAbsent(supabase, job.bucket, job.storagePath);
        if (absence !== "absent") {
          await recordFailure(
            job,
            absence === "present" ? "storage_delete_not_confirmed" : "storage_verify_failed"
          );
          continue;
        }

        const { data: completedJob, error: completionError } = await supabase
          .from("notebook_storage_deletion_jobs")
          .update({
            status: "completed",
            completed_at: attemptedAt,
            attempt_count: job.attemptCount + 1,
            last_attempt_at: attemptedAt,
            last_error: null
          })
          .eq("id", job.id)
          .eq("family_id", familyId)
          .eq("person_id", personId)
          .eq("local_case_id", localCaseId)
          .eq("local_diary_id", localDiaryId)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (!completionError && completedJob) {
          completedStorageObjects += 1;
          pendingStorageJobs -= 1;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    deleted: rpcResult.deleted === true,
    alreadyDeleted: rpcResult.alreadyDeleted === true,
    recoveredCleanup: rpcResult.deleted !== true && jobs.length > 0,
    deletedStorageObjects: completedStorageObjects,
    pendingStorageJobs,
    storageCleanupPending: pendingStorageJobs > 0
  });
}
