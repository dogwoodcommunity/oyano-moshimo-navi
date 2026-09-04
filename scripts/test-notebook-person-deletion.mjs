import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");

const routeSource = read("apps/web/app/api/notebook/person/route.ts");
const cleanupSource = read("apps/web/app/api/cron/cleanup-person-notebook-storage/route.ts");
const sqlSource = read("supabase/notebook_person_delete.sql");
const regressionSource = read("supabase/notebook_person_delete_regression.sql");
const homeSource = read("apps/web/app/home/page.tsx");
const storeSource = read("apps/web/lib/store.ts");
const vercel = JSON.parse(read("vercel.json"));

assert.match(routeSource, /export async function DELETE\(request: Request\)/);
for (const field of ["familyId", "personId", "localCaseId", "cloudRevision", "cloudHash"]) {
  assert.ok(routeSource.includes(`body.${field}`), `whole-notebook DELETE must require ${field}`);
}
assert.match(routeSource, /const allowedRoles = new Set\(\["owner", "admin"\]\)/);
assert.match(routeSource, /supabase\.rpc\("delete_person_notebook_v1"/);
assert.match(sqlSource, /create table if not exists public\.person_notebook_deletion_receipts/);
assert.match(sqlSource, /create table if not exists public\.person_notebook_storage_deletion_jobs/);
assert.doesNotMatch(sqlSource, /person_notebook_storage_deletion_jobs[\s\S]{0,500}references public\./i,
  "Storage cleanup jobs must survive deletion of parent records");
assert.match(sqlSource, /pg_advisory_xact_lock\(hashtextextended\('notebook-family:'/);
assert.match(sqlSource, /person_notebook_delete_service_role_required/);
assert.ok(
  sqlSource.indexOf("perform pg_advisory_xact_lock(hashtextextended('notebook-family:'")
    < sqlSource.indexOf("select fm.role into v_role"),
  "owner/admin role must be read only after serializing with concurrent family-role changes"
);
assert.match(sqlSource, /person_notebook_delete_unsupported_reference/);
assert.match(sqlSource, /person_notebook_delete_shared_storage_reference/);
assert.match(sqlSource, /v_person\.cloud_revision is distinct from p_expected_cloud_revision[\s\S]*v_person\.cloud_hash is distinct from p_expected_cloud_hash/);
assert.match(sqlSource, /delete from public\.cases where person_id = p_person_id/);
assert.match(sqlSource, /delete from public\.people person[\s\S]*person\.cloud_revision = p_expected_cloud_revision[\s\S]*person\.cloud_hash = p_expected_cloud_hash/);
assert.match(sqlSource, /create trigger zz_people_deleted_notebook_guard/);
assert.match(sqlSource, /create trigger timeline_events_person_notebook_storage_delete_guard/);
assert.match(sqlSource, /create trigger home_photos_person_notebook_storage_delete_guard/);
assert.match(sqlSource, /create trigger case_photos_person_notebook_storage_delete_guard/);
assert.match(regressionSource, /member unexpectedly deleted a whole notebook/);
assert.match(regressionSource, /viewer unexpectedly deleted a whole notebook/);
assert.match(regressionSource, /CAS failure changed durable state/);
assert.match(regressionSource, /same CAS deletion must be idempotent/);
assert.match(regressionSource, /authenticated claim unexpectedly called server-only person deletion/);
assert.match(cleanupSource, /verifyCron\(request\)/);
assert.match(cleanupSource, /person_notebook_storage_path_is_referenced/);
assert.match(cleanupSource, /attempt_count: job\.attemptCount \+ 1/);
assert.match(cleanupSource, /\.list\(directory, \{ limit: 100, offset, search: objectName \}\)/,
  "a successful remove must be followed by an exact object absence check");
assert.ok(vercel.crons.some((cron) => cron.path === "/api/cron/cleanup-person-notebook-storage"),
  "durable Storage jobs need a daily scheduled retry");

assert.match(homeSource, /削除する内容を確認/);
assert.match(homeSource, /この人の手帳1冊をすべて削除/);
assert.match(homeSource, /基本情報・書類や連絡先のメモ/);
assert.match(homeSource, /対象者のAI長期記憶・家族共有のAI記憶/);
assert.match(homeSource, /ほかの対象者の手帳、家族メンバー、契約情報は削除しません/);
assert.match(homeSource, /cloudMemberRole === "owner" \|\| cloudMemberRole === "admin"/);
const remoteDelete = homeSource.indexOf('fetch("/api/notebook/person"');
const localDelete = homeSource.indexOf("completePersonNotebookLocalDeletion(deletionIdentity)", remoteDelete);
assert.ok(remoteDelete >= 0 && localDelete > remoteDelete,
  "local notebook data must be removed only after confirmed cloud deletion");
assert.match(homeSource, /blockedCloudCaseSyncIdsRef\.current\.add\(caseRecord\.id\)/);
assert.match(homeSource, /preparePersonNotebookLocalDeletion\(deletionIdentity\)/);
assert.match(homeSource, /response\.status >= 400 && response\.status < 500[\s\S]*clearPendingPersonNotebookLocalDeletion/,
  "an ambiguous server failure must retain the local anti-resurrection tombstone");
assert.match(storeSource, /PERSON_NOTEBOOK_DELETION_STORAGE_KEY/);
assert.match(storeSource, /if \(!writePersonNotebookDeletionTombstones\(tombstones\)\) return \{ persisted: false, deleted: false \}/);
assert.match(storeSource, /replaceLocalNotebook[\s\S]*readPersonNotebookDeletionTombstones/);
assert.match(storeSource, /overwriteLocalNotebook[\s\S]*readPersonNotebookDeletionTombstones/);

class MockNextResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
  }
  static json(body, init = {}) { return new MockNextResponse(body, init.status ?? 200); }
  async json() { return this.body; }
}

function compile(sourcePath) {
  return ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: sourcePath
  }).outputText;
}

