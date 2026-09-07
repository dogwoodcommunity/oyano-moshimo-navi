import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Synthetic fixtures only. No project URL, connection string, input dump,
// output directory, image override or existing container is accepted.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const image = "docker.io/library/postgres:16-bookworm";
const imageId = "sha256:60f4761b9035e0b8d5218f701a8c3382f641bf12b1604822574cf5be3baeb537";
const migrations = [
  "ai_consult_memory_regression_bootstrap", "family_role_rls_regression_bootstrap",
  "account_erasure_regression_bootstrap", "schema", "api_grants", "production_rls",
  "notebook_atomic_sync_v2", "ai_consult_memory", "notebook_diary_delete",
  "consult_daily_claim", "notebook_person_delete", "family_role_hardening_20260904",
  "admin_auth_hardening", "account_delete_executor_role", "account_delete_identity_ledger",
  "account_deletion_pipeline", "account_erasure_execution_gate", "notebook_diary_reconciliation"
];
const scope = {
  productionBackup: "NOT_TESTED", providerAuthLogin: "NOT_TESTED",
  providerStorageRecovery: "NOT_TESTED", newerDeletionReceiptReplay: "NOT_TESTED",
  providerNewerDeletionReceiptReplay: "NOT_TESTED", newerPersonAndAccountDeletionReplay: "NOT_TESTED",
  postBackupDeletionObjectCleanup: "NOT_TESTED",
  webAndRealDeviceAcceptance: "NOT_TESTED", providerRpoRto: "NOT_TESTED"
};
const argv = process.argv.slice(2);
if (argv.length && !(argv.length === 1 && argv[0] === "--plan")) {
  console.error("Usage: node scripts/test-synthetic-recovery.mjs [--plan]");
  process.exit(2);
}
if (argv[0] === "--plan") {
  console.log(JSON.stringify({ scope: "synthetic-local-recovery", image, imageId, migrations,
    isolation: "two newly created containers; local Unix socket; no network, ports, host binds or existing volumes",
    checks: ["binary pg_dump/pg_restore", "all fixture table rows", "roles/ACL/RLS/functions/triggers",
      "family boundary and viewer rejection", "deletion receipts and pending jobs", "synthetic object bytes/hash",
      "post-backup synthetic diary receipt replay, idempotence and resurrection rejection"], ...scope }, null, 2));
  process.exit(0);
}

