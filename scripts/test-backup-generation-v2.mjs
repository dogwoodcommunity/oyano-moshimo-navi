import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { artifactKey, manifestKey, validateGeneration, verifyGeneration,
  finalizeGeneration } from "./lib/backup-generation.mjs";
import { createPrivacyCheckpoint } from "./lib/backup-privacy-checkpoint.mjs";
import { classifySourceCatalog } from "./lib/backup-source-catalog.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const id = (n) => n.toString(16).padStart(32, "0");
const runId = id(200);
const key = Buffer.alloc(32, 0x73);
const sourceId = "synthetic-pg17";
const schemaHash = "a".repeat(64);
const globalScopeHash = createHmac("sha256", key).update("scope-v1").update("\0")
  .update(JSON.stringify(["global", sourceId])).digest("hex");
const allowlist = [{ name: "public.synthetic", columns: [
  { name: "id", type: "bigint", notNull: true },
  { name: "body", type: "text", notNull: false },
], primaryKey: ["id"], classification: "sealed" }];
const allowlistSha256 = classifySourceCatalog(allowlist.map(({ classification, ...rest }) => rest),
  allowlist).allowlistSha256;
let cases = 0;
async function test(name, run) {
  try { await run(); cases++; }
  catch (error) { throw new Error(`generation_v2_case_failed:${name}`, { cause: error }); }
}
const codeIs = (code) => (error) => {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  return true;
};
function fixture() {
  const roles = Buffer.from("synthetic role/ACL catalog");
  const storage = Buffer.from("synthetic storage catalog");
  const binding = {
    sourceId, sourceEpoch: "fixture-v1", schemaHash, allowlistSha256,
    snapshotId: "exported-snapshot-1", pgMajor: 17,
    sealedTables: ["public.synthetic"], excludedTables: [],
    roleCatalogSha256: sha(roles), storageCatalogSha256: sha(storage),
    globalScopeHash, baselineRowCount: 1,
  };
  const baseline = createPrivacyCheckpoint({
    sourceId, sourceEpoch: binding.sourceEpoch, schemaHash,
    keyVersion: "fixture-key-v1", snapshotId: binding.snapshotId,
    capturedAt: "2026-09-24T00:00:00.000Z", expectedTables: binding.sealedTables,
    tables: [{ name: "public.synthetic", rows: [{ id: "9007199254740993",
      scopes: [{ kind: "global", id: sourceId }], body: { text: "synthetic-only" } }] }],
  }, key);
  const payloads = [Buffer.from("synthetic pg17 dump"), roles, storage,
    Buffer.from(JSON.stringify({ binding, allowlist })), Buffer.from(JSON.stringify(baseline))];
  const kinds = ["database", "roles", "storage_catalog", "source_contract", "baseline_checkpoint"];
  const generation = {
    schemaVersion: 2, runId, releaseSha: "b".repeat(40),
    startedAt: "2026-09-24T00:00:00.000Z", finishedAt: "2026-09-24T00:01:00.000Z",
    sourceBinding: binding, inventoryBefore: [], inventoryAfter: [],
    artifacts: payloads.map((bytes, index) => ({
      id: id(index + 1), kind: kinds[index], key: artifactKey(runId, id(index + 1)),
      versionId: `stored-v${index + 1}`, bytes: bytes.length,
      sha256: sha(bytes), photo: null,
    })),
  };
  const objects = new Map(generation.artifacts.map((item, index) => [item.key,
    { versionId: item.versionId, bytes: payloads[index] }]));
  let readCount = 0; let writes = 0;
  const readObject = async ({ key: objectKey, versionId }) => {
    readCount++;
    const value = objects.get(objectKey);
    assert(value); assert.equal(value.versionId, versionId);
    return { key: objectKey, versionId: value.versionId,
      body: (async function* () { yield value.bytes; })() };
  };
  const writeManifest = async ({ key: objectKey, ifNoneMatch, body }) => {
    writes++; assert.equal(ifNoneMatch, "*"); assert.equal(objectKey, manifestKey(runId));
    assert.equal(objects.has(objectKey), false);
    objects.set(objectKey, { versionId: "manifest-v1", bytes: Buffer.from(body) });
    return { status: 200, key: objectKey, versionId: "manifest-v1" };
  };
  const replace = (kind, next) => {
    const item = generation.artifacts.find((candidate) => candidate.kind === kind);
    const bytes = Buffer.from(JSON.stringify(next));
    item.bytes = bytes.length; item.sha256 = sha(bytes);
    objects.get(item.key).bytes = bytes;
  };
  return { generation, objects, binding, baseline, readObject, writeManifest, replace,
    get readCount() { return readCount; }, get writes() { return writes; } };
}

