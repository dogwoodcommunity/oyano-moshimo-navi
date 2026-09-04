import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");

class MockNextResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
  }

  static json(body, init = {}) {
    return new MockNextResponse(body, init.status ?? 200);
  }

  async json() {
    return this.body;
  }
}

function compile(sourcePath) {
  return ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  }).outputText;
}

function loadCommonJs(sourcePath, mockRequire) {
  const moduleRecord = { exports: {} };
  const load = new Function("exports", "require", "module", "__filename", "__dirname", compile(sourcePath));
  load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));
  return moduleRecord.exports;
}

const familyA = "fa000000-0000-4000-8000-000000000010";
const familyB = "fb000000-0000-4000-8000-000000000010";
const memberA = "fa000000-0000-4000-8000-000000000103";
const inviteA = "fa000000-0000-4000-8000-000000000201";
const memberships = new Set([familyA, familyB]);
const selections = [];
const rpcCalls = [];
let nextRpcError = null;

const context = {
  user: {
    async rpc(name, params) {
      rpcCalls.push({ name, params });
      return { data: nextRpcError ? null : { ok: true }, error: nextRpcError };
    }
  }
};

const familyModule = {
  async resolveFamilyContext() {
    return context;
  },
  async resolveFamilyId(_context, familyId) {
    selections.push(familyId);
    if (!memberships.has(familyId)) {
      const error = new Error("family_access_denied");
      error.code = "family_access_denied";
      throw error;
    }
    return familyId;
  },
  familySelectionErrorResponse(error) {
    return error?.code === "family_access_denied"
      ? MockNextResponse.json({ error: error.code }, { status: 403 })
      : null;
  },
  messageForRpcError(error) {
    return error?.message ?? "failed";
  },
  statusForFamilyManagementRpcError(error) {
    return /(cannot_remove_family_owner|member_has_notebook_photos)/.test(error?.message ?? "") ? 409 : 500;
  }
};

const routePath = path.join(repoRoot, "apps/web/app/api/family/manage/route.ts");
const route = loadCommonJs(routePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/family") return familyModule;
  throw new Error(`Unexpected route import: ${specifier}`);
});

function request(body) {
  return { async json() { return body; } };
}

async function expectRpc(body, name, params) {
  const previousRpcCount = rpcCalls.length;
  const response = await route.POST(request(body));
  assert.equal(response.status, 200);
  assert.equal(rpcCalls.length, previousRpcCount + 1);
  assert.deepEqual(rpcCalls.at(-1), { name, params });
}

// A user in two families must still manage the exact body familyId. There is
// no first-membership fallback and the same id reaches the atomic RPC.
await expectRpc(
  { action: "transfer-ownership", familyId: familyB, memberId: memberA },
  "transfer_family_ownership",
  { p_family_id: familyB, p_target_member_id: memberA }
);
assert.equal(selections.at(-1), familyB);

await expectRpc(
  { action: "remove-member", familyId: familyA, memberId: memberA },
  "remove_family_member",
  { p_family_id: familyA, p_member_id: memberA }
);
await expectRpc(
  { action: "leave-family", familyId: familyA },
  "leave_family",
  { p_family_id: familyA }
);
await expectRpc(
  { action: "cancel-invite", familyId: familyA, inviteId: inviteA },
  "cancel_family_invite",
  { p_family_id: familyA, p_invite_id: inviteA }
);

{
  const previousRpcCount = rpcCalls.length;
  const response = await route.POST(request({
    action: "remove-member",
    familyId: "fc000000-0000-4000-8000-000000000010",
    memberId: memberA
  }));
  assert.equal(response.status, 403, "an unjoined explicit family must be rejected before RPC");
  assert.equal(rpcCalls.length, previousRpcCount);
}

for (const body of [
  { action: "remove-member", memberId: memberA },
  { action: "remove-member", familyId: familyA },
  { action: "cancel-invite", familyId: familyA },
  { action: "unknown", familyId: familyA }
]) {
  const previousRpcCount = rpcCalls.length;
  const response = await route.POST(request(body));
  assert.equal(response.status, 400);
  assert.equal(rpcCalls.length, previousRpcCount, "invalid request must not reach an RPC");
}

for (const body of [null, "not-an-object", 42, true, []]) {
  const previousRpcCount = rpcCalls.length;
  const response = await route.POST(request(body));
  assert.equal(response.status, 400, "valid JSON primitives and arrays must be rejected as invalid requests");
  assert.equal(rpcCalls.length, previousRpcCount, "non-object JSON must not reach an RPC");
}

