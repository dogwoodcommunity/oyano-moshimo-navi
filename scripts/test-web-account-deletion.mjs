import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const route = read("apps/web/app/api/account/delete-request/route.ts");
const adminRoute = read("apps/web/app/api/admin/delete-requests/route.ts");
const executeRoute = read("apps/web/app/api/admin/delete-requests/execute/route.ts");
const page = read("apps/web/app/account/delete/page.tsx");
const client = read("apps/web/components/AccountDeleteRequest.tsx");
const adminClient = read("apps/web/components/AdminDeleteRequests.tsx");
const erasureSql = read("supabase/account_deletion_pipeline.sql");
const executionGateSql = read("supabase/account_erasure_execution_gate.sql");
const legacyHomeUploadRoute = read("apps/web/app/api/storage/home-photo-upload-url/route.ts");
const layout = read("apps/web/app/layout.tsx");
const privacy = read("apps/web/app/legal/privacy/page.tsx");

assert.ok(page.includes("<AccountDeleteRequest />"), "web deletion page must render the authenticated request flow");
assert.ok(layout.includes('href="/account/delete"'), "web deletion page must be reachable from the public footer");
assert.ok(privacy.includes("Webの「アカウント・データ削除」画面"), "privacy notice must describe the web deletion path");

assert.match(route, /export async function GET\(request: Request\)/, "users must be able to read their latest deletion status");
assert.match(route, /supabase\.auth\.getUser\(token\)/, "deletion lookup and submission must validate the bearer token");
assert.match(route, /\.eq\("user_id", authenticated\.user\.id\)/, "status lookup must be scoped to the authenticated user");
assert.match(route, /from\("profiles"\)\.upsert/, "users without a notebook profile must still be able to request account deletion");
assert.ok(route.includes('requested_from: requestedFrom'), "the request must record whether it came from web or mobile");
assert.ok(route.includes("slice(0, 1000)"), "free-text reasons must be bounded");

