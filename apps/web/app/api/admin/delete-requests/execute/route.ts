import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

type JsonObject = Record<string, unknown>;
type StorageObject = { bucket: "home-photos"; path: string };
type StoragePrefix = { bucket: "home-photos"; prefix: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedBucket = "home-photos" as const;

function jsonError(error: string, message: string, status: number, extra: JsonObject = {}) {
  return NextResponse.json({ error, message, ...extra }, { status });
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

function rpcFailure(result: ReturnType<typeof rpcResult>) {
  const blocked = result.result === "blocked";
  const notFound = result.result === "request_not_found";
  const forbidden = result.result === "operator_forbidden";
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
    blocked || mismatch ? 409 : forbidden ? 403 : notFound ? 404 : 500,
    { result }
  );
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
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;
  // Emergency/static keys may view existing admin pages, but irreversible
  // erasure always requires a currently authenticated app_admin account.
  if (auth.admin.method !== "supabase_app_admin" || !auth.admin.userId) {
    return jsonError(
      "app_admin_bearer_required",
      "完全削除は、登録済み管理者メールで再ログインして実行してください。緊急用管理キーでは実行できません。",
      403
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return jsonError("account_erasure_not_configured", "削除処理のサーバー設定がありません。", 503);
  }

  const body = asObject(await request.json().catch(() => ({})));
  const action = body.action === "preflight" ? "preflight" : body.action === "execute" ? "execute" : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!action || !uuidPattern.test(requestId) || !uuidPattern.test(targetUserId)) {
    return jsonError("invalid_erasure_identity", "削除依頼IDと利用者IDを正しく指定してください。", 400);
  }

  if (action === "execute") {
    if (process.env.ACCOUNT_ERASURE_EXECUTION_ENABLED !== "true") {
      return jsonError(
        "account_erasure_execution_disabled",
        "完全削除の安全スイッチはOFFです。担当者が環境設定と移行確認を終えるまで実行できません。",
        503
      );
    }
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
    if (confirmation !== `完全削除 ${requestId}`) {
      return jsonError(
        "exact_erasure_confirmation_required",
        "画面に表示された確認文を省略せず入力してください。",
        422
      );
    }
  }

  // A read-only safety check must not reserve/freeze the account. Only the
  // explicitly confirmed execute action creates the durable prepared job.
  const preflightRpc = action === "preflight"
    ? "inspect_account_erasure_v1"
    : "prepare_account_erasure_v1";
  const { data: preparedData, error: preparedError } = await supabase.rpc(preflightRpc, {
    p_request_id: requestId,
    p_target_user_id: targetUserId,
    p_operator_user_id: auth.admin.userId
  });
  if (preparedError) {
    return jsonError("account_erasure_preflight_failed", "削除前確認を完了できませんでした。利用中の機能は停止していません。", 500);
  }
  const prepared = rpcResult(preparedData);
  const acceptablePreflight = new Set(["ready", "database_erased", "already_completed"]);
  if (!acceptablePreflight.has(prepared.result)) return rpcFailure(prepared);

  if (action === "preflight") {
    let authState: "exists" | "absent" | "unverified" = "unverified";
    try {
      authState = await authUserExists(supabase, targetUserId) ? "exists" : "absent";
    } catch {
      authState = "unverified";
    }
    return NextResponse.json({
      checked: true,
      executionEnabled: process.env.ACCOUNT_ERASURE_EXECUTION_ENABLED === "true",
      authState,
      result: prepared
    });
  }

  if (prepared.result === "already_completed") {
    return NextResponse.json({ completed: true, idempotent: true, result: prepared });
  }

  const { data: databaseData, error: databaseError } = await supabase.rpc("execute_account_erasure_database_v1", {
    p_request_id: requestId,
    p_target_user_id: targetUserId,
    p_operator_user_id: auth.admin.userId
  });
  if (databaseError) {
    return jsonError("account_erasure_database_failed", "データベース削除を完了できませんでした。安全に停止しました。", 500);
  }
  const database = rpcResult(databaseData);
  if (!new Set(["database_erased", "already_completed"]).has(database.result)) return rpcFailure(database);
  if (database.result === "already_completed") {
    return NextResponse.json({ completed: true, idempotent: true, result: database });
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

  return NextResponse.json({
    completed: true,
    idempotent: finalized.result === "already_completed",
    verified: {
      authUserAbsent: true,
      databaseReferencesAbsent: true,
      storageObjectsAbsent: true,
      storageObjectCount: storageObjects.length,
      storagePrefixCount: storagePrefixes.length
    },
    result: finalized
  });
}