await test("v2 source contract and baseline are tied to versioned verified bytes", async () => {
  const context = fixture();
  const normalized = validateGeneration(context.generation);
  assert.equal(normalized.schemaVersion, 2);
  assert(Object.isFrozen(normalized.sourceBinding.sealedTables));
  const verified = await verifyGeneration(context.generation, { readObject: context.readObject });
  assert.equal(verified.evidence.sourceSnapshotConsistency, "NOT_VERIFIED");
  assert.equal(context.writes, 0);
  const receipt = await finalizeGeneration(context.generation,
    { readObject: context.readObject, writeManifest: context.writeManifest });
  assert.equal(receipt.manifest.schemaVersion, 2);
  assert.equal(receipt.evidence.productionReady, false);
  assert.equal(context.writes, 1);
});
await test("missing v2 evidence rejects before any read", async () => {
  const context = fixture(); context.generation.artifacts.pop();
  await assert.rejects(() => finalizeGeneration(context.generation,
    { readObject: context.readObject, writeManifest: context.writeManifest }),
  codeIs("ARTIFACT_INVENTORY_MISMATCH"));
  assert.equal(context.readCount, 0); assert.equal(context.writes, 0);
});
await test("source substitution cannot match the fixed binding", async () => {
  const context = fixture();
  context.replace("source_contract", { binding: { ...context.binding, sourceId: "other-source" }, allowlist });
  await assert.rejects(() => finalizeGeneration(context.generation,
    { readObject: context.readObject, writeManifest: context.writeManifest }),
  codeIs("SOURCE_BINDING_MISMATCH"));
  assert.equal(context.writes, 0);
});
await test("catalog substitution fails its allowlist hash", async () => {
  const context = fixture();
  context.replace("source_contract", { binding: context.binding, allowlist: [{ ...allowlist[0],
    columns: [{ ...allowlist[0].columns[0], type: "integer" }, allowlist[0].columns[1]] }] });
  await assert.rejects(() => verifyGeneration(context.generation,
    { readObject: context.readObject }), codeIs("SOURCE_BINDING_MISMATCH"));
});
await test("baseline snapshot and global isolation scope are mandatory", async () => {
  for (const changed of [
    { ...fixture().baseline, snapshotId: "other-snapshot" },
    (() => { const value = structuredClone(fixture().baseline); value.tables[0].rows[0].scopes = ["f".repeat(64)]; return value; })(),
  ]) {
    const context = fixture(); context.replace("baseline_checkpoint", changed);
    await assert.rejects(() => finalizeGeneration(context.generation,
      { readObject: context.readObject, writeManifest: context.writeManifest }),
    codeIs("BASELINE_BINDING_MISMATCH"));
    assert.equal(context.writes, 0);
  }
});
await test("role and Storage catalog hashes must match the manifest binding", async () => {
  const context = fixture();
  context.generation.sourceBinding.roleCatalogSha256 = "f".repeat(64);
  await assert.rejects(() => verifyGeneration(context.generation,
    { readObject: context.readObject }), codeIs("SOURCE_BINDING_MISMATCH"));
  assert.equal(context.readCount, 0);
});
console.log(JSON.stringify({ result: "BACKUP_GENERATION_V2_TEST_PASS", cases,
  verified: "BYTE_AND_SYNTHETIC_SEMANTIC_BINDING_ONLY", sourceAttestation: false,
  productionReady: false, networkCalls: 0 }));
