import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");

const routeSource = read("apps/web/app/api/notebook/diary/route.ts");
const homeSource = read("apps/web/app/home/page.tsx");
const storeSource = read("apps/web/lib/store.ts");
const sqlSource = read("supabase/notebook_diary_delete.sql");
const sqlRegressionSource = read("supabase/notebook_diary_delete_regression.sql");
const cleanupRouteSource = read("apps/web/app/api/cron/cleanup-notebook-storage/route.ts");
const vercelSource = read("vercel.json");

assert.match(routeSource, /export async function DELETE\(request: Request\)/, "cloud diary deletion needs an authenticated DELETE endpoint");
for (const identity of ["familyId", "personId", "localCaseId", "localDiaryId"]) {
  assert.ok(routeSource.includes(`body.${identity}`), `cloud deletion must require explicit ${identity}`);
}
assert.match(routeSource, /familyEditorRoles\.has\(role\)/, "viewer access must not authorize deletion");
assert.ok(routeSource.includes('supabase.rpc("delete_notebook_diary_v1"'), "the API must use the transactional delete contract");
assert.ok(routeSource.includes('from("notebook_storage_deletion_jobs")'), "Storage cleanup must leave a durable completion receipt");
assert.match(routeSource, /rpcResult\.ok !== true \|\| rpcResult\.receiptRecorded !== true/,
  "the API must never authorize local deletion without an explicit durable server receipt");
assert.match(routeSource, /\.list\(directory, \{ limit: 100, offset, search: objectName \}\)/,
  "Storage remove success must be followed by an exact paged absence check");
assert.match(routeSource, /pendingStorageJobs[\s\S]*storageCleanupPending/,
  "the client contract must distinguish record deletion from pending photo cleanup");

assert.match(sqlSource, /create or replace function public\.delete_notebook_diary_v1/, "the transactional diary-delete RPC must be installable");
assert.match(sqlSource, /create table if not exists public\.notebook_diary_deletion_receipts/,
  "a durable service-only identity receipt must prevent stale sync resurrection");
assert.match(sqlSource, /notebook_diary_deletion_receipts[\s\S]*enable row level security[\s\S]*revoke all on table public\.notebook_diary_deletion_receipts from public, anon, authenticated/,
  "deletion identities must not be exposed to notebook clients");
