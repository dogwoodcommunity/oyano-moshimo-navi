import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const route = read("apps/web/app/api/notebook/sync/route.ts");
const home = read("apps/web/app/home/page.tsx");
const memoryBook = read("apps/web/app/memory-book/[caseId]/page.tsx");
const consultPanel = read("apps/web/components/ConsultPanel.tsx");
const consultMemory = read("apps/web/lib/consultMemory.ts");
const store = read("apps/web/lib/store.ts");
const migration = read("supabase/notebook_atomic_sync_v2.sql");

// A restore page must be stable and complete before local data is touched.
assert.match(route, /\.order\("event_date", \{ ascending: false \}\)[\s\S]*\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.order\("id", \{ ascending: false \}\)/);
assert.match(home, /const restoredEntriesById = new Map<string, DiaryEntry>\(\)/);
assert.match(home, /diaryEntriesTotal !== expectedDiaryEntriesTotal/);
assert.match(home, /restoredEntriesById\.size !== \(expectedDiaryEntriesTotal \?\? 0\)/);
assert.match(home, /catch \{[\s\S]*通信が途中で切れたため/);
assert.match(memoryBook, /const remoteEntriesById = new Map<string, DiaryEntry>\(\)/);
assert.match(memoryBook, /remoteEntriesById\.size !== \(expectedDiaryEntriesTotal \?\? 0\)/);

// The first auth event identifies and reads the exact family. It never uploads
// an unbound localStorage notebook merely because a session exists.
assert.match(route, /const requestedFamilyId = safeText\(request\.nextUrl\.searchParams\.get\("familyId"\)\)/);
assert.match(route, /family_selection_required/);
assert.match(home, /Always identify the exact auth user\/family and read the cloud first/);
assert.match(home, /notebookCloudBindingMatches\(binding, cloudUserId, cloudFamilyId\)/);
assert.match(home, /cloudIdentityStatus !== "ready"/);
assert.match(home, /different-account/);
assert.match(home, /cloudAuthGenerationRef/);
assert.doesNotMatch(home, /if \(shouldRestoreFromCloud \|\| payload\.cases\.length === 0\)[\s\S]{0,240}syncNotebookToCloud/);

// localCaseId is unique only inside one family. Durable AI may use a global
// personId, or the exact auth-bound familyId + localCaseId pair, never a scan
// across every family the same user belongs to.
assert.match(consultPanel, /binding\.authUserId !== authUserId \|\| !binding\.familyId/);
assert.match(consultPanel, /return \{ localCaseId: caseRecord\.id, familyId: binding\.familyId \}/);
assert.match(consultPanel, /const identifier: DurablePersonIdentifier \| null = memoryPayload\?\.personId[\s\S]{0,300}appendDurableIdentifier\(params, identifier\)/);
assert.doesNotMatch(consultPanel, /else params\.set\("localCaseId", activeCaseId\)/);
assert.match(consultMemory, /if \(!personId && !requestedFamilyId\)/);
assert.match(consultMemory, /\.eq\("family_id", requestedFamilyId\)/);
assert.doesNotMatch(consultMemory, /\.in\("family_id", familyIds\)[\s\S]{0,300}\.find\(/);

// Client timestamps are display data only. Every write goes through the one
// service-only transaction and carries opaque server revisions/hashes.
assert.match(route, /supabase\.rpc\("sync_notebook_v2"/);
assert.doesNotMatch(route, /profile->>localUpdatedAt|metadata->>localUpdatedAt|applyDiarySyncPlan/);
for (const key of [
  "localCaseId", "personId", "cloudRevision", "cloudHash",
  "relationshipToFamily", "localTasks", "localTaskId", "status",
  "localDiaryId", "date", "metadata", "createdAt", "updatedAt"
]) {
  assert.ok(route.includes(key), `route must send ${key}`);
  assert.ok(migration.includes(key), `RPC must read/return ${key}`);
}

assert.match(migration, /begin;/i);
assert.match(migration, /commit;/i);
const peoplePrerequisites = migration.indexOf("add column if not exists profile jsonb");
const peopleCloudColumns = migration.indexOf(
  "alter table public.people\n  add column if not exists cloud_revision bigint"
);
const timelinePrerequisites = migration.indexOf("add column if not exists mood text");
const timelineCloudColumns = migration.indexOf(
  "alter table public.timeline_events\n  add column if not exists cloud_revision bigint"
);
assert.ok(peoplePrerequisites >= 0 && peoplePrerequisites < peopleCloudColumns);
assert.ok(timelinePrerequisites >= 0 && timelinePrerequisites < timelineCloudColumns);
for (const prerequisite of [
  "profile_updated_at timestamptz",
  "prefecture text",
  "city text",
  "attachments jsonb not null default '[]'::jsonb",
  "metadata jsonb not null default '{}'::jsonb"
]) {
  assert.ok(migration.includes(prerequisite), `migration must add legacy prerequisite ${prerequisite}`);
}
assert.match(migration, /create or replace function public\.sync_notebook_v2/);
assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/);
assert.match(migration, /notebook_sync_service_role_required/);
assert.match(migration, /v_role not in \('owner', 'admin', 'member'\)/);
assert.match(migration, /for update/);
assert.match(migration, /notebook_sync_receipts/);
assert.match(migration, /ux_people_family_local_case_id/);
assert.match(migration, /ux_tasks_person_local_task_id/);
assert.match(migration, /ux_timeline_events_person_local_diary_id/);
assert.match(migration, /notebook_people_cloud_version_trigger/);
assert.match(migration, /notebook_task_cloud_version_trigger/);
assert.match(migration, /notebook_timeline_cloud_version_trigger/);
assert.match(migration, /notebook_metadata jsonb/);
assert.match(migration, /revoke all on function public\.sync_notebook_v2[\s\S]*from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.sync_notebook_v2[\s\S]*to service_role/);

// Old mobile/profile-only rows remain visible and are given stable identities
// before the next sync. A partial legacy task write is restored as a union,
// never hidden merely because one DB task exists.
assert.match(route, /const mobilePersonProfile/);
assert.match(route, /const mergedTasksById = new Map/);
assert.match(route, /profileTasks\.forEach[\s\S]*dbTasks\.forEach/);
assert.match(migration, /new\.local_task_id := new\.id::text/);
assert.match(migration, /localDiaryId/);
assert.match(migration, /personProfile/);

// A response is applied against the exact sent snapshot. If the user edits
// while the request is in flight, the retry is rebuilt from current storage
// with the new server revision/hash instead of replaying the stale payload.
assert.match(home, /applyNotebookCloudRevisions\([\s\S]{0,500}\}, payload\)/);
assert.match(home, /latestRevisionState\.hasConcurrentChanges/);
assert.match(home, /const storedCases = listLocalCases\(\)/);
assert.match(home, /storedCases\.flatMap\(\(caseRecord\) => listDiaryEntries\(caseRecord\.id\)\)/);
assert.doesNotMatch(home, /syncNotebookToCloud\(\{ silent: true, payload: requestedPendingPayload \}\)/);

// The UI mirrors the server role contract: member profiles and all viewer
// mutations are read-only, while the RPC reports ignored profile writes.
assert.match(home, /cloudMemberRole/);
assert.match(home, /cloudProfileReadOnly/);
assert.match(home, /cloudContentReadOnly/);
assert.match(store, /profileApplied\?: boolean/);
assert.match(store, /rejectedProfileCaseIds/);

// Diary updates never make a stale profile/tasks snapshot authoritative.
assert.doesNotMatch(store, /touchCaseUpdatedAt/);
assert.match(store, /cloudSyncedUpdatedAt/);
assert.match(store, /hasUnsyncedCloudChange/);
assert.match(store, /conflicts\.push\(\{ kind: "profile"/);

// Capacity failures are surfaced and cannot be reported as a durable restore.
assert.match(store, /function writeCases\(cases: CaseRecord\[\]\): boolean/);
assert.match(store, /function writeDiaryEntries\(entries: DiaryEntry\[\]\): boolean/);
assert.match(store, /persisted: casesPersisted && diaryEntriesPersisted/);
assert.match(home, /この端末の保存容量が足りず/);

// Retry is bounded and conflict responses are not automatically replayed.
assert.match(home, /NOTEBOOK_CLOUD_SYNC_RETRY_DELAYS = \[1_000, 3_000, 10_000\]/);
assert.match(home, /errorCode === "notebook_conflict" \|\| errorCode === "notebook_entry_conflict"/);

console.log("notebook sync safety checks: ok");
