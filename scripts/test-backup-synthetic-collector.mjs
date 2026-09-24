import assert from "node:assert/strict";
import { collectSyntheticCandidate } from "./lib/backup-synthetic-collector.mjs";
import { finalizeGeneration, manifestKey } from "./lib/backup-generation.mjs";

const marker = "SYNTHETIC_PRIVATE_DATA_MUST_NOT_ESCAPE";
const runId = "a".repeat(32);
const photoId = "b".repeat(32);
const plan = { runId, sourceId: "synthetic-pg17", sourceEpoch: "fixture-v1",
  schemaHash: "c".repeat(64), releaseSha: "d".repeat(40) };
const bytes = { database: Buffer.from(`synthetic pg17 dump ${marker}`),
  roles: Buffer.from("synthetic roles"), storage_catalog: Buffer.from("synthetic catalog"),
  photo: Buffer.from("synthetic photo bytes") };
let cases = 0;
async function test(name, callback) {
  try { await callback(); cases++; }
  catch (error) { throw new Error(`synthetic_collection_case_failed:${name}`, { cause: error }); }
}
function fixture() {
  const objects = new Map();
  const events = [];
  const adapter = {
    async openSnapshot({ signal }) {
      assert.equal(signal.aborted, false); events.push("open");
      return { snapshotId: "snapshot-1", sourceId: plan.sourceId, sourceEpoch: plan.sourceEpoch,
        schemaHash: plan.schemaHash, pgMajor: 17, photoCount: 1 };
    },
    async listPhotos({ snapshotId, cursor, pass }, { signal }) {
      assert.equal(snapshotId, "snapshot-1"); assert.equal(cursor, null); assert.equal(signal.aborted, false);
      events.push(`list-${pass}`);
      return { snapshotId, entries: [{ id: photoId, version: "photo-version-1" }], nextCursor: null };
    },
    async readArtifact({ snapshotId, kind, photo }, { signal }) {
      assert.equal(snapshotId, "snapshot-1"); assert.equal(signal.aborted, false);
      events.push(`source-${kind}`);
      return { snapshotId, sourceVersion: photo?.version ?? null,
        body: (async function* () { for (let i = 0; i < bytes[kind].length; i += 7) yield bytes[kind].subarray(i, i + 7); })() };
    },
    async writeArtifact({ key, kind, ifNoneMatch, body }, { signal }) {
      assert.equal(ifNoneMatch, "*"); assert.equal(signal.aborted, false);
      assert.match(key, /^backups\/[a-f0-9]{32}\/artifacts\/[a-f0-9]{32}$/);
      events.push(`write-${kind}`);
      const chunks = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      objects.set(key, { versionId: `version-${kind}`, body: Buffer.concat(chunks) });
      return { status: 200, key, versionId: `version-${kind}` };
    },
    async closeSnapshot({ snapshotId }) { assert.equal(snapshotId, "snapshot-1"); events.push("close"); }
  };
  const verifier = {
    async readObject({ key, versionId }) {
      const object = objects.get(key);
      if (!object) throw new Error(marker);
      return { key, versionId: object.versionId, body: (async function* () { yield object.body; })() };
    },
    async writeManifest({ key, ifNoneMatch, body }) {
      assert.equal(ifNoneMatch, "*"); assert.equal(objects.has(key), false);
      objects.set(key, { versionId: "manifest-version", body: Buffer.from(body) });
      events.push("manifest");
      return { status: 200, key, versionId: "manifest-version" };
    }
  };
  return { adapter, verifier, events, objects };
}
const codeIs = (code) => (error) => {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(JSON.stringify(error).includes(marker), false);
  assert.equal(String(error.stack).includes(marker), false);
  return true;
};