assert.match(sqlSource, /pg_advisory_xact_lock\(hashtextextended\('notebook-family:'/, "delete and timeline writes must serialize by family");
assert.ok(
  sqlSource.indexOf("perform pg_advisory_xact_lock(hashtextextended('notebook-family:'")
    < sqlSource.indexOf("select fm.role into v_role"),
  "delete authorization must be read after the family advisory lock"
);
assert.match(sqlSource, /pg_advisory_xact_lock\(hashtextextended\('notebook-storage:'/, "same-user paths across different families must serialize globally");
assert.match(sqlSource, /p_expected_cloud_revision is distinct from v_event\.cloud_revision[\s\S]*p_expected_cloud_hash is distinct from v_event\.cloud_hash/, "cloud deletion must compare both revision and hash");
assert.match(sqlSource, /other_event\.id <> v_event\.id[\s\S]*other_attachment->>'storagePath' = v_path/, "a path referenced by another event must not be deleted");
assert.match(sqlSource, /if v_bucket <> 'home-photos' then[\s\S]*message = 'notebook_diary_delete_unsupported_storage_bucket'/,
  "an unknown nonblank attachment bucket must fail closed before deleting the diary row");
assert.match(sqlRegressionSource, /unsupported bucket deletion changed durable state/,
  "PostgreSQL regression must prove unsupported attachments preserve all durable state");
assert.match(sqlSource, /delete from public\.timeline_events[\s\S]*e\.cloud_revision = p_expected_cloud_revision[\s\S]*e\.cloud_hash = p_expected_cloud_hash/, "timeline deletion must repeat the revision/hash CAS");
assert.match(sqlSource, /update public\.person_ai_memories[\s\S]*long_term_summary = ''[\s\S]*important_changes = '\[\]'::jsonb[\s\S]*source_event_ids = '\{\}'::uuid\[\][\s\S]*memory_version = memory_version \+ 1/, "derived AI memory and source pointers must be invalidated in the delete transaction");
assert.match(sqlSource, /create trigger timeline_events_notebook_storage_delete_guard/, "future timeline writes must reject a path queued for deletion");
assert.match(sqlSource, /receipt\.local_diary_id = v_local_diary_id[\s\S]*message = 'notebook_diary_deleted'/,
  "future timeline writes must reject every durable deleted diary identity");
assert.doesNotMatch(sqlSource, /family_id uuid[^\n]*references[\s\S]*on delete cascade/, "cleanup jobs must survive family deletion");
assert.doesNotMatch(sqlSource, /person_id uuid[^\n]*references[\s\S]*on delete cascade/, "cleanup jobs must survive person deletion");
assert.doesNotMatch(sqlSource, /created_by uuid[^\n]*references[\s\S]*on delete cascade/, "cleanup jobs must survive uploader account deletion");
assert.match(sqlSource, /drop constraint if exists notebook_storage_deletion_jobs_family_id_fkey/, "re-applying the migration must remove the unsafe draft family cascade");
assert.match(cleanupRouteSource, /verifyCron\(request\)/, "automatic cleanup must be protected by the fail-closed cron secret");
assert.match(cleanupRouteSource, /\.contains\("attachments",/, "automatic cleanup must recheck shared timeline references");
assert.match(cleanupRouteSource, /\.eq\("status", "pending"\)/, "automatic cleanup must claim only pending jobs");
assert.match(cleanupRouteSource, /attempt_count: job\.attemptCount \+ 1/, "failed cleanup attempts must remain observable and retryable");
assert.match(cleanupRouteSource, /\.list\(directory, \{ limit: 100, offset, search: objectName \}\)/,
  "the recovery worker must confirm the exact object is absent before completion");
assert.ok(JSON.parse(vercelSource).crons.some((cron) => cron.path === "/api/cron/cleanup-notebook-storage"), "failed Storage cleanup needs an automatic scheduled recovery path");

assert.ok(homeSource.includes('className="is-delete"'), "each past-record card must expose a first delete action");
assert.ok(homeSource.includes('className="diary-delete-confirm"'), "the first action must open an inline second confirmation step");
assert.ok(homeSource.includes("この1件を削除する"), "the destructive second step must name the one-record scope");
assert.match(homeSource, /disabled=\{cloudContentReadOnly \|\| deleteState\?\.status === "deleting"\}/, "viewer UI must disable record deletion");
const cloudDeleteCall = homeSource.indexOf('fetch("/api/notebook/diary"');
const localDeleteCall = homeSource.indexOf("completeDiaryEntryLocalDeletion(deletionIdentity)", cloudDeleteCall);
assert.ok(cloudDeleteCall >= 0 && localDeleteCall > cloudDeleteCall, "cloud deletion and Storage cleanup must complete before the local helper is called");
assert.match(homeSource, /prepareDiaryEntryLocalDeletion\(deletionIdentity\)[\s\S]*fetch\("\/api\/notebook\/diary"/,
  "the local anti-resurrection marker must be durable before the request starts");
assert.match(homeSource, /response\.status >= 400 && response\.status < 500[\s\S]*clearPendingDiaryEntryLocalDeletion/,
  "only an authoritative client rejection may clear a pending deletion marker");
assert.match(homeSource, /diaryCloudDeletionInFlightRef\.current[\s\S]*pendingAutoSyncPayloadRef\.current = payload/, "auto-sync work arriving during deletion must be retained");
assert.match(homeSource, /blockedCloudDiarySyncKeysRef\.current\.has/, "an ambiguous cloud deletion must exclude the stale record from resumed sync");
assert.match(homeSource, /if \(resumeCloudSync\)[\s\S]*syncNotebookToCloud\(\{ silent: true, payload: resumePayload \}\)/, "pending auto-sync must resume after deletion settles");
assert.match(homeSource, /添付写真\$\{pendingStorageJobs\}件は削除確認待ちです/,
  "the UI must not claim a photo is gone while its durable cleanup job remains pending");
assert.match(storeSource, /DIARY_ENTRY_DELETION_STORAGE_KEY/);
assert.match(storeSource, /export function isDiaryEntryCloudSyncBlocked/);
assert.match(storeSource, /export function completeDiaryEntryLocalDeletion/);
assert.match(storeSource, /replaceLocalNotebook[\s\S]*readDiaryEntryDeletionTombstones/);
assert.match(storeSource, /overwriteLocalNotebook[\s\S]*readDiaryEntryDeletionTombstones/);

class MockNextResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
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

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PERSON_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";
const JOB_ID = "55555555-5555-4555-8555-555555555555";
const LOCAL_CASE_ID = "case-a";
const LOCAL_DIARY_ID = "diary-a";
const CLOUD_HASH = "a".repeat(64);

function storageJob(ownerId = USER_ID) {
  return {
    id: JOB_ID,
    bucket: "home-photos",
    storagePath: `notebook/${ownerId}/photo-a.jpg`
  };
}

function createScenario(overrides = {}) {
  return {
    role: "owner",
    includeMembership: true,
    person: { id: PERSON_ID, family_id: FAMILY_ID, profile: { localCaseId: LOCAL_CASE_ID } },
    rpcData: { ok: true, deleted: true, receiptRecorded: true, storageJobs: [storageJob()] },
    rpcError: null,
    storageError: null,
    listedPages: [[]],
    listError: null,
    completionError: null,
    persistedJobs: null,
    operations: [],
    storagePaths: [],
    listCalls: [],
    jobUpdates: [],
    rpcArguments: null,
    ...overrides
  };
}

let scenario = createScenario();

function queryResult(data, error = null, onUpdate = null) {
  const query = {
    select() { return query; },
    eq() { return query; },
    in() { return query; },
    limit() { return query; },
    update(value) { onUpdate?.(value); return query; },
    maybeSingle() {
      return Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error });
    },
    then(resolve, reject) {
      return Promise.resolve({ data, error }).then(resolve, reject);
    }
  };
  return query;
}

const mockSupabase = {
  auth: {
    async getUser(token) {
      return token === "valid-token"
        ? { data: { user: { id: USER_ID } }, error: null }
        : { data: { user: null }, error: new Error("invalid") };
    }
  },
  from(table) {
    if (table === "family_members") {
      return queryResult(scenario.includeMembership
        ? [{ user_id: USER_ID, role: scenario.role }]
        : [{ user_id: OTHER_USER_ID, role: "owner" }]);
    }
    if (table === "people") return queryResult(scenario.person);
    if (table === "notebook_storage_deletion_jobs") {
      let updatePayload = null;
      let updateRecorded = false;
      const recordUpdate = () => {
        if (!updatePayload || updateRecorded) return;
        updateRecorded = true;
        scenario.jobUpdates.push(updatePayload);
      };
      const query = {
        select() { return query; },
        eq() { return query; },
        in() { return query; },
        update(value) {
          updatePayload = value;
          scenario.operations.push(value.status === "completed" ? "complete" : "failure");
          return query;
        },
        maybeSingle() {
          recordUpdate();
          return Promise.resolve({
            data: scenario.completionError ? null : { id: JOB_ID },
            error: scenario.completionError
          });
        },
        then(resolve, reject) {
          const sourceJobs = scenario.persistedJobs ?? (scenario.rpcData.storageJobs ?? []).map((job) => ({
            id: job.id,
            storage_bucket: job.bucket,
            storage_path: job.storagePath,
            status: "pending",
            attempt_count: job.attemptCount ?? 0
          }));
          recordUpdate();
          return Promise.resolve({ data: updatePayload ? null : sourceJobs, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
    throw new Error(`Unexpected table: ${table}`);
  },
  async rpc(name, args) {
    assert.equal(name, "delete_notebook_diary_v1");
    scenario.operations.push("rpc");
    scenario.rpcArguments = args;
    return { data: scenario.rpcData, error: scenario.rpcError };
  },
  storage: {
    from(bucket) {
      assert.equal(bucket, "home-photos");
      return {
        async remove(paths) {
          scenario.operations.push("storage");
          scenario.storagePaths.push(...paths);
          return { data: null, error: scenario.storageError };
        },
        async list(directory, options) {
          scenario.operations.push("verify");
          scenario.listCalls.push({ directory, ...options });
          const page = Math.floor((options?.offset ?? 0) / 100);
          return {
            data: scenario.listedPages[page] ?? [],
            error: scenario.listError
          };
        }
      };
    }
  }
};

const routePath = path.join(repoRoot, "apps/web/app/api/notebook/diary/route.ts");
const diaryRoute = loadCommonJs(routePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => mockSupabase };
  throw new Error(`Unexpected route import: ${specifier}`);
});

function request(overrides = {}, token = "valid-token") {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === "authorization" && token ? `Bearer ${token}` : null;
      }
    },
    async json() {
      return {
        familyId: FAMILY_ID,
        personId: PERSON_ID,
        localCaseId: LOCAL_CASE_ID,
        localDiaryId: LOCAL_DIARY_ID,
        cloudRevision: 4,
        cloudHash: CLOUD_HASH,
        ...overrides
      };
    }
  };
}

scenario = createScenario({ role: "viewer" });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 403, "viewer must not delete a cloud diary record");
  assert.deepEqual(scenario.operations, []);
}

scenario = createScenario({ includeMembership: false });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 403, "a user outside the explicit family must be denied");
  assert.deepEqual(scenario.operations, []);
}