function loadCommonJs(sourcePath, mockRequire) {
  const moduleRecord = { exports: {} };
  const load = new Function("exports", "require", "module", "__filename", "__dirname", compile(sourcePath));
  load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));
  return moduleRecord.exports;
}

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PERSON_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "44444444-4444-4444-8444-444444444444";
const CLOUD_HASH = "a".repeat(64);

function queryResult(data, error = null) {
  const query = {
    select() { return query; },
    eq() { return query; },
    limit() { return query; },
    then(resolve, reject) { return Promise.resolve({ data, error }).then(resolve, reject); }
  };
  return query;
}

let scenario;
function resetScenario(overrides = {}) {
  scenario = {
    role: "owner",
    membership: true,
    rpcData: { ok: true, deleted: true, alreadyDeleted: false, deletedCounts: { cases: 1 }, pendingStorageJobs: 3 },
    rpcError: null,
    rpcCalls: [],
    ...overrides
  };
}

const routeSupabase = {
  auth: {
    async getUser(token) {
      return token === "valid-token"
        ? { data: { user: { id: USER_ID } }, error: null }
        : { data: { user: null }, error: new Error("invalid") };
    }
  },
  from(table) {
    assert.equal(table, "family_members");
    return queryResult(scenario.membership ? [{ user_id: USER_ID, role: scenario.role }] : []);
  },
  async rpc(name, args) {
    assert.equal(name, "delete_person_notebook_v1");
    scenario.rpcCalls.push(args);
    return { data: scenario.rpcData, error: scenario.rpcError };
  }
};

const routePath = path.join(repoRoot, "apps/web/app/api/notebook/person/route.ts");
const route = loadCommonJs(routePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => routeSupabase };
  throw new Error(`Unexpected route import: ${specifier}`);
});

function deleteRequest(overrides = {}, token = "valid-token") {
  return {
    headers: { get: (name) => name.toLowerCase() === "authorization" && token ? `Bearer ${token}` : null },
    async json() {
      return {
        familyId: FAMILY_ID,
        personId: PERSON_ID,
        localCaseId: "case-a",
        cloudRevision: 7,
        cloudHash: CLOUD_HASH,
        ...overrides
      };
    }
  };
}

for (const role of ["member", "viewer"]) {
  resetScenario({ role });
  const response = await route.DELETE(deleteRequest());
  assert.equal(response.status, 403, `${role} must not delete a whole notebook`);
  assert.equal(scenario.rpcCalls.length, 0);
}

resetScenario({ membership: false });
assert.equal((await route.DELETE(deleteRequest())).status, 403);
assert.equal(scenario.rpcCalls.length, 0);

resetScenario();
assert.equal((await route.DELETE(deleteRequest({ cloudRevision: 0 }))).status, 400);
assert.equal(scenario.rpcCalls.length, 0);