const auditMetadata = route.match(/metadata:\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
assert.doesNotMatch(auditMetadata, /contact_email|reason/, "audit metadata must not duplicate deletion-request PII");

assert.ok(client.includes('requested_from: "web"'), "the web client must identify its request surface");
assert.ok(client.includes("削除される内容を確認し、確認欄にチェックしてください"), "cloud deletion must require explicit acknowledgement");
assert.ok(client.includes("if (!confirmLocalDelete)"), "local deletion must require a separate second action");
assert.ok(client.includes("resetLocalNotebookData()"), "the local-only deletion action must clear the notebook store");
assert.ok(client.includes("クラウドの削除依頼だけでは、このブラウザ内の手帳は消えません"), "cloud and local deletion scopes must be explained separately");
assert.match(adminRoute, /verified_account_erasure_required/, "status-only admin updates must not falsely complete an erasure request");
assert.ok(
  adminRoute.includes("item.user_id ?? erasureJob?.target_user_id"),
  "admin listing must recover the target UUID from an in-progress job after profile cascade"
);
const publicAdminRowType = adminRoute.slice(
  adminRoute.indexOf("export type AdminDeleteRequestRow"),
  adminRoute.indexOf("type AccountDeleteRequestRow")
);
assert.match(publicAdminRowType, /erasureJob\?:[\s\S]*?id: string;[\s\S]*?manifestHash: string;/, "the scoped list must restore the durable job and manifest after login or reload");
assert.match(publicAdminRowType, /storageObjectCount: number;[\s\S]*?storagePrefixCount: number;/, "the scoped list may expose reviewed counts without exposing paths");
assert.match(publicAdminRowType, /preparedAt\?: string;[\s\S]*?preparedExpiresAt\?: string;/, "the scoped list must expose the bounded preparation window");
assert.doesNotMatch(publicAdminRowType, /\bstorageObjects\b|\bstoragePrefixes\b|\bstoragePath\b/, "the browser response type must never contain raw Storage paths");
assert.match(adminRoute, /operatorMethod: auth\.admin\.method/, "the list response must identify the active narrow operator role");
assert.match(
  adminRoute,
  /includeRequestDetails = auth\.admin\.method === "supabase_app_admin"[\s\S]*?const requestColumns = includeRequestDetails[\s\S]*?: "id, user_id, status, due_at, handled_at, handled_by_method, created_at"/,
  "the deletion-only executor query must omit request contact, reason, and handling-note PII"
);
assert.match(
  adminRoute,
  /for \(let from = 0; ; from \+= openPageSize\)[\s\S]*?\.in\("status", openStatuses\)[\s\S]*?\.range\(from, from \+ openPageSize - 1\)/,
  "unfinished deletion requests must be paged exhaustively"
);
assert.match(
  adminRoute,
  /\.eq\("status", "completed"\)[\s\S]*?\.limit\(100\)/,
  "the history cap must apply only to completed requests"
);
const statusPatch = adminRoute.slice(adminRoute.indexOf("export async function PATCH"));
assert.match(statusPatch, /auth\.admin\.aal !== "aal2"/, "request status and note changes must require AAL2");
assert.match(statusPatch, /auth\.admin\.method !== "supabase_app_admin"/, "the deletion-only executor must not change request status or notes");
assert.ok(!adminClient.includes('updateStatus(item.id, "completed")'), "admin UI must not offer an unverified completion button");
assert.match(executeRoute, /verifyAccountDeleteOperatorRequest/, "irreversible erasure must use the scoped delete-operator verifier");
assert.match(executeRoute, /auth\.admin\.method !== "supabase_app_admin"/, "irreversible erasure must allow authenticated app admins");
assert.match(executeRoute, /auth\.admin\.method !== "supabase_account_delete_executor"/, "irreversible erasure must allow authenticated delete-only operators");
assert.doesNotMatch(executeRoute, /verifyAdminRequest/, "irreversible erasure must not use the generic or static-token verifier");
assert.match(executeRoute, /ACCOUNT_ERASURE_EXECUTION_ENABLED !== "true"/, "irreversible erasure must default to a disabled server-side flag");
assert.match(
  executeRoute,
  /databaseErasedResumeAllowed = grant\.result === "database_erased_resume_allowed"[\s\S]*?executionEnabled:[\s\S]*?databaseErasedResumeAllowed[\s\S]*?ACCOUNT_ERASURE_EXECUTION_ENABLED === "true"/,
  "a consumed-grant database-erased recovery must remain resumable after the ordinary execution window closes"
);
assert.match(
  executeRoute,
  /recoveryJob\?\.status === "database_erased"[\s\S]*?recoveryJob\.id === expectedJobId[\s\S]*?recoveryJob\.manifestHash === expectedManifestHash[\s\S]*?account_erasure_execution_disabled/,
  "an OFF-window execute request must be limited to the exact persisted database-erased job and manifest"
);
assert.ok(executeRoute.includes('confirmation !== `完全削除 ${requestId}`'), "operator must confirm the exact deletion request");
assert.ok(executeRoute.includes("targetUserId !== item.userId") === false, "server route must not trust a client-side row comparison");
assert.match(
  executeRoute,
  /new Set\(\["preflight", "prepare", "approve", "grant-status", "execute"\]\)/,
  "the server must recognize all five explicit erasure actions"
);
const preflightStart = executeRoute.indexOf('if (action === "preflight")');
const prepareStart = executeRoute.indexOf('if (action === "prepare") {', preflightStart + 1);
const destructiveStart = executeRoute.indexOf('const { data: databaseData');
assert.ok(preflightStart >= 0 && prepareStart > preflightStart && destructiveStart > prepareStart, "read-only inspection, durable preparation, and deletion must be separate ordered branches");
const preflightPath = executeRoute.slice(preflightStart, prepareStart);
const preparePath = executeRoute.slice(prepareStart, destructiveStart);
const destructivePath = executeRoute.slice(destructiveStart);
assert.match(preflightPath, /rpc\("inspect_account_erasure_v2"/, "preflight must use the privacy-safe read-only inspection RPC");
assert.doesNotMatch(preflightPath, /inspect_account_erasure_v1|prepare_account_erasure_v[12]|execute_account_erasure_database|deleteUser|removeAndVerifyStorage/, "preflight must neither use raw legacy responses, freeze, nor delete account data");
assert.match(preparePath, /rpc\("prepare_account_erasure_v2"/, "prepare must use the privacy-safe durable job RPC");
assert.doesNotMatch(preparePath, /execute_account_erasure_database|deleteUser|removeAndVerifyStorage/, "prepare must stop after durable evidence is returned");
assert.match(executeRoute, /rpc\("issue_account_erasure_execution_grant_v1"/, "a distinct app_admin must issue the short-lived grant");
assert.match(executeRoute, /p_approver_user_id: auth\.admin\.userId/, "the approver must be derived from the verified JWT");
assert.match(executeRoute, /rpc\("inspect_account_erasure_execution_grant_v1"/, "grant status must be independently checkable without deletion");
assert.match(executeRoute, /rpc\("execute_account_erasure_database_v2"/, "execution must use the reviewed-scope v2 RPC");
assert.doesNotMatch(executeRoute, /rpc\("execute_account_erasure_database_v1"/, "the route must not bypass the v2 gate");
assert.match(executeRoute, /function clientRpcResult[\s\S]*?const safe:[\s\S]*?result: result\.result/, "database responses must use an explicit client-safe allowlist");
assert.ok((executeRoute.match(/result: clientRpcResult\(/g) ?? []).length >= 7, "all browser-visible RPC result branches must be sanitized");
assert.doesNotMatch(executeRoute, /return jsonError\([\s\S]{0,500}?\{ result \}\s*\)/, "raw blocker details and storage paths must never be returned to the browser");
assert.doesNotMatch(destructivePath, /prepare_account_erasure_v[12]/, "execution must never replace the independently reviewed preparation");
assert.match(executeRoute, /p_expected_job_id: expectedJobId,[\s\S]*?p_expected_manifest_hash: expectedManifestHash/, "execution must pass the exact reviewed job and manifest to v2");
assert.match(executeRoute, /auth\.admin\.deleteUser\(targetUserId, false\)/, "operator route must hard-delete the Supabase Auth user");
assert.match(executeRoute, /removeAndVerifyStorage/, "operator route must remove and verify referenced photos");
assert.match(executeRoute, /for \(let offset = 0; ; offset \+= pageSize\)/, "Storage absence checks must scan every search page");
assert.match(executeRoute, /offset,\s*search: fileName/, "Storage list calls must pass their page offset");
assert.match(executeRoute, /if \(page\.length < pageSize\) break;/, "Storage absence checks must stop only after the final short page");
assert.match(executeRoute, /safeStoragePrefixes/, "legacy home-id prefixes must be validated before external deletion");
assert.match(executeRoute, /storageObjects, storagePrefixes/, "legacy home-id prefixes must be removed and verified with exact objects");
assert.match(executeRoute, /finalize_account_erasure_v1/, "only the verified finalizer may complete the request");
assert.match(executeRoute, /shared_photo_transfer_required/, "shared target-owned photos must explain the transfer blocker");
assert.ok(adminClient.includes("対象利用者の完全なIDを、表示どおり入力してください"), "admin must confirm the exact target user");
assert.ok(adminClient.includes("1. 削除前の安全確認（読み取りのみ）"), "admin UI must state that preflight is read-only");
assert.ok(adminClient.includes("2. 削除対象を確定する（まだ削除しない）"), "admin UI must separate durable preparation from deletion");
assert.ok(adminClient.includes("3. 別担当者が実行を許可"), "admin UI must require a second-person approval step");
assert.ok(adminClient.includes("別担当者として10分間だけ実行を許可"), "admin UI must disclose the short approval lifetime");
assert.match(adminClient, /operatorMethod === "supabase_account_delete_executor"[\s\S]*?2\. 削除対象を確定する/, "the app_admin view must not offer the executor's preparation control");
assert.match(adminClient, /operatorMethod === "supabase_app_admin" && isLivePreparedJob[\s\S]*?3\. 別担当者が実行を許可/, "the executor view must not offer the app_admin approval control");
assert.ok(adminClient.includes("実行担当者として許可を再確認"), "admin UI must expose a non-destructive grant-status check");
assert.ok(adminClient.includes("Auth・DB・写真を検証して完全削除"), "admin UI must label verified scope explicitly");
assert.match(adminClient, /expectedJobId,\s*expectedManifestHash/, "the client must send exact durable evidence for approval and execution");
assert.match(adminClient, /job ID[\s\S]*?manifest hash/, "the client must display both durable review identifiers");
assert.ok(adminClient.includes("写真の保存先そのものは画面に表示しません。"), "the UI must explain that raw Storage paths remain hidden");
assert.doesNotMatch(adminClient, /\bstorageObjects\b|\bstoragePrefixes\b|\bstoragePath\b/, "the browser component must not receive or render raw Storage paths");
assert.match(adminClient, /erasureChecks\[item\.id\]\?\.grantReady[\s\S]*?onClick=\{\(\) => void runErasure\(item, "execute"\)\}/, "the final deletion control must render only after a verified grant");
assert.match(adminClient, /!erasureChecks\[item\.id\]\?\.executionEnabled[\s\S]*?完全削除 \$\{item\.id\}/, "the final button must also require the deployment switch and exact phrase");
assert.match(erasureSql, /account-erasure-target:/, "storage inventory and delayed writes must share a per-target transaction lock");
assert.match(erasureSql, /create or replace function inspect_account_erasure_v1[\s\S]*?'reservationCreated', false/, "inspection must not create a durable write freeze");
assert.match(executionGateSql, /create or replace function public\.execute_account_erasure_database_v2/, "the execution-gate migration must install v2");
assert.match(executionGateSql, /p_operator_user_id = p_approver_user_id[\s\S]*?separate_approver_required/, "the grant issuer must reject self-approval");
assert.match(executionGateSql, /approval\.expires_at > clock_timestamp\(\)/, "only an unexpired grant may authorize execution");
assert.match(executionGateSql, /v_current_manifest_hash[\s\S]*?prepared_scope_changed/, "v2 must fail closed if the reviewed Storage scope changes");
assert.match(executionGateSql, /set consumed_at = v_now,[\s\S]*?consumed_by_hash = v_operator_hash/, "v2 must consume the grant in the successful database transaction");
assert.match(executionGateSql, /account_erasure_execution_control[\s\S]*?enabled_until <= opened_at \+ interval '15 minutes'/, "database execution control must be bounded to 15 minutes");
assert.match(executionGateSql, /control_epoch uuid not null/, "the approval grant must be bound to one control epoch");
assert.match(executionGateSql, /alter table account_delete_private\.account_erasure_execution_control enable row level security;[\s\S]*?force row level security;/, "the private execution control must force RLS");
assert.match(executionGateSql, /account_erasure_execution_control control[\s\S]*?set consumed_at = v_now/, "database erasure must consume its one-shot control atomically");
assert.match(executionGateSql, /revoke all on function public\.execute_account_erasure_database_v1\(uuid, uuid, uuid\)[\s\S]*?grant execute on function public\.execute_account_erasure_database_v2/, "old deployments must lose direct v1 execution authority");
assert.match(executionGateSql, /job\.status in \('database_erased', 'completed'\)[\s\S]*?job\.status = 'prepared'[\s\S]*?job\.prepared_expires_at > clock_timestamp\(\)/, "ordinary writes must be frozen only during a live preparation and permanently after erasure");
assert.match(erasureSql, /collect_account_erasure_shared_photo_blockers/, "shared target-owned photos must block erasure until transferred");
assert.match(erasureSql, /target_email_hash = null/, "completed receipts must clear the guessable email hash");
assert.match(erasureSql, /delete from public\.notebook_storage_deletion_jobs job/, "verified storage cleanup must not retain raw diary path identities");
assert.match(erasureSql, /collect_account_erasure_pending_person_cleanup_objects/, "whole-person cleanup jobs must join the account Storage manifest");
assert.match(erasureSql, /person_notebook_deletion_receipts set deleted_by = null/, "shared person deletion receipts must clear the erased actor");
assert.match(erasureSql, /person_notebook_storage_deletion_jobs set created_by = null/, "person cleanup jobs must clear the erased actor");
assert.match(erasureSql, /delete from public\.notebook_diary_deletion_receipts where family_id = any/, "owned-family diary deletion receipts must be erased");
assert.match(erasureSql, /cleanup_identity_residual_detected/, "completion must fail closed if durable cleanup identity remains");
assert.match(erasureSql, /storage_manifest_too_large/, "oversized Storage manifests must block before database erasure");
assert.match(erasureSql, /collect_account_erasure_storage_prefixes/, "legacy home-id signed uploads must be covered by a durable prefix manifest");
assert.match(erasureSql, /storage_prefix_hashes/, "completed erasure must retain only prefix hashes for delayed-upload blocking");
assert.match(legacyHomeUploadRoute, /status:\s*410/, "legacy home-photo signed upload issuance must remain retired");
assert.match(
  legacyHomeUploadRoute,
  /\/api\/notebook\/photo-upload-url/,
  "legacy home-photo callers must be directed to the attributable notebook photo flow"
);
assert.doesNotMatch(
  legacyHomeUploadRoute,
  /getServerSupabase|createSignedUploadUrl|request\.json/,
  "legacy home-photo POST must return before body, auth, database, or Storage work"
);
assert.match(
  erasureSql,
  /delete from public\.notebook_storage_deletion_jobs[\s\S]*?family_id = any\(coalesce\(\$2, '\{\}'::uuid\[\]\)\)/,
  "completed diary cleanup state for a deleted sole-owned family must be removed"
);

const storageVerifierMatch = executeRoute.match(
  /async function removeAndVerifyStorage\([\s\S]*?\n}\n\nexport async function POST/
);
assert.ok(storageVerifierMatch, "Storage verifier implementation must remain directly testable");
const executableStorageVerifier = storageVerifierMatch[0]
  .replace(
    /async function removeAndVerifyStorage\([\s\S]*?\n\)/,
    "async function removeAndVerifyStorage(supabase, objects, prefixes = [])"
  )
  .replace("const pagePaths: string[] = [];", "const pagePaths = [];")
  .replace(/\n\nexport async function POST$/, "");
const removeAndVerifyStorage = Function(
  "allowedBucket",
  `${executableStorageVerifier}\nreturn removeAndVerifyStorage;`
)("home-photos");

function storageClientWithPages(pagesByOffset) {
  const offsets = [];
  const bucket = {
    remove: async () => ({ error: null }),
    list: async (_folder, options) => {
      offsets.push(options.offset);
      return { data: pagesByOffset.get(options.offset) ?? [], error: null };
    }
  };
  return {
    offsets,
    supabase: { storage: { from: () => bucket } }
  };
}

const firstPageNearMatches = Array.from(
  { length: 100 },
  (_, index) => ({ name: `target.jpg-copy-${String(index).padStart(3, "0")}` })
);
const retainedObjectScenario = storageClientWithPages(new Map([
  [0, firstPageNearMatches],
  [100, [{ name: "target.jpg" }]]
]));
assert.equal(
  await removeAndVerifyStorage(
    retainedObjectScenario.supabase,
    [{ bucket: "home-photos", path: "folder/target.jpg" }]
  ),
  false,
  "an exact object on the second 100-result search page must block finalization"
);
assert.deepEqual(retainedObjectScenario.offsets, [0, 100], "Storage verification must fetch the second page");

const absentObjectScenario = storageClientWithPages(new Map([
  [0, firstPageNearMatches],
  [100, [{ name: "another-target.jpg-copy" }]]
]));
assert.equal(
  await removeAndVerifyStorage(
    absentObjectScenario.supabase,
    [{ bucket: "home-photos", path: "folder/target.jpg" }]
  ),
  true,
  "absence may be confirmed only after scanning the final short page"
);
assert.deepEqual(absentObjectScenario.offsets, [0, 100], "absence verification must exhaust search pages");

const legacyHomeFolder = "ac000000-0000-4000-8000-000000000040";
const removedLegacyPaths = [];
let legacyListCall = 0;
const legacyPrefixSupabase = {
  storage: {
    from: () => ({
      list: async () => {
        legacyListCall += 1;
        if (legacyListCall === 1) return { data: [{ name: "late-signed-upload.jpg" }], error: null };
        return { data: [], error: null };
      },
      remove: async (paths) => {
        removedLegacyPaths.push(...paths);
        return { error: null };
      }
    })
  }
};
assert.equal(
  await removeAndVerifyStorage(
    legacyPrefixSupabase,
    [],
    [{ bucket: "home-photos", prefix: `${legacyHomeFolder}/` }]
  ),
  true,
  "a late object under a frozen legacy home prefix must be removed and the prefix rechecked"
);
assert.deepEqual(
  removedLegacyPaths,
  [`${legacyHomeFolder}/late-signed-upload.jpg`],
  "legacy prefix cleanup must remove the exact listed path"
);
assert.equal(legacyListCall, 3, "legacy prefix cleanup must observe an empty page and verify absence again");

console.log("web account deletion tests passed");