scenario = createScenario({ person: { id: PERSON_ID, family_id: FAMILY_ID, profile: { localCaseId: "case-other" } } });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 404, "person and local case identities must match");
  assert.deepEqual(scenario.operations, []);
}

scenario = createScenario({ rpcError: { message: "notebook_diary_delete_conflict" } });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 409, "stale cloud revision/hash must fail before Storage mutation");
  assert.deepEqual(scenario.operations, ["rpc"]);
}

scenario = createScenario({ rpcError: { message: "notebook_diary_delete_shared_storage_reference" } });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 409, "a shared timeline attachment must fail before Storage mutation");
  assert.equal(response.body.error, "shared_storage_reference");
  assert.deepEqual(scenario.operations, ["rpc"]);
}

scenario = createScenario({ rpcError: { message: "notebook_diary_delete_unsupported_storage_bucket" } });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 409, "unsupported attachment storage must fail closed");
  assert.equal(response.body.error, "unsupported_storage_bucket");
  assert.deepEqual(scenario.operations, ["rpc"]);
}

scenario = createScenario({ rpcData: { ok: true, deleted: true, receiptRecorded: false, storageJobs: [] } });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 500, "local deletion must not proceed without an explicit durable server receipt");
  assert.equal(response.body.error, "diary_delete_receipt_failed");
  assert.deepEqual(scenario.operations, ["rpc"]);
}

