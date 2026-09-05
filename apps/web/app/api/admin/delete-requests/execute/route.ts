import { NextResponse } from "next/server";
import { verifyAccountDeleteOperatorRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

type JsonObject = Record<string, unknown>;
type StorageObject = { bucket: "home-photos"; path: string };
type StoragePrefix = { bucket: "home-photos"; prefix: string };
type PreparedJobRow = {
  id: string;
  request_id: string;
  target_user_id: string | null;
  status: "prepared" | "blocked" | "database_erased" | "completed";
  storage_manifest_hash: string;
  prepared_at: string | null;
  prepared_expires_at: string | null;
  database_erased_at: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const manifestPattern = /^[0-9a-f]{64}$/;
const allowedBucket = "home-photos" as const;
const noStoreHeaders = { "Cache-Control": "no-store" };

function jsonError(error: string, message: string, status: number, extra: JsonObject = {}) {
  return NextResponse.json({ error, message, ...extra }, { status, headers: noStoreHeaders });
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function safeStorageObjects(value: unknown): StorageObject[] | null {
  if (!Array.isArray(value) || value.length > 5000) return null;
  const objects: StorageObject[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const row = asObject(item);
    const bucket = typeof row.bucket === "string" ? row.bucket.trim() : "";
    const path = typeof row.path === "string" ? row.path.trim() : "";
    const segments = path.split("/");
    const safePath = path.length > 0
      && path.length <= 1024
      && !path.startsWith("/")
      && !path.includes("\\")
      && !path.includes("\0")
      && segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
    if (bucket !== allowedBucket || !safePath) return null;
    const key = `${bucket}:${path}`;
    if (!seen.has(key)) {
      seen.add(key);
      objects.push({ bucket: allowedBucket, path });
    }
  }
  return objects;
}

function safeStoragePrefixes(value: unknown): StoragePrefix[] | null {
  if (!Array.isArray(value) || value.length > 5000) return null;
  const prefixes: StoragePrefix[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const row = asObject(item);
    const bucket = typeof row.bucket === "string" ? row.bucket.trim() : "";
    const prefix = typeof row.prefix === "string" ? row.prefix.trim() : "";
    if (bucket !== allowedBucket || !uuidPattern.test(prefix.slice(0, -1)) || !prefix.endsWith("/")) {
      return null;
    }
    const key = `${bucket}:${prefix}`;
    if (!seen.has(key)) {
      seen.add(key);
      prefixes.push({ bucket: allowedBucket, prefix });
    }
  }
  return prefixes;
}

function rpcResult(value: unknown): JsonObject & { result: string } {
  const row = asObject(value);
  return {
    ...row,
    result: typeof row.result === "string" ? row.result : "invalid_rpc_response"
  };
}

function clientRpcResult(result: ReturnType<typeof rpcResult>) {
  const safe: JsonObject & { result: string } = { result: result.result };
  const blockedDetails = Array.isArray(result.blockedDetails) ? result.blockedDetails : [];
  const firstBlockedCode = blockedDetails
    .map((detail) => asObject(detail).code)
    .find((code): code is string => typeof code === "string");
  const code = typeof result.code === "string" ? result.code : firstBlockedCode;
  if (code && /^[a-z0-9_]{1,80}$/.test(code)) safe.code = code;

  for (const key of ["ownedFamilyCount", "storageObjectCount", "storagePrefixCount"] as const) {
    if (typeof result[key] === "number" && Number.isSafeInteger(result[key]) && result[key] >= 0) {
      safe[key] = result[key];
    }
  }
  if (typeof result.jobId === "string" && uuidPattern.test(result.jobId)) safe.jobId = result.jobId;
  for (const key of ["completedAt", "databaseErasedAt", "expiresAt"] as const) {
    if (typeof result[key] === "string" && !Number.isNaN(Date.parse(result[key]))) {
      safe[key] = result[key];
    }
  }
  if (typeof result.reservationCreated === "boolean") {
    safe.reservationCreated = result.reservationCreated;
  }
  return safe;
}

function rpcFailure(result: ReturnType<typeof rpcResult>) {
  const blocked = result.result === "blocked";
  const notFound = result.result === "request_not_found";
  const forbidden = result.result === "operator_forbidden" || result.result === "approver_forbidden";
  const mismatch = result.result === "target_mismatch";
  const blockedDetails = Array.isArray(result.blockedDetails) ? result.blockedDetails : [];
  const blockCodes = new Set([
    typeof result.code === "string" ? result.code : "",
    ...blockedDetails.map((detail) => {
      const row = asObject(detail);
      return typeof row.code === "string" ? row.code : "";
    })
  ]);
  const message = blockCodes.has("shared_photo_transfer_required")
    ? "共有家族に残る写真の所有者引継ぎが必要です。写真を家族側へ移してから、もう一度安全確認してください。"
    : blockCodes.has("ownership_transfer_required")
      ? "共有中の家族の所有権を別の家族へ移してから、もう一度安全確認してください。"
      : blockCodes.has("storage_manifest_too_large")
        ? "削除対象の写真が安全な一括処理上限を超えています。担当者が分割手順を確認するまで完全削除を停止します。"
        : blockCodes.has("unsafe_storage_manifest")
          ? "削除対象写真の保存場所を安全に確認できないため、完全削除を停止します。"
      : result.result === "prepared_job_expired"
        ? "削除対象の確定から1時間を過ぎました。もう一度、安全確認と対象確定を行ってください。"
      : result.result === "prepared_scope_changed" || result.result === "manifest_mismatch"
        ? "確定後に削除対象が変わりました。削除は行っていません。もう一度、対象確定と別担当者の承認を行ってください。"
      : result.result === "prepared_job_required" || result.result === "prepared_identity_mismatch"
        ? "確定済みの削除対象と一致しません。削除は行っていません。"
      : result.result === "execution_grant_required"
        ? "別担当者による実行許可がないか、有効期限が切れています。削除は行っていません。"
      : result.result === "execution_control_disabled"
        ? "データベース側の1回限りの実行許可が閉じているか、有効期限が切れています。システム責任者が15分以内の実行枠を開いてから、もう一度承認してください。"
      : result.result === "grant_exceeds_execution_window"
        ? "データベース側の実行枠の残り時間が10分未満です。実行枠を閉じて開き直し、もう一度承認してください。"
      : result.result === "execution_control_already_granted"
        ? "この1回限りの実行枠は、別の削除依頼の承認に使用中です。処理を混ぜず、システム責任者が実行枠を閉じて開き直してから承認してください。"
      : result.result === "consumed_execution_grant_required"
        ? "この途中処理に対応する使用済み実行許可を確認できません。手作業で続けず、システム責任者へ連絡してください。"
      : result.result === "separate_approver_required"
        || result.result === "registered_separate_approver_required"
        ? "実行担当者とは別の、事前登録済み管理者による確認が必要です。"
      : result.result === "grant_exceeds_prepared_window"
        ? "対象確定の残り時間が短いため許可を作れません。もう一度、対象確定から行ってください。"
      : blocked
        ? "安全確認が必要なため、完全削除を停止しました。"
        : notFound
      ? "削除依頼を確認できませんでした。"
      : forbidden
        ? "削除を実行できる管理者ではありません。"
        : mismatch
          ? "削除依頼と利用者IDが一致しません。"
          : "検証済み削除処理を続行できませんでした。";
  return jsonError(
    `account_erasure_${result.result}`,
    message,
    blocked
      || mismatch
      || new Set([
        "prepared_job_expired",
        "prepared_scope_changed",
        "manifest_mismatch",
        "prepared_job_required",
        "prepared_identity_mismatch",
        "execution_grant_required",
        "execution_control_disabled",
        "consumed_execution_grant_required",
        "separate_approver_required",
        "registered_separate_approver_required",
        "grant_exceeds_prepared_window",
        "grant_exceeds_execution_window",
        "execution_control_already_granted"
      ]).has(result.result)
      ? 409
      : forbidden ? 403 : notFound ? 404 : 500,
    { result: clientRpcResult(result) }
  );
}

async function loadPreparedJob(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  requestId: string,
  targetUserId: string
) {
  const { data, error } = await supabase
    .from("account_erasure_jobs")
    .select("id, request_id, target_user_id, status, storage_manifest_hash, prepared_at, prepared_expires_at, database_erased_at")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  const job = data as PreparedJobRow | null;
  if (!job || job.target_user_id !== targetUserId || !manifestPattern.test(job.storage_manifest_hash)) {
    return null;
  }
  return {
    id: job.id,
    status: job.status,
    manifestHash: job.storage_manifest_hash,
    preparedAt: job.prepared_at,
    preparedExpiresAt: job.prepared_expires_at,
    databaseErasedAt: job.database_erased_at
  };
}

function isAuthUserNotFound(error: unknown) {
  const row = asObject(error);
  const status = typeof row.status === "number" ? row.status : 0;
  const code = typeof row.code === "string" ? row.code : "";
  const message = typeof row.message === "string" ? row.message : "";
  return status === 404 || /user[_ -]?not[_ -]?found/i.test(`${code} ${message}`);
}

async function authUserExists(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  userId: string
) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    if (isAuthUserNotFound(error)) return false;
    throw error;
  }
  return Boolean(data.user);
}

async function removeAndVerifyStorage(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  objects: StorageObject[],
  prefixes: StoragePrefix[] = []
) {
  const paths = objects.map((item) => item.path);
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await supabase.storage.from(allowedBucket).remove(paths.slice(offset, offset + 100));
    if (error) throw error;
  }

  // A legacy home-photo upload URL can exist before its object or database row.
  // Preparation freezes each home-id prefix; empty it repeatedly from offset 0
  // because deleting a page shifts all remaining objects toward the front.
  for (const item of prefixes) {
    const folder = item.prefix.slice(0, -1);
    let pageCount = 0;
    let prefixEmpty = false;
    while (pageCount < 100) {
      pageCount += 1;
      const { data, error } = await supabase.storage.from(item.bucket).list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" }
      });
      if (error) throw error;
      const page = data ?? [];
      if (page.length === 0) {
        prefixEmpty = true;
        break;
      }
      const pagePaths: string[] = [];
      for (const candidate of page) {
        if (typeof candidate.name !== "string" || candidate.name.length === 0 || candidate.name.includes("/")) {
          return false;
        }
        pagePaths.push(`${folder}/${candidate.name}`);
      }
      const { error: removeError } = await supabase.storage.from(item.bucket).remove(pagePaths);
      if (removeError) throw removeError;
    }
    if (!prefixEmpty) return false;
  }

  for (const item of objects) {
    const slash = item.path.lastIndexOf("/");
    const folder = slash >= 0 ? item.path.slice(0, slash) : "";
    const fileName = slash >= 0 ? item.path.slice(slash + 1) : item.path;
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.storage.from(item.bucket).list(folder, {
        limit: pageSize,
        offset,
        search: fileName,
        sortBy: { column: "name", order: "asc" }
      });
      if (error) throw error;
      const page = data ?? [];
      if (page.some((candidate) => candidate.name === fileName)) {
        return false;
      }
      if (page.length < pageSize) break;
    }
  }
  for (const item of prefixes) {
    const folder = item.prefix.slice(0, -1);
    const { data, error } = await supabase.storage.from(item.bucket).list(folder, {
      limit: 1,
      offset: 0,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;
    if ((data ?? []).length > 0) return false;
  }
  return true;
}

export async function POST(request: Request) {
  const auth = await verifyAccountDeleteOperatorRequest(request);
  if (!auth.ok) return auth.response;

  // This defensive gate preserves the Bearer-only deletion boundary if the
  // scoped verifier gains another method in the future. Static keys never
  // reach this route through verifyAccountDeleteOperatorRequest.
  if (
    auth.admin.method !== "supabase_app_admin"
    && auth.admin.method !== "supabase_account_delete_executor"
  ) {
    return jsonError(
      "account_delete_operator_bearer_required",
      "完全削除は、登録済みの管理者または削除担当者として再ログインして実行してください。",
      403
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return jsonError("account_erasure_not_configured", "削除処理のサーバー設定がありません。", 503);
  }

  const body = asObject(await request.json().catch(() => ({})));
  const action = typeof body.action === "string"
    && new Set(["preflight", "prepare", "approve", "grant-status", "execute"]).has(body.action)
    ? body.action as "preflight" | "prepare" | "approve" | "grant-status" | "execute"
    : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!action || !uuidPattern.test(requestId) || !uuidPattern.test(targetUserId)) {
    return jsonError("invalid_erasure_identity", "削除依頼IDと利用者IDを正しく指定してください。", 400);
  }

  if (action !== "preflight") {
    if (auth.admin.aal !== "aal2") {
      return jsonError(
        "account_erasure_aal2_required",
        "削除対象の確定・承認・実行には、多要素認証を完了したログイン（AAL2）が必要です。",
        403
      );
    }
    if (action !== "approve" && auth.admin.method !== "supabase_account_delete_executor") {
      return jsonError(
        "account_erasure_dedicated_executor_required",
        "削除対象の確定と実行は、登録済みの削除専用実行者が行ってください。",
        403
      );
    }
  }

  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
  if (action === "prepare" && confirmation !== `削除対象を確定 ${requestId}`) {
    return jsonError(
      "exact_erasure_preparation_confirmation_required",
      "画面に表示された対象確定の確認文を省略せず入力してください。",
      422
    );
  }

  const expectedJobId = typeof body.expectedJobId === "string" ? body.expectedJobId.trim() : "";
  const expectedManifestHash = typeof body.expectedManifestHash === "string"
    ? body.expectedManifestHash.trim()
    : "";
  if (
    (action === "approve" || action === "grant-status" || action === "execute")
    && (!uuidPattern.test(expectedJobId) || !manifestPattern.test(expectedManifestHash))
  ) {
    return jsonError(
      "invalid_prepared_erasure_identity",
      "確定済みjob IDとmanifest hashを正しく指定してください。",
      400
    );
  }

  if (action === "approve") {
    if (auth.admin.method !== "supabase_app_admin") {
      return jsonError(
        "account_erasure_app_admin_approval_required",
        "実行担当者とは別の登録済み管理者が承認してください。",
        403
      );
    }
    if (confirmation !== `実行許可 ${expectedJobId}`) {
      return jsonError(
        "exact_erasure_approval_confirmation_required",
        "画面に表示された実行許可の確認文を省略せず入力してください。",
        422
      );
    }
    const { data, error } = await supabase.rpc("issue_account_erasure_execution_grant_v1", {
      p_request_id: requestId,
      p_target_user_id: targetUserId,
      p_approver_user_id: auth.admin.userId,
      p_expected_job_id: expectedJobId,
      p_expected_manifest_hash: expectedManifestHash,
      p_valid_for_seconds: 600
    });
    if (error) {
      return jsonError("account_erasure_approval_failed", "実行許可を記録できませんでした。削除は行っていません。", 500);
    }
    const approval = rpcResult(data);
    if (approval.result !== "execution_grant_ready") return rpcFailure(approval);
    return NextResponse.json(
      { approved: true, result: clientRpcResult(approval) },
      { headers: noStoreHeaders }
    );
  }

  if (action === "grant-status") {
    const { data, error } = await supabase.rpc("inspect_account_erasure_execution_grant_v1", {
      p_request_id: requestId,
      p_target_user_id: targetUserId,
      p_operator_user_id: auth.admin.userId,
      p_expected_job_id: expectedJobId,
      p_expected_manifest_hash: expectedManifestHash
    });
    if (error) {
      return jsonError("account_erasure_grant_check_failed", "実行許可を確認できませんでした。削除は行っていません。", 500);
    }
    const grant = rpcResult(data);
    const grantReady = new Set(["execution_grant_ready", "database_erased_resume_allowed"]).has(grant.result);
    const databaseErasedResumeAllowed = grant.result === "database_erased_resume_allowed";
    if (!grantReady && grant.result !== "execution_grant_required") return rpcFailure(grant);
    return NextResponse.json(
      {
        checked: true,
        executionEnabled:
          databaseErasedResumeAllowed
          || (process.env.ACCOUNT_ERASURE_EXECUTION_ENABLED === "true" && auth.admin.aal === "aal2"),
        grantReady,
        result: clientRpcResult(grant)
      },
      { headers: noStoreHeaders }
    );
  }

  if (action === "execute") {
    if (process.env.ACCOUNT_ERASURE_EXECUTION_ENABLED !== "true") {
      // Once the database phase has committed, stopping here would strand a
      // partially erased account if the ordinary execution window closes.
      // Permit only the exact persisted database-erased job to reach the v2
      // RPC, which independently requires the matching consumed grant before
      // it releases the already-reviewed Storage manifest for recovery.
      let recoveryJob: Awaited<ReturnType<typeof loadPreparedJob>>;
      try {
        recoveryJob = await loadPreparedJob(supabase, requestId, targetUserId);
      } catch {
        return jsonError("account_erasure_job_lookup_failed", "途中状態を安全に確認できませんでした。", 500);
      }
      const canResumeDatabaseErasedJob = recoveryJob?.status === "database_erased"
        && recoveryJob.id === expectedJobId
        && recoveryJob.manifestHash === expectedManifestHash;
      if (!canResumeDatabaseErasedJob) {
        return jsonError(
          "account_erasure_execution_disabled",
          "完全削除の安全スイッチはOFFです。担当者が環境設定と移行確認を終えるまで実行できません。",
          503
        );
      }
    }
    if (confirmation !== `完全削除 ${requestId}`) {
      return jsonError(
        "exact_erasure_confirmation_required",
        "画面に表示された確認文を省略せず入力してください。",
        422
      );
    }
  }

  if (action === "preflight") {
    const { data, error } = await supabase.rpc("inspect_account_erasure_v2", {
      p_request_id: requestId,
      p_target_user_id: targetUserId,
      p_operator_user_id: auth.admin.userId
    });
    if (error) {
      return jsonError("account_erasure_preflight_failed", "削除前確認を完了できませんでした。利用中の機能は停止していません。", 500);
    }
    const inspected = rpcResult(data);
    if (!new Set(["ready", "database_erased", "already_completed"]).has(inspected.result)) {
      return rpcFailure(inspected);
    }
    let authState: "exists" | "absent" | "unverified" = "unverified";
    try {
      authState = await authUserExists(supabase, targetUserId) ? "exists" : "absent";
    } catch {
      authState = "unverified";
    }
    let job = null;
    if (inspected.result === "database_erased") {
      try {
        job = await loadPreparedJob(supabase, requestId, targetUserId);
      } catch {
        return jsonError("account_erasure_job_lookup_failed", "途中状態を安全に確認できませんでした。", 500);
      }
    }
    return NextResponse.json(
      {
        checked: true,
        executionEnabled:
          process.env.ACCOUNT_ERASURE_EXECUTION_ENABLED === "true" && auth.admin.aal === "aal2",
        requiresAal2: auth.admin.aal !== "aal2",
        assuranceLevel: auth.admin.aal,
        authState,
        job,
        result: clientRpcResult(inspected)
      },
      { headers: noStoreHeaders }
    );
  }

  if (action === "prepare") {
    const { data, error } = await supabase.rpc("prepare_account_erasure_v2", {
      p_request_id: requestId,
      p_target_user_id: targetUserId,
      p_operator_user_id: auth.admin.userId
    });
    if (error) {
      return jsonError("account_erasure_prepare_failed", "削除対象を確定できませんでした。削除は行っていません。", 500);
    }
    const prepared = rpcResult(data);
    if (!new Set(["ready", "database_erased", "already_completed"]).has(prepared.result)) {
      return rpcFailure(prepared);
    }
    if (prepared.result === "already_completed") {
      return NextResponse.json(
        { completed: true, idempotent: true, result: clientRpcResult(prepared) },
        { headers: noStoreHeaders }
      );
    }
    let job;
    try {
      job = await loadPreparedJob(supabase, requestId, targetUserId);
    } catch {
      return jsonError("account_erasure_job_lookup_failed", "確定した対象の証跡を確認できませんでした。削除は行っていません。", 500);
    }
    if (!job) {
      return jsonError("account_erasure_job_missing", "確定した対象の証跡がありません。削除は行っていません。", 500);
    }
    return NextResponse.json(
      {
        prepared: true,
        executionEnabled: process.env.ACCOUNT_ERASURE_EXECUTION_ENABLED === "true",
        job,
        result: clientRpcResult(prepared)
      },
      { headers: noStoreHeaders }
    );
  }

  const { data: databaseData, error: databaseError } = await supabase.rpc("execute_account_erasure_database_v2", {
    p_request_id: requestId,
    p_target_user_id: targetUserId,
    p_operator_user_id: auth.admin.userId,
    p_expected_job_id: expectedJobId,
    p_expected_manifest_hash: expectedManifestHash
  });
  if (databaseError) {
    return jsonError("account_erasure_database_failed", "データベース削除を完了できませんでした。安全に停止しました。", 500);
  }
  const database = rpcResult(databaseData);
  if (!new Set(["database_erased", "already_completed"]).has(database.result)) return rpcFailure(database);
  if (database.result === "already_completed") {
    return NextResponse.json(
      { completed: true, idempotent: true, result: clientRpcResult(database) },
      { headers: noStoreHeaders }
    );
  }

  const storageObjects = safeStorageObjects(database.storageObjects);
  const storagePrefixes = safeStoragePrefixes(database.storagePrefixes);
  if (!storageObjects || !storagePrefixes) {
    return jsonError(
      "unsafe_storage_manifest",
      "削除対象写真の場所を安全に確認できないため、Authと写真の削除前に停止しました。",
      500
    );
  }

  try {
    if (await authUserExists(supabase, targetUserId)) {
      const { error } = await supabase.auth.admin.deleteUser(targetUserId, false);
      if (error && !isAuthUserNotFound(error)) throw error;
    }
    if (await authUserExists(supabase, targetUserId)) {
      return jsonError("auth_user_still_exists", "認証アカウントの削除を確認できませんでした。再実行してください。", 502);
    }
  } catch {
    return jsonError(
      "auth_erasure_verification_failed",
      "認証アカウントの削除確認に失敗しました。依頼は完了扱いにしていません。再実行してください。",
      502
    );
  }

  let storageVerified = false;
  try {
    storageVerified = await removeAndVerifyStorage(supabase, storageObjects, storagePrefixes);
  } catch {
    return jsonError(
      "storage_erasure_verification_failed",
      "写真の削除確認に失敗しました。依頼は完了扱いにしていません。再実行してください。",
      502
    );
  }
  if (!storageVerified) {
    return jsonError(
      "storage_object_still_exists",
      "削除対象の写真が残っています。依頼は完了扱いにしていません。再実行してください。",
      502
    );
  }

  const { data: finalizedData, error: finalizedError } = await supabase.rpc("finalize_account_erasure_v1", {
    p_request_id: requestId,
    p_target_user_id: targetUserId,
    p_operator_user_id: auth.admin.userId,
    p_auth_verified_erased: true,
    p_storage_verified_erased: true,
    p_verified_storage_count: storageObjects.length + storagePrefixes.length
  });
  if (finalizedError) {
    return jsonError(
      "account_erasure_finalization_failed",
      "Auth・DB・写真は削除しましたが、完了証跡を保存できませんでした。再実行してください。",
      500
    );
  }
  const finalized = rpcResult(finalizedData);
  if (!new Set(["completed", "already_completed"]).has(finalized.result)) return rpcFailure(finalized);

  return NextResponse.json(
    {
      completed: true,
      idempotent: finalized.result === "already_completed",
      verified: {
        authUserAbsent: true,
        databaseReferencesAbsent: true,
        storageObjectsAbsent: true,
        storageObjectCount: storageObjects.length,
        storagePrefixCount: storagePrefixes.length
      },
      result: clientRpcResult(finalized)
    },
    { headers: noStoreHeaders }
  );
}