const startedAt = Date.now();
const runId = randomUUID();
const label = `oyano.synthetic-recovery=${runId}`;
const containers = [];
const allocatedNames = [];
let temporaryDirectory;
let phase = "preflight";
let result;
let catalogDifferences;
let env = Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
env = { ...env, LANG: "C", LC_ALL: "C" };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function command(args, input, { allowFailure = false, timeout = 60_000 } = {}) {
  const child = spawnSync("docker", args, { env, cwd: root, input, timeout,
    maxBuffer: 32 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  if (!allowFailure && (child.status !== 0 || child.error || child.signal)) {
    // Never emit environment values or raw subprocess output.
    throw new Error(`docker_command_failed:${phase}`);
  }
  return child;
}
function sql(container, statement) {
  assert.ok(containers.includes(container), "unknown_container");
  return command(["exec", "-i", container, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres"], statement).stdout.toString().trim();
}
async function createContainer(kind) {
  phase = `create-${kind}`;
  const name = `oyano-synthetic-recovery-${runId}-${kind}`;
  // Track before dispatch: Docker may create it even if its CLI response is
  // interrupted. Cleanup resolves this exact name and validates our run label.
  allocatedNames.push(name);
  const id = command(["create", "--pull=never", "--network=none", "--rm", "--name", name,
    "--label", label, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", imageId]).stdout.toString().trim();
  assert.match(id, /^[a-f0-9]{64}$/);
  containers.push(id);
  const inspected = JSON.parse(command(["inspect", id]).stdout.toString())[0];
  assert.equal(inspected.Config.Labels["oyano.synthetic-recovery"], runId);
  assert.equal(inspected.HostConfig.NetworkMode, "none");
  assert.equal(inspected.HostConfig.AutoRemove, true);
  assert.equal(inspected.Image, imageId);
  assert.equal((inspected.HostConfig.Binds ?? []).length, 0);
  assert.equal((inspected.HostConfig.Mounts ?? []).length, 0);
  assert.equal(Object.keys(inspected.HostConfig.PortBindings ?? {}).length, 0);
  command(["start", id]);
  for (let attempt = 0; attempt < 60; attempt++) {
    // The image's initialization server listens only on its Unix socket and
    // shuts down once bootstrap finishes. Wait for the final loopback listener.
    if (command(["exec", id, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], undefined, { allowFailure: true }).status === 0) return id;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("postgres_not_ready");
}

const fixture = `
begin;
set local request.jwt.claim.role = 'service_role';
insert into auth.users(id,email) values
 ('ea000000-0000-4000-8000-000000000001','synthetic-owner@example.test'),
 ('ea000000-0000-4000-8000-000000000002','synthetic-viewer@example.test'),
 ('ea000000-0000-4000-8000-000000000003','synthetic-other@example.test');
insert into public.profiles(id,email) select id,email from auth.users;
insert into public.families(id,name,owner_user_id) values
 ('ea000000-0000-4000-8000-000000000010','Synthetic family A','ea000000-0000-4000-8000-000000000001'),
 ('ea000000-0000-4000-8000-000000000011','Synthetic family B','ea000000-0000-4000-8000-000000000003');
insert into public.family_members(family_id,user_id,role) values
 ('ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','owner'),
 ('ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000002','viewer'),
 ('ea000000-0000-4000-8000-000000000011','ea000000-0000-4000-8000-000000000003','owner');
insert into public.people(id,family_id,display_name,profile) values
 ('ea000000-0000-4000-8000-000000000020','ea000000-0000-4000-8000-000000000010','合成復旧試験 A','{"localCaseId":"synthetic-case-a"}'),
 ('ea000000-0000-4000-8000-000000000021','ea000000-0000-4000-8000-000000000011','合成復旧試験 B','{"localCaseId":"synthetic-case-b"}');
insert into public.tasks(id,person_id,title,local_task_id) values
 ('ea000000-0000-4000-8000-000000000030','ea000000-0000-4000-8000-000000000020','合成チェックリスト','synthetic-task');
insert into public.timeline_events(id,person_id,event_type,title,body,attachments,metadata,created_by) values
 ('ea000000-0000-4000-8000-000000000040','ea000000-0000-4000-8000-000000000020','diary','合成日記','合成データのみ',
  '[{"storageBucket":"home-photos","storagePath":"notebook/ea000000-0000-4000-8000-000000000001/synthetic.png"}]',
  '{"localCaseId":"synthetic-case-a","localDiaryId":"synthetic-live"}','ea000000-0000-4000-8000-000000000001'),
 ('ea000000-0000-4000-8000-000000000041','ea000000-0000-4000-8000-000000000020','diary','削除する合成日記','合成データのみ',
  '[{"storageBucket":"home-photos","storagePath":"notebook/ea000000-0000-4000-8000-000000000001/deleted.png"}]',
  '{"localCaseId":"synthetic-case-a","localDiaryId":"synthetic-deleted"}','ea000000-0000-4000-8000-000000000001');
do $fixture$ declare rev bigint; content_hash text; begin
 select cloud_revision,cloud_hash into rev,content_hash from public.timeline_events where id='ea000000-0000-4000-8000-000000000041';
 perform public.delete_notebook_diary_v1('ea000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000010',
  'ea000000-0000-4000-8000-000000000020','synthetic-case-a','synthetic-deleted',rev,content_hash);
end $fixture$;
insert into public.person_notebook_deletion_receipts(family_id,person_id,local_case_id,expected_cloud_revision,expected_cloud_hash)
 values('ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000099','synthetic-deleted-person',1,repeat('a',64));
insert into public.person_notebook_storage_deletion_jobs(family_id,person_id,local_case_id,storage_bucket,storage_path)
 values('ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000099','synthetic-deleted-person','home-photos','notebook/ea000000-0000-4000-8000-000000000001/deleted-person.png');
insert into public.scheduled_notifications(user_id,task_id,scheduled_for,status,email_sent_at,sent_at)
 values('ea000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000030',now(),'sent',now(),now());
insert into public.audit_logs(action,target_type,metadata) values('synthetic-recovery-fixture','test','{"synthetic":true}');
insert into account_delete_private.operator_identity_events(record_kind,operator_user_id,evidence_ref)
 values('identity_verified','ea000000-0000-4000-8000-000000000001','synthetic:no-authority');
insert into storage.objects(id,bucket_id,name) values('ea000000-0000-4000-8000-000000000050','home-photos','notebook/ea000000-0000-4000-8000-000000000001/synthetic.png');
commit;
`;

// Include every ordinary table in the restored application/test schemas, not
// only row counts: equal counts with changed text must fail.
const dataInventory = `
select format('select %L || chr(9) || count(*) || chr(9) || encode(digest(coalesce(string_agg(to_jsonb(t)::text, chr(10) order by to_jsonb(t)::text), %L), %L), %L) from %I.%I t;',
 schemaname||'.'||tablename, '', 'sha256', 'hex', schemaname, tablename)
from pg_tables where schemaname in ('public','auth','storage','account_delete_private') order by schemaname,tablename
\\gexec
`;
const catalogInventory = `
with records as (
 select 'relation' kind,n.nspname||'.'||c.relname name,
  jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner)) details
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage','account_delete_private')
 union all
 select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p)-'schemaname'-'tablename'-'policyname' from pg_policies p where schemaname in ('public','auth','storage','account_delete_private')
 union all
 select 'function',n.nspname||'.'||p.oid::regprocedure::text,jsonb_build_array(pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth','storage','account_delete_private') and p.prokind in ('f','p')
 union all
 select 'table-grant',n.nspname||'.'||c.relname,jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a where c.relkind in ('r','p','v','m','S','f') and n.nspname in ('public','auth','storage','account_delete_private')
 union all
 select 'function-grant',n.nspname||'.'||p.oid::regprocedure::text,jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname in ('public','auth','storage','account_delete_private')
 union all
 select 'schema-grant',n.nspname,jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
 from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname in ('public','auth','storage','account_delete_private')
 union all
 select 'role',rolname,jsonb_build_array(rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls) from pg_roles where rolname in ('anon','authenticated','service_role')
 union all
 select 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth','storage','account_delete_private')
)
select coalesce(jsonb_agg(to_jsonb(records) order by kind,name,details::text),'[]'::jsonb) from records;
`;
const acceptance = `
begin;
do $check$ begin
 if (select count(*) from auth.users) <> 3 or (select count(*) from public.people) <> 2
  or (select count(*) from public.timeline_events) <> 1 then raise exception 'fixture rows missing'; end if;
 if (select count(*) from public.notebook_diary_deletion_receipts) <> 1
  or (select count(*) from public.notebook_storage_deletion_jobs where status='pending') <> 1
  or (select count(*) from public.person_notebook_deletion_receipts) <> 1
  or (select count(*) from public.person_notebook_storage_deletion_jobs where status='pending') <> 1 then raise exception 'deletion state missing'; end if;
 if not exists(select 1 from public.scheduled_notifications where status='sent' and email_sent_at is not null and sent_at is not null) then raise exception 'delivery receipt lost'; end if;
 if (select count(*) from account_delete_private.account_erasure_execution_control) <> 1
  or exists(select 1 from account_delete_private.account_erasure_execution_control where enabled_until > clock_timestamp() and consumed_at is null and closed_at is null)
  or exists(select 1 from account_delete_private.account_erasure_execution_grants) then raise exception 'execution gate not closed'; end if;
 if has_schema_privilege('authenticated','account_delete_private','USAGE')
  or has_table_privilege('authenticated','public.notebook_diary_deletion_receipts','SELECT')
  or has_table_privilege('service_role','public.person_notebook_deletion_receipts','SELECT')
  or has_function_privilege('authenticated','public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)','EXECUTE')
  or not has_function_privilege('service_role','public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)','EXECUTE') then raise exception 'service-only boundary changed'; end if;
end $check$;
set local role authenticated;
set local request.jwt.claim.sub='ea000000-0000-4000-8000-000000000001';
do $check$ begin
 if (select count(*) from public.people) <> 1 or (select count(*) from public.timeline_events) <> 1 then raise exception 'owner family boundary failed'; end if;
end $check$;
set local request.jwt.claim.sub='ea000000-0000-4000-8000-000000000002';
do $check$ declare changed int; begin
 if (select count(*) from public.timeline_events) <> 1 then raise exception 'viewer read failed'; end if;
 update public.timeline_events set body='must not change' where id='ea000000-0000-4000-8000-000000000040';
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'viewer update succeeded'; end if;
 begin
  insert into public.timeline_events(person_id,event_type,title,metadata) values('ea000000-0000-4000-8000-000000000020','diary','blocked','{"localCaseId":"synthetic-case-a","localDiaryId":"viewer-insert"}');
  raise exception 'viewer insert succeeded';
 exception when insufficient_privilege then null; end;
end $check$;
set local request.jwt.claim.sub='ea000000-0000-4000-8000-000000000003';
do $check$ begin
 if (select count(*) from public.people) <> 1 or (select count(*) from public.timeline_events) <> 0 then raise exception 'other family read leaked'; end if;
end $check$;
reset role;
set local request.jwt.claim.role='service_role';
do $check$ begin
 begin
  insert into public.timeline_events(person_id,event_type,title,metadata) values('ea000000-0000-4000-8000-000000000020','diary','must not resurrect','{"localCaseId":"synthetic-case-a","localDiaryId":"synthetic-deleted"}');
  raise exception 'deleted diary resurrected';
 exception when serialization_failure then if sqlerrm <> 'notebook_diary_deleted' then raise; end if; end;
 begin
  insert into public.people(family_id,display_name,profile) values('ea000000-0000-4000-8000-000000000010','must not resurrect','{"localCaseId":"synthetic-deleted-person"}');
  raise exception 'deleted person resurrected';
 exception when serialization_failure then if sqlerrm <> 'person_notebook_deleted_identity' then raise; end if; end;
end $check$;
rollback;
`;

function objectRoundTrip() {
  // Fixed one-pixel PNG. This is a filesystem archive model, not Supabase Storage.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
  temporaryDirectory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "oyano-synthetic-recovery-"));
  fs.chmodSync(temporaryDirectory, 0o700);
  const entry = { bucket: "home-photos", path: "notebook/ea000000-0000-4000-8000-000000000001/synthetic.png",
    contentType: "image/png", size: png.length, sha256: hash(png) };
  const backup = path.join(temporaryDirectory, "synthetic-object-backup.json");
  fs.writeFileSync(backup, JSON.stringify({ synthetic: true, manifest: [entry], objects: [png.toString("base64")] }), { mode: 0o600, flag: "wx" });
  png.fill(0); // The original bytes no longer serve as the restored copy.
  const archive = JSON.parse(fs.readFileSync(backup, "utf8"));
  assert.equal(archive.synthetic, true);
  assert.equal(archive.manifest.length, 1);
  assert.equal(archive.objects.length, 1);
  const restored = Buffer.from(archive.objects[0], "base64");
  assert.equal(restored.length, archive.manifest[0].size);
  assert.equal(hash(restored), archive.manifest[0].sha256);
  const output = path.join(temporaryDirectory, "restored-synthetic.png");
  fs.writeFileSync(output, restored, { mode: 0o600, flag: "wx" });
  assert.equal(hash(fs.readFileSync(output)), entry.sha256);
  const corrupted = Buffer.from(restored);
  corrupted[0] ^= 1;
  assert.notEqual(hash(corrupted), entry.sha256, "corruption must be detected");
  return entry;
}

const newerDiaryIdentity = {
  family_id: "ea000000-0000-4000-8000-000000000010",
  person_id: "ea000000-0000-4000-8000-000000000020",
  local_case_id: "synthetic-case-a", local_diary_id: "synthetic-live"
};
function validateNewerDiaryReceipt(receipt) {
  // This is a fixed fixture replay, not an import tool or production authority.
  assert.deepEqual(Object.keys(receipt).sort(), [...Object.keys(newerDiaryIdentity), "deleted_at"].sort());
  for (const [key, value] of Object.entries(newerDiaryIdentity)) assert.equal(receipt[key], value);
  assert.ok(Number.isFinite(Date.parse(receipt.deleted_at)));
}
function replayNewerDiaryReceipt(container, receipt) {
  validateNewerDiaryReceipt(receipt);
  const encoded = Buffer.from(JSON.stringify(receipt)).toString("hex");
  sql(container, `
begin;
set local request.jwt.claim.role = 'service_role';
do $replay$ declare receipt public.notebook_diary_deletion_receipts%rowtype;
  restored public.timeline_events%rowtype; response jsonb;
begin
  select * into receipt from jsonb_populate_record(null::public.notebook_diary_deletion_receipts,
    convert_from(decode('${encoded}', 'hex'), 'UTF8')::jsonb);
  select e.* into restored from public.timeline_events e join public.people p on p.id=e.person_id
    where p.family_id=receipt.family_id and p.id=receipt.person_id
      and p.profile->>'localCaseId'=receipt.local_case_id and e.event_type='diary'
      and e.metadata->>'localCaseId'=receipt.local_case_id
      and e.metadata->>'localDiaryId'=receipt.local_diary_id;
  -- Receipts do not contain actor/revision/hash. Only this fixed synthetic
  -- owner and the exact restored identity's current CAS values are used.
  -- Do not insert the receipt first: a live row plus receipt is a conflict.
  response := public.delete_notebook_diary_v1('ea000000-0000-4000-8000-000000000001',
    receipt.family_id, receipt.person_id, receipt.local_case_id, receipt.local_diary_id,
    restored.cloud_revision, restored.cloud_hash);
  if response->>'ok' <> 'true' or response->>'receiptRecorded' <> 'true'
    or (response->>'deleted' <> 'true' and response->>'alreadyDeleted' <> 'true') then
    raise exception 'synthetic receipt replay failed';
  end if;
end $replay$;
commit;
`);
}
function verifyNewerDiaryReplay(destination, receipt) {
  phase = "newer-receipt-baseline";
  assert.equal(sql(destination, `select count(*) from public.timeline_events
    where id='ea000000-0000-4000-8000-000000000040';`), "1", "old backup contains the subsequently deleted record");
  assert.equal(sql(destination, `select count(*) from public.notebook_diary_deletion_receipts
    where local_diary_id='synthetic-live';`), "0", "old backup must not already contain the newer receipt");
  // A same-local-ID record in the other family is a replay isolation probe.
  sql(destination, `insert into public.timeline_events(id,person_id,event_type,title,body,metadata,created_by)
    values('ea000000-0000-4000-8000-000000000042','ea000000-0000-4000-8000-000000000021',
      'diary','合成別家族の同名ID','再適用で消してはいけない合成記録',
      '{"localCaseId":"synthetic-case-b","localDiaryId":"synthetic-live"}',
      'ea000000-0000-4000-8000-000000000003');`);
  const before = sql(destination, dataInventory);
  const existingDeletionStateQuery = `select jsonb_build_object(
    'receipts', (select jsonb_agg(to_jsonb(r) order by r.local_diary_id)
      from public.notebook_diary_deletion_receipts r where local_diary_id <> 'synthetic-live'),
    'jobs', (select jsonb_agg(to_jsonb(j) order by j.storage_path)
      from public.notebook_storage_deletion_jobs j where local_diary_id <> 'synthetic-live'));`;
  const existingDeletionState = sql(destination, existingDeletionStateQuery);
  const decoyQuery = "select to_jsonb(e)::text from public.timeline_events e where id='ea000000-0000-4000-8000-000000000042';";
  const decoy = sql(destination, decoyQuery);
  assert.throws(() => replayNewerDiaryReceipt(destination, { ...receipt, person_id: "ea000000-0000-4000-8000-000000000021" }),
    assert.AssertionError, "a non-fixture identity must be rejected before SQL");
  assert.equal(sql(destination, dataInventory), before);
  phase = "newer-diary-receipt-replay";
  replayNewerDiaryReceipt(destination, receipt);
  const after = sql(destination, dataInventory);
  const unaffected = (inventory) => inventory.split("\n").filter((line) =>
    !/^(?:public\.timeline_events|public\.notebook_diary_deletion_receipts|public\.notebook_storage_deletion_jobs)\t/.test(line)).join("\n");
  assert.equal(unaffected(after), unaffected(before), "replay must not modify unrelated fixture tables");
  assert.equal(sql(destination, existingDeletionStateQuery), existingDeletionState, "existing receipts and cleanup jobs must remain unchanged");
  assert.equal(sql(destination, decoyQuery), decoy, "same local ID in the other family must survive unchanged");
  phase = "newer-diary-replay-idempotence";
  replayNewerDiaryReceipt(destination, receipt);
  assert.equal(sql(destination, dataInventory), after, "second replay must not duplicate receipts/jobs or change any rows");
  phase = "newer-diary-resurrection-rejection";
  sql(destination, `
begin;
set local request.jwt.claim.role='service_role';
do $check$ begin
  if exists(select 1 from public.timeline_events where id='ea000000-0000-4000-8000-000000000040')
    or (select count(*) from public.notebook_diary_deletion_receipts where
      family_id='ea000000-0000-4000-8000-000000000010' and person_id='ea000000-0000-4000-8000-000000000020'
      and local_case_id='synthetic-case-a' and local_diary_id='synthetic-live') <> 1
    or (select count(*) from public.notebook_storage_deletion_jobs where local_diary_id='synthetic-live'
      and storage_bucket='home-photos' and storage_path='notebook/ea000000-0000-4000-8000-000000000001/synthetic.png'
      and status='pending') <> 1 then raise exception 'replayed deletion state missing'; end if;
  begin
    insert into public.timeline_events(person_id,event_type,title,metadata)
      values('ea000000-0000-4000-8000-000000000020','diary','must not resurrect after newer receipt',
        '{"localCaseId":"synthetic-case-a","localDiaryId":"synthetic-live"}');
    raise exception 'newer deleted diary resurrected';
  exception when serialization_failure then if sqlerrm <> 'notebook_diary_deleted' then raise; end if; end;
  -- Physical object deletion is deliberately not simulated as completed.
  if (select count(*) from storage.objects where name='notebook/ea000000-0000-4000-8000-000000000001/synthetic.png') <> 1
    then raise exception 'unexpected object deletion'; end if;
end $check$;
rollback;
`);
  assert.equal(sql(destination, dataInventory), after, "rejected resurrection must leave all data unchanged");
  return { scope: "synthetic-diary-only", sourceReceiptCount: 1, sourceReceiptSha256: hash(JSON.stringify(receipt)),
    replayMethod: "exact-receipt-identity-with-restored-CAS-and-fixed-fixture-owner",
    originalDeletedAtRestored: false, sourceDeletionStrictlyAfterBackup: "PASS",
    oldBackupContainsDeletedRow: "PASS", newerReceiptAbsentFromOldBackup: "PASS", replay: "PASS",
    nonFixtureIdentityRejected: "PASS", otherFamilySameLocalIdPreserved: "PASS", unrelatedTablesUnchanged: "PASS",
    existingReceiptsAndJobsUnchanged: "PASS",
    repeatedReplayUnchanged: "PASS", resurrectionRejected: "PASS", objectCleanupRemainsPending: "PASS" };
}

try {
  // Read only explicitly listed source files; never load dotenv or an input dump.
  const sources = migrations.map(name => fs.readFileSync(path.join(root, "supabase", `${name}.sql`)));
  const context = command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  const endpoint = context.stdout.toString().trim();
  assert.match(endpoint, /^unix:\/\/\/[^\r\n]+$/);
  env.DOCKER_HOST = endpoint;
  assert.equal(command(["image", "inspect", image, "--format", "{{.Id}}"] ).stdout.toString().trim(), imageId);
  const source = await createContainer("source");
  phase = "apply-tracked-schema";
  sources.forEach((sourceSql, index) => { phase = `migration-${migrations[index]}`; sql(source, sourceSql); });
  phase = "seed-synthetic-fixtures";
  sql(source, fixture);
  phase = "source-acceptance";
  sql(source, acceptance);
  const sourceRows = sql(source, dataInventory);
  const sourceCatalog = sql(source, catalogInventory);
  phase = "binary-dump";
  const backupAt = Date.now();
  const dump = command(["exec", source, "pg_dump", "-U", "postgres", "-d", "postgres", "--format=custom"]).stdout;
  assert.ok(dump.length > 0);
  const dumpHash = hash(dump);
  phase = "delete-after-backup-completion";
  const backupDatabaseTime = sql(source, `select to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');`);
  assert.match(backupDatabaseTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  sql(source, `begin; set local request.jwt.claim.role='service_role';
    do $delete$ declare r public.timeline_events%rowtype; response jsonb; begin
      select * into strict r from public.timeline_events where id='ea000000-0000-4000-8000-000000000040';
      response := public.delete_notebook_diary_v1('ea000000-0000-4000-8000-000000000001',
        'ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000020',
        'synthetic-case-a','synthetic-live',r.cloud_revision,r.cloud_hash);
      if response->>'deleted' <> 'true' then raise exception 'post-backup source deletion failed'; end if;
    end $delete$; commit;`);
  const newerReceipt = JSON.parse(sql(source, `select jsonb_build_object('receipt', to_jsonb(r),
    'strictlyAfterBackup', deleted_at > '${backupDatabaseTime}'::timestamptz)
    from public.notebook_diary_deletion_receipts r where local_diary_id='synthetic-live';`));
  assert.equal(newerReceipt.strictlyAfterBackup, true);
  validateNewerDiaryReceipt(newerReceipt.receipt);
  const restoreStartedAt = Date.now();
  const destination = await createContainer("restore");
  phase = "restore-role-bootstrap";
  // pg_dump is per database and does not include cluster roles. Restore only
  // the three fixed nologin synthetic roles; compare their attributes below.
  sql(destination, "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  phase = "binary-restore";
  command(["exec", "-i", destination, "pg_restore", "-U", "postgres", "-d", "postgres", "--exit-on-error", "--single-transaction"], dump);
  phase = "compare-all-fixture-rows";
  assert.equal(sql(destination, dataInventory), sourceRows);
  phase = "compare-catalog-security";
  const restoredCatalog = sql(destination, catalogInventory);
  if (restoredCatalog !== sourceCatalog) {
    const before = JSON.parse(sourceCatalog);
    const after = JSON.parse(restoredCatalog);
    const beforeSet = new Set(before.map(item => JSON.stringify(item)));
    const afterSet = new Set(after.map(item => JSON.stringify(item)));
    catalogDifferences = {
      sourceOnly: before.filter(item => !afterSet.has(JSON.stringify(item))).slice(0, 8).map(({ kind, name }) => ({ kind, name })),
      restoreOnly: after.filter(item => !beforeSet.has(JSON.stringify(item))).slice(0, 8).map(({ kind, name }) => ({ kind, name }))
    };
  }
  assert.equal(restoredCatalog, sourceCatalog);
  phase = "restored-acceptance";
  sql(destination, acceptance);
  phase = "synthetic-object-round-trip";
  const object = objectRoundTrip();
  assert.equal(sql(destination, "select bucket_id||'/'||name from storage.objects;"), `${object.bucket}/${object.path}`);
  assert.equal(sql(destination, "select attachments->0->>'storagePath' from public.timeline_events;"), object.path);
  const newerDiaryReplay = verifyNewerDiaryReplay(destination, newerReceipt.receipt);
  assert.equal(sql(destination, catalogInventory), sourceCatalog, "replay does not change restored roles/schema/security");
  assert.equal(hash(dump), dumpHash, "newer deletion replay must not rewrite the original backup bytes");
  const completedAt = Date.now();
  result = { status: "SYNTHETIC_RESTORE_PASS", scope: "synthetic-local-recovery", imageId,
    dbDumpSha256: hash(dump), dbDumpBytes: dump.length, tableCount: sourceRows.split("\n").length,
    fixtureDataFingerprint: hash(sourceRows), catalogFingerprint: hash(sourceCatalog),
    checks: { binaryDumpRestore: "PASS", fixtureRows: "PASS", catalogAndRoles: "PASS",
      familyRlsAndViewerRejection: "PASS", deletionReceiptsAndPendingJobs: "PASS",
      sentNotificationReceipt: "PASS", executionGateClosed: "PASS", objectBytesAndHash: "PASS",
      objectReference: "PASS", objectCorruptionDetection: "PASS" },
    syntheticObjectCount: 1, syntheticObjectBytes: object.size, syntheticObjectSha256: object.sha256,
    backupStartedAt: new Date(backupAt).toISOString(), restoreStartedAt: new Date(restoreStartedAt).toISOString(),
    acceptanceCompletedAt: new Date(completedAt).toISOString(), syntheticRestoreDurationMs: completedAt - restoreStartedAt,
    rpo: "NOT_MEASURED_NO_PRODUCTION_DATA_OR_SIMULATED_LOSS_WINDOW", ...scope,
    newerDeletionReceiptReplay: "SYNTHETIC_DIARY_ONLY_PASS", newerDiaryReplay };
} catch (error) {
  result = { status: "SYNTHETIC_RESTORE_FAIL", phase, failure: error instanceof assert.AssertionError ? "assertion_failed" : "local_operation_failed", ...(catalogDifferences ? { catalogDifferences } : {}), ...scope };
  process.exitCode = 1;
} finally {
  let cleanupPassed = true;
  for (const name of allocatedNames.reverse()) {
    phase = "cleanup";
    try {
      const checked = JSON.parse(command(["inspect", name]).stdout.toString())[0];
      assert.equal(checked.Name, `/${name}`);
      assert.equal(checked.Config.Labels["oyano.synthetic-recovery"], runId);
      assert.equal(checked.Image, imageId);
      assert.equal(checked.HostConfig.NetworkMode, "none");
      assert.match(checked.Id, /^[a-f0-9]{64}$/);
      command(["rm", "--force", "--volumes", checked.Id]);
    } catch { cleanupPassed = false; }
  }
  if (temporaryDirectory) {
    try {
      assert.equal(path.dirname(temporaryDirectory), fs.realpathSync(os.tmpdir()));
      assert.match(path.basename(temporaryDirectory), /^oyano-synthetic-recovery-[A-Za-z0-9]+$/);
      for (const filename of ["synthetic-object-backup.json", "restored-synthetic.png"]) {
        const target = path.join(temporaryDirectory, filename);
        if (fs.existsSync(target)) fs.unlinkSync(target);
      }
      fs.rmdirSync(temporaryDirectory); // Refuse unexpected extra files; never recursive.
    } catch { cleanupPassed = false; }
  }
  result = { ...result, cleanup: cleanupPassed ? "PASS" : "FAIL", totalDurationMs: Date.now() - startedAt };
  if (!cleanupPassed) {
    result.status = "SYNTHETIC_RESTORE_FAIL";
    result.cleanupTargetsToVerify = allocatedNames;
    process.exitCode = 1;
  }
  console.log(JSON.stringify(result, null, 2));
}