scenario = createScenario();
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 200);
  assert.deepEqual(scenario.operations, ["rpc", "storage", "verify", "complete"]);
  assert.deepEqual(scenario.storagePaths, [`notebook/${USER_ID}/photo-a.jpg`]);
  assert.equal(response.body.deleted, true);
  assert.equal(response.body.deletedStorageObjects, 1);
  assert.equal(response.body.pendingStorageJobs, 0);
  assert.equal(response.body.storageCleanupPending, false);
  assert.equal(scenario.rpcArguments.p_family_id, FAMILY_ID);
  assert.equal(scenario.rpcArguments.p_person_id, PERSON_ID);
  assert.equal(scenario.rpcArguments.p_local_case_id, LOCAL_CASE_ID);
  assert.equal(scenario.rpcArguments.p_local_diary_id, LOCAL_DIARY_ID);
  assert.equal(scenario.rpcArguments.p_expected_cloud_revision, 4);
  assert.equal(scenario.rpcArguments.p_expected_cloud_hash, CLOUD_HASH);
}

scenario = createScenario({ rpcData: { ok: true, deleted: false, receiptRecorded: true, storageJobs: [storageJob(OTHER_USER_ID)] } });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 200, "a durable job must remain retryable after its original uploader leaves the family");
  assert.deepEqual(scenario.operations, ["rpc", "storage", "verify", "complete"]);
  assert.deepEqual(scenario.storagePaths, [`notebook/${OTHER_USER_ID}/photo-a.jpg`]);
}

