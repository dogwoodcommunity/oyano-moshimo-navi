import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { classifySourceCatalog, serializePgRow } from "./lib/backup-source-catalog.mjs";

// No provider URL, password, remote network, input path or existing volume.
// This is a disposable PG17 fixture and a simulated Storage policy only.
const imageId = "sha256:0b657ff48d7f76a1e907f381b1693eb4f2bf54c1d2df4feb6743d7dc601768dd";
const runId = randomUUID();
const name = `oyano-backup-source-${runId}`;
const label = `oyano.backup-source=${runId}`;
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter((key) => process.env[key])
  .map((key) => [key, process.env[key]]));
env.LANG = "C"; env.LC_ALL = "C";
let phase = "preflight";
let created = false;
function command(args, input, allowFailure = false) {
  const result = spawnSync("docker", args, { env, input, timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"] });
  if (!allowFailure && (result.status !== 0 || result.error || result.signal))
    throw new Error(`synthetic_docker_failed:${phase}`);
  return result;
}
function sql(query, allowFailure = false) {
  return command(["exec", "-i", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres"], query, allowFailure);
}
function output(query) { return sql(query).stdout.toString().trim(); }
function session(query, linePattern) {
  const child = spawn("docker", ["exec", "-i", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres"], { env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  const marked = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`synthetic_session_timeout:${phase}`)), 5_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const match = stdout.split(/\r?\n/).find((line) => linePattern.test(line));
      if (match) { clearTimeout(timer); resolve(match.trim()); }
    });
    child.on("error", () => { clearTimeout(timer); reject(new Error(`synthetic_session_failed:${phase}`)); });
    child.on("close", (code) => {
      if (code !== 0 || !stdout.split(/\r?\n/).some((line) => linePattern.test(line))) {
        clearTimeout(timer); reject(new Error(`synthetic_session_closed:${phase}`));
      }
    });
  });
  child.stdin.end(query);
  return { child, marked, ended: new Promise((resolve) => child.once("close", resolve)) };
}

const catalogSql = `select coalesce(jsonb_agg(jsonb_build_object(
  'name', n.nspname||'.'||c.relname,
  'columns', (select jsonb_agg(jsonb_build_object('name', a.attname,
    'type', format_type(a.atttypid,a.atttypmod), 'notNull', a.attnotnull) order by a.attnum)
    from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
  'primaryKey', (select coalesce(jsonb_agg(a.attname order by k.ord),'[]'::jsonb)
    from pg_constraint pk join lateral unnest(pk.conkey) with ordinality k(attnum,ord) on true
    join pg_attribute a on a.attrelid=c.oid and a.attnum=k.attnum
    where pk.conrelid=c.oid and pk.contype='p')
) order by n.nspname,c.relname),'[]'::jsonb)::text
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('public','auth','storage');`;
const allowlist = [
  { name: "auth.users", columns: [
    { name: "id", type: "uuid", notNull: true }, { name: "token", type: "text", notNull: false }],
    primaryKey: ["id"], classification: "sealed" },
  { name: "public.sample", columns: [
    { name: "id", type: "bigint", notNull: true },
    { name: "amount", type: "numeric(30,0)", notNull: false },
    { name: "note", type: "text", notNull: false }],
    primaryKey: ["id"], classification: "sealed" },
  { name: "storage.objects", columns: [
    { name: "id", type: "uuid", notNull: true },
    { name: "bucket_id", type: "text", notNull: false }],
    primaryKey: ["id"], classification: "sealed" },
];
function storageStub(token, request) {
  const now = 1_800_000_000;
  if (token.role !== "backup_storage_reader" || token.project !== "synthetic-pg17"
    || token.expiresAt <= now || request.bucket !== "home-photos"
    || !["GET", "HEAD", "LIST"].includes(request.action)) throw new Error("STORAGE_DENIED");
  return { status: 200, version: "v1", data: Buffer.from("synthetic-photo") };
}

try {
  phase = "image-preflight";
  assert.equal(command(["image", "inspect", imageId, "--format", "{{.Id}}"])
    .stdout.toString().trim(), imageId);
  phase = "create-isolated-pg17";
  const id = command(["create", "--pull=never", "--network=none", "--rm", "--name", name,
    "--label", label, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", imageId]).stdout.toString().trim();
  assert.match(id, /^[a-f0-9]{64}$/);
  created = true;
  const inspected = JSON.parse(command(["inspect", name]).stdout.toString())[0];
  assert.equal(inspected.Config.Labels["oyano.backup-source"], runId);
  assert.equal(inspected.HostConfig.NetworkMode, "none");
  assert.equal((inspected.HostConfig.Binds ?? []).length, 0);
  assert.equal(Object.keys(inspected.HostConfig.PortBindings ?? {}).length, 0);
  command(["start", name]);
  for (let attempt = 0; attempt < 60; attempt++) {
    if (command(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], undefined, true).status === 0) break;
    if (attempt === 59) throw new Error("synthetic_postgres_not_ready");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  phase = "seed-synthetic-source";
  sql(`create schema auth; create schema storage;
    create role backup_reader nologin bypassrls;
    create role limited_reader nologin;
    create table public.sample(id bigint primary key, amount numeric(30,0), note text);
    create table auth.users(id uuid primary key, token text);
    create table storage.objects(id uuid primary key, bucket_id text);
    insert into public.sample values(9007199254740993,999999999999999999999999999999,'before');
    insert into auth.users values('00000000-0000-4000-8000-000000000001','synthetic-secret');
    insert into storage.objects values('00000000-0000-4000-8000-000000000002','home-photos');
    alter table public.sample enable row level security;
    alter table public.sample force row level security;
    create policy no_reader on public.sample for select using(false);
    grant usage on schema public,auth,storage to backup_reader;
    grant select on public.sample,auth.users,storage.objects to backup_reader;
    grant select on public.sample to limited_reader;`);
  phase = "catalog-classification";
  const catalog = JSON.parse(output(catalogSql));
  const contract = classifySourceCatalog(catalog, allowlist);
  assert.equal(contract.tableCount, 3);
  assert.equal(contract.sealed.length, 3);
  assert.match(contract.allowlistSha256, /^[a-f0-9]{64}$/);
  assert.equal(output("set role limited_reader; select count(*) from public.sample;"), "0");
  assert.equal(output("set role backup_reader; select count(*) from public.sample;"), "1");
  assert.notEqual(sql("set role backup_reader; update public.sample set note='write';", true).status, 0);
  const raw = JSON.parse(output(`select jsonb_build_array(
    jsonb_build_object('name','id','text',id::text),
    jsonb_build_object('name','amount','text',amount::text),
    jsonb_build_object('name','note','text',note::text))::text from public.sample;`));
  const row = serializePgRow(allowlist[1], raw);
  assert(row.id.includes("9007199254740993"));
  assert(row.body.includes("999999999999999999999999999999"));
  assert(!row.body.includes("9007199254740992"));
  phase = "slow-writer-and-exported-snapshot";
  const writer = session(`begin; insert into public.sample values(9007199254740994,4,'slow-commit');
    select 'writer-open'; select pg_sleep(2); commit;`, /^writer-open$/);
  await writer.marked;
  const coordinator = session(`begin isolation level repeatable read read only;
    select pg_export_snapshot(); select pg_sleep(20); rollback;`, /^[0-9A-F-]{8,64}$/);
  try {
    const snapshotId = await coordinator.marked;
    assert.match(snapshotId, /^[0-9A-F-]{8,64}$/);
    assert.equal(await writer.ended, 0);
    assert.equal(output("select count(*) from public.sample;"), "2");
    const historical = output(`begin isolation level repeatable read read only;
      set transaction snapshot '${snapshotId}'; set role backup_reader;
      select count(*) from public.sample;`);
    assert.equal(historical, "1");
    const dump = command(["exec", name, "pg_dump", "-U", "postgres", "-d", "postgres",
      "--data-only", "--format=plain", "--table=public.sample", `--snapshot=${snapshotId}`]).stdout.toString();
    assert(dump.includes("9007199254740993"));
    assert(!dump.includes("9007199254740994"));
  } finally {
    coordinator.child.kill("SIGTERM");
    await coordinator.ended;
  }
  phase = "drift-and-storage-negative-controls";
  sql("create table public.unclassified(id bigint primary key);");
  assert.throws(() => classifySourceCatalog(JSON.parse(output(catalogSql)), allowlist),
    (error) => error.code === "TABLE_COVERAGE_UNPROVEN");
  assert.throws(() => classifySourceCatalog(catalog, allowlist.map((entry) => entry.name === "public.sample"
    ? { ...entry, columns: [{ ...entry.columns[0], type: "integer" }, ...entry.columns.slice(1)] } : entry)),
  (error) => error.code === "CATALOG_DRIFT");
  assert.throws(() => serializePgRow(allowlist[1], [
    { name: "id", text: 9007199254740993 }, { name: "amount", text: "4" }, { name: "note", text: "x" }]),
  (error) => error.code === "INVALID_ROW");
  const token = { role: "backup_storage_reader", project: "synthetic-pg17", expiresAt: 1_800_000_100 };
  assert.equal(storageStub(token, { action: "GET", bucket: "home-photos" }).status, 200);
  for (const [candidate, request] of [
    [{ ...token, expiresAt: 1_799_999_999 }, { action: "GET", bucket: "home-photos" }],
    [token, { action: "PUT", bucket: "home-photos" }],
    [token, { action: "GET", bucket: "another-bucket" }],
  ]) assert.throws(() => storageStub(candidate, request), /STORAGE_DENIED/);
  console.log(JSON.stringify({ result: "BACKUP_SOURCE_PG17_SYNTHETIC_PASS", tableCount: contract.tableCount,
    snapshot: "EXPORTED_PG17_WITH_SLOW_COMMIT", exactNumericText: true,
    storage: "POLICY_STUB_ONLY", realSource: false, productionReady: false, network: "NONE" }));
} finally {
  if (created) {
    const found = command(["inspect", name], undefined, true);
    if (found.status === 0) {
      const inspected = JSON.parse(found.stdout.toString())[0];
      if (inspected.Config.Labels["oyano.backup-source"] === runId)
        command(["rm", "-f", name]);
    }
  }
}
