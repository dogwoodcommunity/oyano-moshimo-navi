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
assert.ok(!adminClient.includes('updateStatus(item.id, "completed")'), "admin UI must not offer an unverified completion button");
assert.match(executeRoute, /verifyAccountDeleteOperatorRequest/, "irreversible erasure must use the scoped delete-operator verifier");
assert.match(executeRoute, /auth\.admin\.method !== "supabase_app_admin"/, "irreversible erasure must allow authenticated app admins");
assert.match(executeRoute, /auth\.admin\.method !== "supabase_account_delete_executor"/, "irreversible erasure must allow authenticated delete-only operators");
assert.doesNotMatch(executeRoute, /verifyAdminRequest/, "irreversible erasure must not use the generic or static-token verifier");
assert.match(executeRoute, /ACCOUNT_ERASURE_EXECUTION_ENABLED !== "true"/, "irreversible erasure must default to a disabled server-side flag");
assert.ok(executeRoute.includes('confirmation !== `完全削除 ${requestId}`'), "operator must confirm the exact deletion request");
assert.ok(executeRoute.includes("targetUserId !== item.userId") === false, "server route must not trust a client-side row comparison");
assert.match(executeRoute, /action === "preflight"\s*\? "inspect_account_erasure_v1"/, "preflight must use the read-only inspection RPC");
assert.match(executeRoute, /prepare_account_erasure_v1/, "operator route must run the database preflight");
assert.match(executeRoute, /execute_account_erasure_database_v1/, "operator route must use the transactional database erasure RPC");
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
assert.ok(adminClient.includes("削除前の安全確認"), "admin UI must expose preflight before irreversible execution");
assert.ok(adminClient.includes("Auth・DB・写真を検証して完全削除"), "admin UI must label verified scope explicitly");
assert.match(erasureSql, /account-erasure-target:/, "storage inventory and delayed writes must share a per-target transaction lock");
assert.match(erasureSql, /create or replace function inspect_account_erasure_v1[\s\S]*?'reservationCreated', false/, "inspection must not create a durable write freeze");
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