scenario = createScenario({ storageError: new Error("temporary storage outage") });
{
  const first = await diaryRoute.DELETE(request());
  assert.equal(first.status, 200, "the durable record deletion succeeds even while photo cleanup is pending");
  assert.deepEqual(scenario.operations, ["rpc", "storage", "failure"]);
  assert.equal(first.body.pendingStorageJobs, 1);
  assert.equal(first.body.storageCleanupPending, true);
  assert.equal(first.body.deletedStorageObjects, 0);
  assert.equal(scenario.jobUpdates[0].last_error, "storage_delete_failed");

  scenario.rpcData = { ok: true, deleted: false, receiptRecorded: true, storageJobs: [storageJob()] };
  scenario.storageError = null;
  scenario.operations = [];
  const retry = await diaryRoute.DELETE(request());
  assert.equal(retry.status, 200, "a pending durable cleanup job must be retryable after the event is gone");
  assert.deepEqual(scenario.operations, ["rpc", "storage", "verify", "complete"]);
  assert.equal(retry.body.recoveredCleanup, true);
}

scenario = createScenario({ listedPages: [[{ name: "photo-a.jpg" }]] });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 200, "a remove acknowledgement alone must not fail the durable diary deletion");
  assert.deepEqual(scenario.operations, ["rpc", "storage", "verify", "failure"]);
  assert.equal(response.body.deletedStorageObjects, 0);
  assert.equal(response.body.pendingStorageJobs, 1);
  assert.equal(response.body.storageCleanupPending, true);
  assert.equal(scenario.jobUpdates[0].last_error, "storage_delete_not_confirmed");
}

scenario = createScenario({ listError: new Error("listing unavailable") });
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 200, "an unconfirmable Storage state must remain pending and retryable");
  assert.deepEqual(scenario.operations, ["rpc", "storage", "verify", "failure"]);
  assert.equal(response.body.pendingStorageJobs, 1);
  assert.equal(scenario.jobUpdates[0].last_error, "storage_verify_failed");
}

scenario = createScenario({
  listedPages: [
    Array.from({ length: 100 }, (_, index) => ({ name: `other-${index}.jpg` })),
    []
  ]
});
{
  const response = await diaryRoute.DELETE(request());
  assert.equal(response.status, 200);
  assert.deepEqual(scenario.operations, ["rpc", "storage", "verify", "verify", "complete"]);
  assert.deepEqual(scenario.listCalls.map((call) => call.offset), [0, 100],
    "absence verification must page instead of treating a full first page as absence");
  assert.equal(response.body.deletedStorageObjects, 1);
}

scenario = createScenario({ rpcData: { ok: true, deleted: false, receiptRecorded: true, storageJobs: [] } });
{
  const response = await diaryRoute.DELETE(request({ cloudRevision: null, cloudHash: null }));
  assert.equal(response.status, 200, "a never-synced or already-completed record delete must be idempotent");
  assert.deepEqual(scenario.operations, ["rpc"]);
}

scenario = createScenario();
{
  const response = await diaryRoute.DELETE(request({}, ""));
  assert.equal(response.status, 401);
  assert.deepEqual(scenario.operations, []);
}

