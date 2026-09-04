import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const validToken = "Abcdefghijklmnopqrstuvwxyz_12345";

class MockNextResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.headers = init.headers ?? {};
  }

  static json(body, init = {}) {
    return new MockNextResponse(body, init);
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

function loadCommonJs(relativePath, mockRequire) {
  const sourcePath = path.join(repoRoot, relativePath);
  const moduleRecord = { exports: {} };
  const load = new Function("exports", "require", "module", "__filename", "__dirname", compile(sourcePath));
  load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));
  return moduleRecord.exports;
}

const permissionHelpers = loadCommonJs("apps/web/lib/familyInvitePermissions.ts", (specifier) => {
  throw new Error(`Unexpected permission helper import: ${specifier}`);
});

const inviteSql = fs.readFileSync(path.join(repoRoot, "supabase/family_invite_rpc.sql"), "utf8");
const adminHardeningSql = fs.readFileSync(path.join(repoRoot, "supabase/admin_auth_hardening.sql"), "utf8");
const freePlanSql = fs.readFileSync(path.join(repoRoot, "supabase/free_plan_member_limit.sql"), "utf8");
const managementSql = fs.readFileSync(path.join(repoRoot, "supabase/family_management_rpc.sql"), "utf8");
assert.ok(
  inviteSql.indexOf("hashtextextended('notebook-family:' || p_family_id::text, 0)")
    < inviteSql.indexOf("select role into v_inviter_role"),
  "invite creation must serialize before re-checking the inviter role"
);
assert.match(inviteSql, /select family_id into v_family_id[\s\S]*notebook-family:[\s\S]*select \* into v_invite/,
  "invite acceptance must re-read pending state after the family lock");
assert.match(managementSql, /cancel_family_invite[\s\S]*notebook-family:/,
  "invite cancellation must share the accept family lock");
for (const [name, sql] of [
  ["family_invite_rpc.sql", inviteSql],
  ["admin_auth_hardening.sql", adminHardeningSql],
  ["free_plan_member_limit.sql", freePlanSql]
]) {
  assert.match(sql, /if v_role not in \('member', 'viewer'\) then/,
    `${name} must only create viewer/member invites`);
  assert.match(sql, /if found then\s+if v_invite\.role not in \('member', 'viewer'\)/,
    `${name} must reject a legacy reserved-role invite during deduplication`);
  assert.match(sql, /if v_invite\.role not in \('member', 'viewer'\)[\s\S]*raise exception 'invite_has_reserved_role'/,
    `${name} must only accept viewer/member invites`);
  assert.doesNotMatch(sql, /admin_invite_requires_owner/,
    `${name} must not retain a public admin-invite branch`);
  assert.ok(
    sql.indexOf("hashtextextended('notebook-family:' || p_family_id::text, 0)")
      < sql.indexOf("select role into v_inviter_role"),
    `${name} must retain the family lock before invite authorization`
  );
  assert.match(sql, /select family_id into v_family_id[\s\S]*notebook-family:[\s\S]*select \* into v_invite/,
    `${name} must retain the canonical accept lock order`);
}

assert.equal(permissionHelpers.parseFamilyInviteRole("viewer"), "viewer");
assert.equal(permissionHelpers.parseFamilyInviteRole("member"), "member");
for (const value of ["admin", "owner", "", null, undefined]) {
  assert.equal(permissionHelpers.parseFamilyInviteRole(value), null);
}
for (const role of ["owner", "admin", "viewer", "member"]) {
  assert.equal(permissionHelpers.parseFamilyMemberRole(role), role);
}
for (const value of ["app_admin", "", null, undefined]) {
  assert.equal(permissionHelpers.parseFamilyMemberRole(value), null);
}
assert.equal(permissionHelpers.isWellFormedFamilyInviteToken(validToken), true);
assert.equal(permissionHelpers.isWellFormedFamilyInviteToken("short"), false);
assert.equal(permissionHelpers.isWellFormedFamilyInviteToken(`${validToken}@`), false);

function postRequest(body) {
  return {
    headers: { get: () => null },
    async json() { return body; }
  };
}