nextRpcError = { message: "cannot_remove_family_owner" };
{
  const response = await route.POST(request({
    action: "remove-member",
    familyId: familyA,
    memberId: memberA
  }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, "cannot_remove_family_owner");
}
nextRpcError = null;

nextRpcError = { message: "member_has_notebook_photos" };
{
  const response = await route.POST(request({
    action: "remove-member",
    familyId: familyA,
    memberId: memberA
  }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, "member_has_notebook_photos");
}
nextRpcError = null;

const component = fs.readFileSync(path.join(repoRoot, "apps/web/components/FamilyShare.tsx"), "utf8");
assert.match(component, /body: JSON\.stringify\(\{[\s\S]*?action,[\s\S]*?familyId: summary\.familyId/);
assert.match(component, /clearNotebookCloudBinding\(\)/);
assert.match(component, /window\.confirm\(/);
assert.match(component, /追加した写真が手帳に残っています/);
assert.match(component, /summary\.canManage && member\.removeBlockedReason === "notebook_photos"/);
assert.match(component, /\/home\?cloud=1#diary-history/);
for (const action of ["transfer-ownership", "remove-member", "leave-family", "cancel-invite"]) {
  assert.ok(component.includes(`\"${action}\"`), `FamilyShare must expose ${action}`);
}

const sql = fs.readFileSync(path.join(repoRoot, "supabase/family_management_rpc.sql"), "utf8");
for (const signature of [
  "transfer_family_ownership(\n  p_family_id uuid",
  "remove_family_member(\n  p_family_id uuid",
  "leave_family(p_family_id uuid)",
  "cancel_family_invite(\n  p_family_id uuid",
  "get_family_management_summary(p_family_id uuid)"
]) {
  assert.ok(sql.includes(signature), `missing explicit family scope: ${signature}`);
}
assert.equal((sql.match(/security definer/g) ?? []).length, 5);
assert.match(sql, /where family_id = p_family_id\n\s+and id = p_target_member_id/);
assert.match(sql, /where family_id = p_family_id\n\s+and id = p_member_id/);
assert.match(sql, /where family_id = p_family_id\n\s+and id = p_invite_id/);
assert.match(sql, /owner_must_transfer_before_leaving/);
assert.match(sql, /cannot_remove_family_owner/);
assert.match(sql, /member_has_notebook_photos/);
assert.match(sql, /removeBlockedReason/);
assert.match(sql, /leaveBlockedReason/);
assert.ok(
  (sql.match(/hashtextextended\('notebook-family:' \|\| p_family_id::text, 0\)/g) ?? []).length >= 4,
  "ownership transfer, member removal, and leave must use the notebook family lock order"
);
assert.ok((sql.match(/event\.event_type = 'diary'/g) ?? []).length >= 6);
assert.ok((sql.match(/from storage\.objects stored_object/g) ?? []).length >= 6);
assert.match(sql, /revoke insert, update, delete on table public\.family_members from authenticated/);

const verifyCompact = fs.readFileSync(path.join(repoRoot, "supabase/verify_compact.sql"), "utf8");
for (const check of [
  "family_management_rpc_acl",
  "family_management_rpc_security_definer",
  "family_management_summary_acl",
  "legacy_owner_promotion_client_closed",
  "family_management_direct_dml_closed",
  "family_management_dangerous_policies_absent"
]) {
  assert.ok(verifyCompact.includes(`'${check}'`), `verify_compact must include ${check}`);
}
assert.ok(
  verifyCompact.includes("'timeline_events_notebook_storage_delete_guard'"),
  "verify_compact must require the enabled family/photo race guard trigger"
);
assert.match(verifyCompact, /privilege\.grantee = 0/);

const familySqlRunner = fs.readFileSync(path.join(repoRoot, "scripts/test-family-management-sql.sh"), "utf8");
assert.match(familySqlRunner, /run_sql supabase\/notebook_diary_delete\.sql/);
assert.match(familySqlRunner, /family_management_photo_race_setup\.sql/);
assert.match(familySqlRunner, /family_management_photo_race_assert\.sql/);

for (const aclSource of [
  "supabase/family_management_rpc.sql",
  "supabase/family_owner_succession.sql",
  "supabase/production_pending_hardening.sql",
  "supabase/api_grants.sql"
]) {
  const source = fs.readFileSync(path.join(repoRoot, aclSource), "utf8");
  assert.match(source, /revoke all on function public\.promote_family_member_to_owner\(uuid\)[\s\S]*?from public, anon, authenticated, service_role/i, `${aclSource} must close the deprecated owner-promotion RPC`);
  assert.match(source, /grant execute on function public\.promote_family_member_to_owner\(uuid\) to service_role/i, `${aclSource} must retain only trusted maintenance access`);
}

const mobileData = fs.readFileSync(path.join(repoRoot, "apps/mobile/lib/mobileData.ts"), "utf8");
const legacyMobileFunction = mobileData.match(/export async function promoteFamilyMemberToOwner[\s\S]*?\n}\n/)?.[0] ?? "";
assert.doesNotMatch(legacyMobileFunction, /\.rpc\(/, "Mobile must not call the deprecated memberId-only RPC");
assert.match(legacyMobileFunction, /現在準備中です/);

const familySummaryRoute = fs.readFileSync(path.join(repoRoot, "apps/web/app/api/family/route.ts"), "utf8");
assert.match(familySummaryRoute, /context\.user\.rpc\("get_family_management_summary",\s*\{\s*p_family_id: familyId/);
assert.doesNotMatch(familySummaryRoute, /context\.service\s*\.from\(/, "summary must not fetch invite email through the service role");

const createInitial = fs.readFileSync(path.join(repoRoot, "supabase/create_initial_family_person.sql"), "utf8");
const notebookSync = fs.readFileSync(path.join(repoRoot, "supabase/notebook_atomic_sync_v2.sql"), "utf8");
for (const source of [createInitial, notebookSync]) {
  assert.match(source, /hashtextextended\('notebook-first-family:' \|\| [a-z_]+::text, 0\)/);
  assert.ok(
    source.indexOf("notebook-first-family:") < source.indexOf("insert into public.profiles")
      || source.indexOf("notebook-first-family:") < source.indexOf("insert into profiles"),
    "first-family advisory lock must be acquired before the profile upsert"
  );
}
assert.doesNotMatch(createInitial, /initial-family-person:/);

for (const inviteRpcSource of [
  "supabase/family_invite_rpc.sql",
  "supabase/admin_auth_hardening.sql",
  "supabase/free_plan_member_limit.sql"
]) {
  const source = fs.readFileSync(path.join(repoRoot, inviteRpcSource), "utf8");
  assert.equal(
    (source.match(/family-invite-capacity:/g) ?? []).length,
    2,
    `${inviteRpcSource} must serialize both invite creation and acceptance`
  );
}

console.log("family management Web API/UI and SQL contract checks: ok");