let cleanupScenario;
const cleanupSupabase = {
  from(table) {
    let updatePayload = null;
    const query = {
      select() { return query; },
      eq() { return query; },
      order() { return query; },
      limit() { return query; },
      contains() { cleanupScenario.operations.push("reference"); return query; },
      update(value) { updatePayload = value; cleanupScenario.operations.push("receipt"); return query; },
      maybeSingle() {
        return Promise.resolve({
          data: cleanupScenario.receiptError ? null : { id: JOB_ID },
          error: cleanupScenario.receiptError
        });
      },
      then(resolve, reject) {
        if (table === "timeline_events") {
          return Promise.resolve({ data: cleanupScenario.references, error: cleanupScenario.referenceError }).then(resolve, reject);
        }
        if (updatePayload) {
          cleanupScenario.updates.push(updatePayload);
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: cleanupScenario.jobs, error: null }).then(resolve, reject);
      }
    };
    return query;
  },
  storage: {
    from() {
      return {
        async remove(paths) {
          cleanupScenario.operations.push("storage");
          cleanupScenario.paths.push(...paths);
          return { data: null, error: cleanupScenario.storageError };
        },
        async list(directory, options) {
          cleanupScenario.operations.push("verify");
          cleanupScenario.listCalls.push({ directory, ...options });
          const page = Math.floor((options?.offset ?? 0) / 100);
          return {
            data: cleanupScenario.listedPages[page] ?? [],
            error: cleanupScenario.listError
          };
        }
      };
    }
  }
};

const cleanupRoutePath = path.join(repoRoot, "apps/web/app/api/cron/cleanup-notebook-storage/route.ts");
const cleanupRoute = loadCommonJs(cleanupRoutePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/cronAuth") return { verifyCron: () => null };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => cleanupSupabase };
  throw new Error(`Unexpected cleanup route import: ${specifier}`);
});

function cleanupJobRow() {
  return {
    id: JOB_ID,
    storage_bucket: "home-photos",
    storage_path: `notebook/${OTHER_USER_ID}/photo-a.jpg`,
    attempt_count: 2
  };
}

function createCleanupScenario(overrides = {}) {
  return {
    jobs: [cleanupJobRow()],
    references: [],
    referenceError: null,
    storageError: null,
    listedPages: [[]],
    listError: null,
    receiptError: null,
    operations: [],
    paths: [],
    listCalls: [],
    updates: [],
    ...overrides
  };
}

cleanupScenario = createCleanupScenario();
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 200, "the scheduled worker must complete an unreferenced pending object");
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "verify", "receipt"]);
  assert.equal(response.body.completed, 1);
}

cleanupScenario = createCleanupScenario({ storageError: new Error("outage") });
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 500, "a transient Storage failure must remain visible to the scheduler");
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "receipt"]);
  assert.equal(cleanupScenario.updates[0].last_error, "storage_delete_failed");
  assert.equal(cleanupScenario.updates[0].attempt_count, 3);
}

cleanupScenario = createCleanupScenario({ references: [{ id: "still-used" }] });
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 500, "the scheduled worker must fail closed when another event references the path");
  assert.deepEqual(cleanupScenario.operations, ["reference", "receipt"]);
  assert.equal(cleanupScenario.paths.length, 0);
  assert.equal(cleanupScenario.updates[0].last_error, "storage_path_still_referenced");
}

cleanupScenario = createCleanupScenario({ listedPages: [[{ name: "photo-a.jpg" }]] });
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 500, "the worker must retain a job when the exact object remains");
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "verify", "receipt"]);
  assert.equal(response.body.completed, 0);
  assert.equal(response.body.retained, 1);
  assert.equal(cleanupScenario.updates[0].last_error, "storage_delete_not_confirmed");
}

cleanupScenario = createCleanupScenario({ listError: new Error("listing unavailable") });
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 500, "the worker must retain a job when absence cannot be confirmed");
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "verify", "receipt"]);
  assert.equal(cleanupScenario.updates[0].last_error, "storage_verify_failed");
}

cleanupScenario = createCleanupScenario({
  listedPages: [
    Array.from({ length: 100 }, (_, index) => ({ name: `other-${index}.jpg` })),
    []
  ]
});
{
  const response = await cleanupRoute.GET({});
  assert.equal(response.status, 200);
  assert.deepEqual(cleanupScenario.operations, ["reference", "storage", "verify", "verify", "receipt"]);
  assert.deepEqual(cleanupScenario.listCalls.map((call) => call.offset), [0, 100]);
  assert.equal(response.body.completed, 1);
}

