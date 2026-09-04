import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type JsonRecord = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/i;
const allowedRoles = new Set(["owner", "admin"]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function safeIdentity(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 200 ? normalized : "";
}

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

function jsonError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

function databaseMessage(error: unknown) {
  const row = asRecord(error);
  return [row.message, row.details, row.hint, row.code]
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .join(" ");
}

function deleteRpcError(error: unknown) {
  const message = databaseMessage(error);
  if (/owner_admin_required/i.test(message)) {
    return jsonError("owner_admin_required", "この人の手帳全体を削除できるのは、家族の所有者または管理者だけです。", 403);
  }
  if (/family_access_denied/i.test(message)) {
    return jsonError("family_access_denied", "この家族の手帳を削除する権限がありません。", 403);
  }
  if (/person_not_found/i.test(message)) {
    return jsonError("person_not_found", "削除する対象者を確認できませんでした。", 404);
  }
  if (/invalid_identity/i.test(message)) {
    return jsonError("invalid_identity", "削除する家族・対象者・クラウド版を安全に確認できませんでした。", 400);
  }
  if (/shared_storage_reference/i.test(message)) {
    return jsonError("shared_storage_reference", "同じ写真が別の手帳や記録でも使われています。誤削除を避けるため、手帳の削除を止めました。", 409);
  }
  if (/unsupported_storage|storage_owner_denied|storage_job_conflict/i.test(message)) {
    return jsonError("unsafe_storage_reference", "写真の保存先をこの手帳だけのものと確認できませんでした。手帳は削除していません。", 409);
  }
  if (/unsupported_reference/i.test(message)) {
    return jsonError("unsupported_person_reference", "対象者を参照する未確認データがあるため、安全のため削除を止めました。", 409);
  }
  if (/conflict|deleted_identity|pending_deletion/i.test(message)) {
    return jsonError("person_delete_conflict", "別の端末で手帳が更新されています。クラウドの控えを読み直してから削除してください。", 409);
  }
  return jsonError("person_delete_failed", "この人の手帳を削除できませんでした。端末の内容は削除していません。", 500);
}

export async function DELETE(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) return jsonError("not_configured", "クラウド保存の環境設定がありません。", 501);

  const token = bearerToken(request);
  if (!token) return jsonError("unauthorized", "ログイン確認が必要です。", 401);
  const { data: authenticated, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authenticated.user) return jsonError("unauthorized", "ログインを確認できませんでした。", 401);

  const body = asRecord(await request.json().catch(() => ({})));
  const familyId = safeIdentity(body.familyId);
  const personId = safeIdentity(body.personId);
  const localCaseId = safeIdentity(body.localCaseId);
  const cloudRevision = typeof body.cloudRevision === "number"
    && Number.isInteger(body.cloudRevision)
    && body.cloudRevision >= 1
    ? body.cloudRevision
    : null;
  const cloudHash = typeof body.cloudHash === "string" && sha256Pattern.test(body.cloudHash.trim())
    ? body.cloudHash.trim().toLowerCase()
    : null;
  if (!uuidPattern.test(familyId) || !uuidPattern.test(personId) || !localCaseId || !cloudRevision || !cloudHash) {
    return jsonError("invalid_identity", "削除する家族・対象者・クラウド版を確認できません。クラウドの控えを読み直してください。", 400);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("user_id,role")
    .eq("family_id", familyId)
    .limit(1000);
  if (membershipError) return jsonError("membership_check_failed", "家族の管理権限を確認できませんでした。", 500);
  const membership = (Array.isArray(memberships) ? memberships : [])
    .find((row) => row?.user_id === authenticated.user.id);
  const role = typeof membership?.role === "string" ? membership.role : "";
  if (!allowedRoles.has(role)) {
    return jsonError(
      role === "member" || role === "viewer" ? "owner_admin_required" : "family_access_denied",
      role === "member" || role === "viewer"
        ? "この人の手帳全体を削除できるのは、家族の所有者または管理者だけです。"
        : "この家族の手帳を削除する権限がありません。",
      403
    );
  }

  const { data, error } = await supabase.rpc("delete_person_notebook_v1", {
    p_actor_user_id: authenticated.user.id,
    p_expected_cloud_hash: cloudHash,
    p_expected_cloud_revision: cloudRevision,
    p_family_id: familyId,
    p_local_case_id: localCaseId,
    p_person_id: personId
  });
  if (error) return deleteRpcError(error);

  const result = asRecord(data);
  if (result.ok !== true || (result.deleted !== true && result.alreadyDeleted !== true)) {
    return jsonError("invalid_delete_receipt", "削除完了を安全に確認できませんでした。端末の内容は削除していません。", 500);
  }
  const pendingStorageJobs = typeof result.pendingStorageJobs === "number"
    && Number.isInteger(result.pendingStorageJobs)
    && result.pendingStorageJobs >= 0
    ? result.pendingStorageJobs
    : 0;

  return NextResponse.json({
    ok: true,
    deleted: result.deleted === true,
    alreadyDeleted: result.alreadyDeleted === true,
    deletedCounts: asRecord(result.deletedCounts),
    pendingStorageJobs
  });
}