await test("candidate only, separate verifier creates completion after byte reread", async () => {
  const ctx = fixture();
  const result = await collectSyntheticCandidate(plan, ctx.adapter);
  assert.equal(result.status, "CANDIDATE_ONLY");
  assert.equal(result.publicReleaseAllowed, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.generation.artifacts.length, 4);
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
  assert.deepEqual(ctx.events.slice(-2), ["list-after", "close"]);
  const verified = await finalizeGeneration(result.generation, ctx.verifier);
  assert.equal(verified.evidence.scope, "BYTE_INTEGRITY_ONLY");
  assert.equal(ctx.objects.has(manifestKey(runId)), true);
});

await test("real source ID rejected before opening", async () => {
  const ctx = fixture();
  await assert.rejects(() => collectSyntheticCandidate({ ...plan, sourceId: "production" }, ctx.adapter), codeIs("INVALID_PLAN"));
  assert.deepEqual(ctx.events, []);
});

await test("wrong PG major and source identity are rejected before writing", async () => {
  for (const change of [{ pgMajor: 16 }, { sourceId: "synthetic-other" }, { schemaHash: "e".repeat(64) }]) {
    const ctx = fixture(); const original = ctx.adapter.openSnapshot;
    ctx.adapter.openSnapshot = async (...args) => ({ ...(await original(...args)), ...change });
    await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("SNAPSHOT_MISMATCH"));
    assert.equal(ctx.objects.size, 0); assert(ctx.events.includes("close"));
  }
});

await test("missing or duplicate photo page cannot become candidate", async () => {
  for (const entries of [[], [{ id: photoId, version: "v1" }, { id: photoId, version: "v2" }]]) {
    const ctx = fixture();
    ctx.adapter.listPhotos = async ({ snapshotId }) => ({ snapshotId, entries, nextCursor: null });
    await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("PHOTO_COUNT_MISMATCH"));
    assert.equal(ctx.objects.size, 0);
  }
});

await test("page failure, repeated cursor, and version mismatch stop before completion", async () => {
  for (const variant of ["failed-page", "repeated-cursor", "wrong-version"]) {
    const ctx = fixture();
    if (variant === "failed-page") ctx.adapter.listPhotos = async () => { throw new Error(marker); };
    if (variant === "repeated-cursor") {
      const original = ctx.adapter.openSnapshot;
      ctx.adapter.openSnapshot = async (...args) => ({ ...(await original(...args)), photoCount: 3 });
      ctx.adapter.listPhotos = async ({ snapshotId }) =>
        ({ snapshotId, entries: [{ id: photoId, version: "photo-version-1" }], nextCursor: "same" });
    }
    if (variant === "wrong-version") {
      const original = ctx.adapter.readArtifact;
      ctx.adapter.readArtifact = async (...args) => ({ ...(await original(...args)),
        sourceVersion: args[0].kind === "photo" ? "older-version" : null });
    }
    const code = variant === "failed-page" ? "PHOTO_PAGE_FAILED"
      : variant === "repeated-cursor" ? "INVALID_PHOTO_PAGE" : "INVALID_SOURCE_RESPONSE";
    await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs(code));
    assert.equal(ctx.objects.has(manifestKey(runId)), false);
  }
});