const localStorageData = new Map();
const previousWindow = globalThis.window;
globalThis.window = {
  localStorage: {
    getItem(key) { return localStorageData.has(key) ? localStorageData.get(key) : null; },
    setItem(key, value) { localStorageData.set(key, String(value)); },
    removeItem(key) { localStorageData.delete(key); }
  }
};
const storePath = path.join(repoRoot, "apps/web/lib/store.ts");
const store = loadCommonJs(storePath, (specifier) => {
  if (specifier === "@/lib/funnel") return { trackFunnel() {} };
  if (specifier === "@/lib/date") return { japanDateInputValue: () => "2026-09-04" };
  if (specifier === "@/lib/caseOwnership") return { ANONYMOUS_CASE_TOKEN_PATTERN: /^[a-z0-9_-]+$/i };
  if (specifier === "@oyano/shared") {
    return {
      buildDiagnosisResult: () => ({ tasks: [] }),
      canCreateNotebook: () => true,
      createHandoffToken: () => "test-token",
      NOTEBOOK_LIMIT_MESSAGE: "limit",
      SENSITIVE_INFO_CONSENT_VERSION: "test",
      statusLabel: () => "test"
    };
  }
  throw new Error(`Unexpected store import: ${specifier}`);
});

const diaryEntry = {
  id: LOCAL_DIARY_ID,
  caseId: LOCAL_CASE_ID,
  date: "2026-09-04",
  mood: "stable",
  body: "must not resurrect",
  attachments: [],
  createdAt: "2026-09-04T00:00:00.000Z",
  cloudRevision: 4,
  cloudHash: CLOUD_HASH
};
localStorageData.set("oyano_diary_entries_v01", JSON.stringify([diaryEntry]));
const localDeletionIdentity = {
  familyId: FAMILY_ID,
  personId: PERSON_ID,
  localCaseId: LOCAL_CASE_ID,
  localDiaryId: LOCAL_DIARY_ID,
  cloudRevision: 4,
  cloudHash: CLOUD_HASH
};
assert.equal(store.prepareDiaryEntryLocalDeletion(localDeletionIdentity), true);
assert.equal(store.isDiaryEntryCloudSyncBlocked(LOCAL_CASE_ID, LOCAL_DIARY_ID), true,
  "a marker persisted before the request must block auto-sync after a reload/response loss");
assert.equal(store.listDiaryEntries(LOCAL_CASE_ID).length, 1,
  "a pending/ambiguous delete remains visible so the user can retry it");
const completedLocalDelete = store.completeDiaryEntryLocalDeletion(localDeletionIdentity);
assert.equal(completedLocalDelete.deleted, true);
assert.equal(completedLocalDelete.persisted, true);
assert.equal(store.listDiaryEntries(LOCAL_CASE_ID).length, 0);
localStorageData.set("oyano_diary_entries_v01", JSON.stringify([diaryEntry]));
assert.equal(store.retryCompletedDiaryEntryLocalDeletions(), true);
assert.deepEqual(JSON.parse(localStorageData.get("oyano_diary_entries_v01")), [],
  "startup compaction must remove a stale local row while retaining its terminal marker");

const retryIdentity = { ...localDeletionIdentity, localDiaryId: "diary-authoritative-rejection" };
assert.equal(store.prepareDiaryEntryLocalDeletion(retryIdentity), true);
assert.equal(store.clearPendingDiaryEntryLocalDeletion(retryIdentity), true);
assert.equal(store.isDiaryEntryCloudSyncBlocked(LOCAL_CASE_ID, retryIdentity.localDiaryId), false,
  "an authoritative rejection can restore normal sync for the still-live record");
if (previousWindow === undefined) delete globalThis.window;
else globalThis.window = previousWindow;

console.log("diary deletion tests passed");