let createRpcCalls = [];
let createRoleOverride = null;
let resolveFamilyCalls = 0;
const createContext = {
  email: "owner@example.test",
  user: {
    async rpc(name, params) {
      createRpcCalls.push({ name, params });
      return {
        data: {
          token: validToken,
          role: createRoleOverride ?? params.p_role
        },
        error: null
      };
    }
  }
};

const createRoute = loadCommonJs("apps/web/app/api/family/invite/route.ts", (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/publicRateLimit") return { checkPublicRateLimit: async () => null };
  if (specifier === "@/lib/familyInvitePermissions") return permissionHelpers;
  if (specifier === "@/lib/family") {
    return {
      familySelectionErrorResponse: () => null,
      async resolveFamilyId(_context, familyId) {
        resolveFamilyCalls += 1;
        assert.equal(familyId, "family-1");
        return familyId;
      },
      inviteUrl: (token) => `https://example.test/invite/${token}`,
      messageForRpcError: () => "rpc failed",
      resolveFamilyContext: async () => createContext
    };
  }
  throw new Error(`Unexpected invite-create import: ${specifier}`);
});

for (const role of [undefined, "", "admin", "owner", 123]) {
  createRpcCalls = [];
  resolveFamilyCalls = 0;
  const response = await createRoute.POST(postRequest({
    email: "member@example.test",
    familyId: "family-1",
    role
  }));
  assert.equal(response.status, 400, `role ${String(role)} must be rejected`);
  assert.equal(createRpcCalls.length, 0, "invalid roles must stop before the create RPC");
  assert.equal(resolveFamilyCalls, 0, "invalid roles must stop before resolving a family");
}

for (const role of ["viewer", "member"]) {
  createRpcCalls = [];
  createRoleOverride = null;
  const response = await createRoute.POST(postRequest({
    email: "member@example.test",
    relationship: "姉",
    familyId: "family-1",
    role
  }));
  assert.equal(response.status, 200);
  assert.equal(response.body.role, role);
  assert.equal(createRpcCalls.length, 1);
  assert.equal(createRpcCalls[0].name, "create_family_invite");
  assert.equal(createRpcCalls[0].params.p_role, role);
}

createRpcCalls = [];
createRoleOverride = "member";
{
  const response = await createRoute.POST(postRequest({
    email: "member@example.test",
    familyId: "family-1",
    role: "viewer"
  }));
  assert.equal(response.status, 409, "an existing invite with a different role must not be sent");
  assert.equal(response.body.error, "invite_role_conflict");
  assert.equal(response.body.url, undefined, "a conflicting invitation response must not expose its token URL");
}

let previewRow = { role: "viewer" };
let previewError = null;
let previewFromCalls = 0;
let selectedColumns = null;
const previewService = {
  from(table) {
    previewFromCalls += 1;
    assert.equal(table, "family_invites");
    const query = {
      select(columns) {
        selectedColumns = columns;
        return query;
      },
      eq() { return query; },
      gt() { return query; },
      maybeSingle() { return Promise.resolve({ data: previewRow, error: previewError }); }
    };
    return query;
  }
};

const previewRoute = loadCommonJs("apps/web/app/api/family/invite/preview/route.ts", (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/publicRateLimit") return { checkPublicRateLimit: async () => null };
  if (specifier === "@/lib/familyInvitePermissions") return permissionHelpers;
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => previewService };
  throw new Error(`Unexpected invite-preview import: ${specifier}`);
});

function previewRequest(token) {
  return {
    url: `https://example.test/api/family/invite/preview?token=${encodeURIComponent(token)}`,
    headers: { get: () => null }
  };
}

previewFromCalls = 0;
{
  const response = await previewRoute.GET(previewRequest("bad token"));
  assert.equal(response.status, 404);
  assert.equal(previewFromCalls, 0, "malformed tokens must stop before a database lookup");
}

for (const role of ["viewer", "member"]) {
  previewRow = { role };
  previewError = null;
  selectedColumns = null;
  const response = await previewRoute.GET(previewRequest(validToken));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { role });
  assert.equal(selectedColumns, "role", "preview lookup must not select email, family id, or token");
  const serialized = JSON.stringify(response.body);
  assert.doesNotMatch(serialized, /email|family|token/i);
}

for (const row of [null, { role: "admin" }, { role: "owner" }]) {
  previewRow = row;
  const response = await previewRoute.GET(previewRequest(validToken));
  assert.equal(response.status, 404, "unavailable and reserved-role invites must have the same public response");
}