resetScenario();
{
  const response = await route.DELETE(deleteRequest());
  assert.equal(response.status, 200);
  assert.equal(response.body.pendingStorageJobs, 3);
  assert.deepEqual(scenario.rpcCalls[0], {
    p_actor_user_id: USER_ID,
    p_expected_cloud_hash: CLOUD_HASH,
    p_expected_cloud_revision: 7,
    p_family_id: FAMILY_ID,
    p_local_case_id: "case-a",
    p_person_id: PERSON_ID
  });
}

for (const [message, expectedError] of [
  ["person_notebook_delete_conflict", "person_delete_conflict"],
  ["person_notebook_delete_shared_storage_reference", "shared_storage_reference"],
  ["person_notebook_delete_unsupported_reference", "unsupported_person_reference"]
]) {
  resetScenario({ rpcData: null, rpcError: { message } });
  const response = await route.DELETE(deleteRequest());
  assert.equal(response.status, 409);
  assert.equal(response.body.error, expectedError);
}

resetScenario();
assert.equal((await route.DELETE(deleteRequest({}, ""))).status, 401);
assert.equal(scenario.rpcCalls.length, 0);

let cleanupScenario;
function cleanupQuery(table) {
  let updatePayload = null;
  const query = {
    select() { return query; },
    eq() { return query; },
    order() { return query; },
    limit() { return query; },
    update(value) { updatePayload = value; cleanupScenario.operations.push("receipt"); return query; },
    maybeSingle() {
      cleanupScenario.updates.push(updatePayload);
      return Promise.resolve({ data: cleanupScenario.receiptError ? null : { id: JOB_ID }, error: cleanupScenario.receiptError });
    },
    then(resolve, reject) {
      if (updatePayload) cleanupScenario.updates.push(updatePayload);
      return Promise.resolve({ data: updatePayload ? null : cleanupScenario.jobs, error: null }).then(resolve, reject);
    }
  };
  assert.equal(table, "person_notebook_storage_deletion_jobs");
  return query;
}

const cleanupSupabase = {
  from: cleanupQuery,
  async rpc(name) {
    assert.equal(name, "person_notebook_storage_path_is_referenced");
    cleanupScenario.operations.push("reference");
    return { data: cleanupScenario.referenced, error: cleanupScenario.referenceError };
  },
  storage: {
    from(bucket) {
      assert.equal(bucket, "home-photos");
      return {
        async remove(paths) {
          cleanupScenario.operations.push("storage");
          cleanupScenario.paths.push(...paths);
          return { data: null, error: cleanupScenario.storageError };
        },
        async list() {
          cleanupScenario.operations.push("verify");
          return { data: cleanupScenario.listed, error: cleanupScenario.listError };
        }
      };
    }
  }
};

const cleanupPath = path.join(repoRoot, "apps/web/app/api/cron/cleanup-person-notebook-storage/route.ts");
const cleanupRoute = loadCommonJs(cleanupPath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/cronAuth") return { verifyCron: () => null };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => cleanupSupabase };
  throw new Error(`Unexpected cleanup import: ${specifier}`);
});

const cleanupJob = {
  id: JOB_ID,
  storage_bucket: "home-photos",
  storage_path: `notebook/${USER_ID}/photo.jpg`,
  attempt_count: 2
};
function resetCleanup(overrides = {}) {
  cleanupScenario = {
    jobs: [cleanupJob],
    referenced: false,
    referenceError: null,
    storageError: null,
    listed: [],
    listError: null,
    receiptError: null,
    operations: [],
    updates: [],
    paths: [],
    ...overrides
  };
}

resetCleanup();
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 200);
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "verify", "receipt"]);
  assert.equal(response.body.completed, 1);
}

resetCleanup({ storageError: new Error("temporary outage") });
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 500);
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "receipt"]);
  assert.equal(cleanupScenario.updates[0].last_error, "storage_delete_failed");
  assert.equal(cleanupScenario.updates[0].attempt_count, 3);
}

resetCleanup({ listed: [{ name: "photo.jpg" }] });
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 500, "a remove response must not complete a job while the exact object remains");
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "verify", "receipt"]);
  assert.equal(cleanupScenario.updates[0].last_error, "storage_delete_not_confirmed");
}

resetCleanup({ referenced: true });
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 500);
  assert.deepEqual(cleanupScenario.operations, ["reference", "receipt"]);
  assert.equal(cleanupScenario.paths.length, 0);
  assert.equal(cleanupScenario.updates[0].last_error, "storage_path_still_referenced");
}

console.log("whole-person notebook deletion tests passed");