await test("photo inventory changed during collection refuses candidate", async () => {
  const ctx = fixture(); const original = ctx.adapter.listPhotos;
  ctx.adapter.listPhotos = async (request, options) => request.pass === "after"
    ? { snapshotId: request.snapshotId, entries: [{ id: photoId, version: "photo-version-2" }], nextCursor: null }
    : original(request, options);
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("SOURCE_INVENTORY_CHANGED"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("write response before consuming bytes is uncertain", async () => {
  const ctx = fixture();
  ctx.adapter.writeArtifact = async ({ key }) => ({ status: 200, key, versionId: "version-1" });
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("ARTIFACT_WRITE_UNCERTAIN"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("lost write acknowledgement stays uncertain, no retry", async () => {
  const ctx = fixture(); const original = ctx.adapter.writeArtifact; let writes = 0;
  ctx.adapter.writeArtifact = async (...args) => { writes++; await original(...args); throw new Error(marker); };
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("ARTIFACT_WRITE_UNCERTAIN"));
  assert.equal(writes, 1); assert.equal(ctx.objects.size, 1);
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("conditional-write conflict is not retried", async () => {
  const ctx = fixture(); let writes = 0;
  ctx.adapter.writeArtifact = async ({ key }) => { writes++; return { status: 412, key, versionId: "existing" }; };
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("ARTIFACT_WRITE_CONFLICT"));
  assert.equal(writes, 1); assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("interrupted source stream after upload starts is uncertain", async () => {
  const ctx = fixture(); const original = ctx.adapter.readArtifact;
  ctx.adapter.readArtifact = async (...args) => {
    const response = await original(...args);
    if (args[0].kind === "database") response.body = (async function* () {
      yield Buffer.from("partial"); throw new Error(marker);
    })();
    return response;
  };
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("ARTIFACT_WRITE_UNCERTAIN"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("oversized source chunk stops without a candidate", async () => {
  const ctx = fixture(); const original = ctx.adapter.readArtifact;
  ctx.adapter.readArtifact = async (...args) => {
    const response = await original(...args);
    if (args[0].kind === "database") response.body = (async function* () {
      yield Buffer.alloc(64 * 1024 + 1);
    })();
    return response;
  };
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("ARTIFACT_WRITE_UNCERTAIN"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("shadowed byteLength cannot hide an oversized chunk", async () => {
  const ctx = fixture(); const original = ctx.adapter.readArtifact;
  ctx.adapter.readArtifact = async (...args) => {
    const response = await original(...args);
    if (args[0].kind === "database") response.body = (async function* () {
      const chunk = new Uint8Array(64 * 1024 + 1);
      Object.defineProperty(chunk, "byteLength", { value: 1 });
      yield chunk;
    })();
    return response;
  };
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("ARTIFACT_WRITE_UNCERTAIN"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("independent verifier detects changed object version", async () => {
  const ctx = fixture();
  const candidate = await collectSyntheticCandidate(plan, ctx.adapter);
  const first = candidate.generation.artifacts[0];
  ctx.objects.get(first.key).versionId = "swapped-version";
  await assert.rejects(() => finalizeGeneration(candidate.generation, ctx.verifier), codeIs("OBJECT_VERSION_MISMATCH"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("independent verifier detects same-size byte corruption", async () => {
  const ctx = fixture();
  const candidate = await collectSyntheticCandidate(plan, ctx.adapter);
  const first = candidate.generation.artifacts[0];
  ctx.objects.get(first.key).body[0] ^= 1;
  await assert.rejects(() => finalizeGeneration(candidate.generation, ctx.verifier), codeIs("OBJECT_HASH_MISMATCH"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

await test("collector timeout aborts and cannot make a candidate", async () => {
  const ctx = fixture(); let signal;
  ctx.adapter.openSnapshot = async ({ signal: passed }) => { signal = passed; return new Promise(() => {}); };
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter, { timeoutMs: 10 }), codeIs("COLLECTION_TIMEOUT"));
  assert.equal(signal.aborted, true); assert.equal(ctx.objects.size, 0);
});

await test("snapshot close failure is not reported as candidate", async () => {
  const ctx = fixture();
  ctx.adapter.closeSnapshot = async () => { throw new Error(marker); };
  await assert.rejects(() => collectSyntheticCandidate(plan, ctx.adapter), codeIs("SOURCE_CLOSE_FAILED"));
  assert.equal(ctx.objects.has(manifestKey(runId)), false);
});

console.log(JSON.stringify({ result: "SYNTHETIC_BACKUP_COLLECTOR_PASS", cases,
  source: "INJECTED_SYNTHETIC_ONLY", realSource: "NOT_CONNECTED", aws: "NOT_CONNECTED",
  productionReady: false, publicReleaseAllowed: false, credentialsRead: false, networkCalls: 0 }));