let acceptPreviewRow = { role: "viewer" };
let acceptPersistedRoleOverride = null;
let acceptRpcCalls = 0;
const acceptContext = {
  service: {
    from(table) {
      assert.equal(table, "family_invites");
      const query = {
        select(columns) {
          assert.equal(columns, "role");
          return query;
        },
        eq() { return query; },
        gt() { return query; },
        maybeSingle() { return Promise.resolve({ data: acceptPreviewRow, error: null }); }
      };
      return query;
    }
  },
  user: {
    async rpc(name, params) {
      acceptRpcCalls += 1;
      assert.equal(name, "accept_family_invite");
      assert.equal(params.p_token, validToken);
      return { data: { role: acceptPersistedRoleOverride ?? acceptPreviewRow.role }, error: null };
    }
  }
};

const acceptRoute = loadCommonJs("apps/web/app/api/family/invite/accept/route.ts", (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/publicRateLimit") return { checkPublicRateLimit: async () => null };
  if (specifier === "@/lib/familyInvitePermissions") return permissionHelpers;
  if (specifier === "@/lib/family") {
    return {
      messageForRpcError: () => "accept failed",
      resolveFamilyContext: async () => acceptContext
    };
  }
  throw new Error(`Unexpected invite-accept import: ${specifier}`);
});

for (const role of ["viewer", "member"]) {
  acceptPreviewRow = { role };
  acceptPersistedRoleOverride = null;
  acceptRpcCalls = 0;
  const response = await acceptRoute.POST(postRequest({ token: validToken }));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, role });
  assert.equal(acceptRpcCalls, 1);
}

acceptPreviewRow = { role: "viewer" };
acceptPersistedRoleOverride = "admin";
acceptRpcCalls = 0;
{
  const response = await acceptRoute.POST(postRequest({ token: validToken }));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, role: "admin" },
    "accept response must report an existing administrator's persisted role");
  assert.equal(acceptRpcCalls, 1);
}

acceptPreviewRow = { role: "member" };
acceptPersistedRoleOverride = "unexpected-role";
acceptRpcCalls = 0;
{
  const response = await acceptRoute.POST(postRequest({ token: validToken }));
  assert.equal(response.status, 500, "an invalid RPC member role must fail closed");
  assert.equal(response.body.role, undefined, "invalid member roles must not fall back to the pending invite role");
  assert.equal(acceptRpcCalls, 1);
}

acceptPreviewRow = { role: "admin" };
acceptPersistedRoleOverride = null;
acceptRpcCalls = 0;
{
  const response = await acceptRoute.POST(postRequest({ token: validToken }));
  assert.equal(response.status, 400, "reserved invite roles must be rejected before acceptance");
  assert.equal(acceptRpcCalls, 0);
}

const familyShare = fs.readFileSync(path.join(repoRoot, "apps/web/components/FamilyShare.tsx"), "utf8");
const inviteAccept = fs.readFileSync(path.join(repoRoot, "apps/web/components/InviteAccept.tsx"), "utf8");
const invitePage = fs.readFileSync(path.join(repoRoot, "apps/web/app/invite/[token]/page.tsx"), "utf8");

assert.match(familyShare, /この人の権限を選ぶ（必須）/);
assert.match(familyShare, /role:\s*inviteRole/);
assert.match(familyShare, /権限：\$\{permission\.label\}/, "shared invitation text must name the permission");
assert.match(familyShare, /disabled=\{busy[^\n]+!inviteRole\}/, "invite creation must remain disabled until a role is selected");
assert.match(inviteAccept, /api\/family\/invite\/preview/);
assert.match(inviteAccept, /この招待の権限：/);
assert.match(inviteAccept, /setJoinedRole\(persistedRole\)/,
  "accepted state must retain the persisted membership role");
assert.match(inviteAccept, /phase === "joined"[\s\S]*PersistedRoleNotice/,
  "accepted state must show the persisted membership role");
assert.doesNotMatch(inviteAccept, /parseFamilyInviteRole\(data\.role\)\s*\?\?\s*inviteRole/,
  "accepted state must not mask an existing admin/owner as the pending invite role");
assert.match(invitePage, /参加前に上の欄で確認できます/);

console.log("family invite permission checks: ok");
