import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createOpaqueId, artifactKey, manifestKey, validateGeneration,
  verifyGeneration, finalizeGeneration
} from "./lib/backup-generation.mjs";

// In-memory synthetic bytes only. The actual generation implementation hashes
// these streams; this is not an AWS integration or a PostgreSQL restore test.
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const identifier = (number) => number.toString(16).padStart(32, "0");
const sensitiveMarker = "SYNTHETIC_PRIVATE_DATA_MUST_NOT_ESCAPE";
let cases = 0;
async function test(name, run) {
  try { await run(); cases++; }
  catch (error) { throw new Error(`synthetic_case_failed:${name}`, { cause: error }); }
}
const fixedError = (error) => {
  assert.match(error.code, /^[A-Z_]+$/);
  assert.equal(error.message, error.code);
  assert(!JSON.stringify(error).includes(sensitiveMarker));
  assert(!String(error.stack).includes(sensitiveMarker));
  return true;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const adapters = (context, extra = {}) => ({ readObject: context.readObject, writeManifest: context.writeManifest, ...extra });
const boundary = (evidence) => {
  assert.equal(evidence.scope, "BYTE_INTEGRITY_ONLY");
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.deletionCoverage, "NOT_VERIFIED");
  assert.equal(evidence.semanticRestore, "NOT_VERIFIED");
  assert.equal(evidence.sourceSnapshotConsistency, "NOT_VERIFIED");
};

function fixture({ photos = 2 } = {}) {
  const payloads = [
    Buffer.from("SYNTHETIC DB/Auth dump bytes; not a real database backup"),
    Buffer.from("SYNTHETIC roles/schema bytes"),
    Buffer.from(JSON.stringify({ syntheticStorageCatalog: true, photos }))
  ];
  const kinds = ["database", "roles", "storage_catalog"];
  for (let index = 0; index < photos; index++) {
    // A synthetic one-pixel PNG. The core checks bytes, not image semantics.
    payloads.push(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZ0AAAAASUVORK5CYII=", "base64"));
    kinds.push("photo");
  }
  const runId = identifier(100);
  const inventory = kinds.flatMap((kind, index) => kind === "photo"
    ? [{ id: identifier(index + 1), version: `source-version-${index}` }] : []);
  const generation = {
    schemaVersion: 1, runId, releaseSha: "a".repeat(40),
    startedAt: "2026-09-08T00:00:00.000Z", finishedAt: "2026-09-08T00:01:00.000Z",
    inventoryBefore: structuredClone(inventory), inventoryAfter: structuredClone(inventory),
    artifacts: kinds.map((kind, index) => ({
      id: identifier(index + 1), kind, key: artifactKey(runId, identifier(index + 1)),
      versionId: `stored-version-${index}`, bytes: payloads[index].length,
      sha256: sha256(payloads[index]), photo: kind === "photo" ? structuredClone(inventory[index - 3]) : null
    }))
  };
  const objects = new Map(generation.artifacts.map((item, index) => [item.key, {
    versionId: item.versionId, bytes: Buffer.from(payloads[index])
  }]));
  const events = [];
  const chunks = async function* (bytes) {
    for (let offset = 0; offset < bytes.length; offset += 7) yield bytes.subarray(offset, offset + 7);
  };
  const readObject = async (request, { signal }) => {
    assert(Object.isFrozen(request)); assert(signal instanceof AbortSignal);
    assert(!signal.aborted);
    events.push({ action: "read", key: request.key, versionId: request.versionId });
    const object = objects.get(request.key);
    if (!object) throw new Error(sensitiveMarker);
    return { key: request.key, versionId: object.versionId, body: chunks(object.bytes) };
  };
  const writeManifest = async (request, { signal }) => {
    assert.equal(request.ifNoneMatch, "*"); assert(signal instanceof AbortSignal);
    assert(!signal.aborted); assert(request.body instanceof Uint8Array);
    assert.equal(request.key, manifestKey(runId));
    assert.equal(events.filter((event) => event.action === "read").length, generation.artifacts.length);
    assert.equal(objects.has(request.key), false);
    events.push({ action: "write", key: request.key });
    objects.set(request.key, { versionId: "manifest-version-1", bytes: Buffer.from(request.body) });
    return { status: 200, key: request.key, versionId: "manifest-version-1" };
  };
  return { generation, objects, events, readObject, writeManifest, chunks };
}

await test("opaque names and immutable normalization", () => {
  const ids = Array.from({ length: 20 }, () => createOpaqueId());
  ids.forEach((id) => assert.match(id, /^[a-f0-9]{32}$/));
  assert.equal(new Set(ids).size, ids.length);
  const { generation } = fixture();
  const normalized = validateGeneration(generation);
  assert(Object.isFrozen(normalized)); assert(Object.isFrozen(normalized.artifacts[0]));
  generation.artifacts[0].sha256 = "f".repeat(64);
  assert.notEqual(normalized.artifacts[0].sha256, generation.artifacts[0].sha256);
});

const invalidChanges = [
  ["unknown private field", (value) => { value.privateText = sensitiveMarker; }],
  ["unknown schema", (value) => { value.schemaVersion = 2; }],
  ["path used as run ID", (value) => { value.runId = "../private-name"; }],
  ["bad release SHA", (value) => { value.releaseSha = "not-a-release"; }],
  ["invalid calendar date", (value) => { value.startedAt = "2026-02-30T00:00:00.000Z"; }],
  ["reverse window", (value) => { value.finishedAt = "2026-09-07T23:59:59.000Z"; }],
  ["excess acquisition window", (value) => { value.finishedAt = "2026-09-10T00:00:00.000Z"; }],
  ["missing database", (value) => { value.artifacts.shift(); }],
  ["duplicate database", (value) => { value.artifacts[1].kind = "database"; }],
  ["missing roles", (value) => { value.artifacts.splice(1, 1); }],
  ["missing storage catalog", (value) => { value.artifacts.splice(2, 1); }],
  ["unknown artifact kind", (value) => { value.artifacts[0].kind = "untrusted"; }],
  ["duplicate artifact ID", (value) => { value.artifacts[1].id = value.artifacts[0].id; }],
  ["duplicate destination key", (value) => { value.artifacts[1].key = value.artifacts[0].key; }],
  ["other generation key", (value) => { value.artifacts[0].key = artifactKey(identifier(999), value.artifacts[0].id); }],
  ["path traversal", (value) => { value.artifacts[0].key += "/../file"; }],
  ["missing version", (value) => { delete value.artifacts[0].versionId; }],
  ["null version", (value) => { value.artifacts[0].versionId = "null"; }],
  ["empty artifact", (value) => { value.artifacts[3].bytes = 0; }],
  ["negative bytes", (value) => { value.artifacts[0].bytes = -1; }],
  ["unsafe byte count", (value) => { value.artifacts[0].bytes = Number.MAX_SAFE_INTEGER + 1; }],
  ["fractional bytes", (value) => { value.artifacts[0].bytes = 1.2; }],
  ["ETag substituted for digest", (value) => { value.artifacts[0].sha256 = '"abcd-2"'; }],
  ["extra ETag field", (value) => { value.artifacts[0].etag = sensitiveMarker; }],
  ["changed source version", (value) => { value.inventoryAfter[0].version = "different-source-version"; }],
  ["missing source inventory item", (value) => { value.inventoryAfter.pop(); }],
  ["duplicate inventory", (value) => { value.inventoryBefore.push(structuredClone(value.inventoryBefore[0])); }],
  ["missing photo", (value) => { value.artifacts.pop(); }],
  ["unmatched photo", (value) => { value.artifacts[3].photo.id = identifier(999); }],
  ["photo link on DB", (value) => { value.artifacts[0].photo = structuredClone(value.inventoryBefore[0]); }]
];
for (const [name, change] of invalidChanges) await test(name, async () => {
  const context = fixture(); change(context.generation);
  assert.throws(() => validateGeneration(context.generation), fixedError);
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), fixedError);
  assert.equal(context.events.length, 0, "malformed input must be rejected before adapters");
});

await test("artifact kind is a string and never invokes user coercion", () => {
  for (const type of ["object", "boxed", "symbol"]) {
    let coerced = false;
    const { generation } = fixture();
    generation.artifacts[0].kind = type === "symbol" ? Symbol("database") : type === "boxed"
      ? new String("database") : { toString() { coerced = true; throw new Error(sensitiveMarker); } };
    assert.throws(() => validateGeneration(generation), fixedError);
    assert.equal(coerced, false);
  }
});

await test("JSON getters and extra adapter fields are rejected", async () => {
  const context = fixture(); let called = false;
  Object.defineProperty(context.generation.artifacts[0], "sha256", {
    enumerable: true, get() { called = true; throw new Error(sensitiveMarker); }
  });
  assert.throws(() => validateGeneration(context.generation), fixedError);
  assert.equal(called, false);
  const valid = fixture();
  await assert.rejects(() => finalizeGeneration(valid.generation, { ...adapters(valid), privateText: sensitiveMarker }), fixedError);
  assert.equal(valid.events.length, 0);
});

await test("proxy validation failure never leaks supplied exception text", () => {
  const { generation } = fixture();
  const proxy = new Proxy(generation, { getPrototypeOf() { throw new Error(sensitiveMarker); } });
  assert.throws(() => validateGeneration(proxy), fixedError);
});

await test("array subclass cannot inject unvalidated artifacts through map", () => {
  const { generation } = fixture(); let called = false;
  class InjectingArray extends Array {
    map(callback) { called = true; return [...super.map(callback), { key: "outside/scope" }]; }
  }
  generation.artifacts = InjectingArray.from(generation.artifacts);
  assert.throws(() => validateGeneration(generation), fixedError);
  assert.equal(called, false);
});

await test("proxy cannot switch kinds after validation", () => {
  const { generation } = fixture(); let gets = 0;
  generation.artifacts[0] = new Proxy(generation.artifacts[0], {
    get(target, key) { if (key === "kind") { gets++; return gets < 4 ? "database" : { toString: () => "database" }; } return target[key]; }
  });
  assert.throws(() => validateGeneration(generation), fixedError);
  assert.equal(gets, 0, "strict JSON input must reject Proxy before running its getters");
});

await test("full independent byte reread then manifest receipt", async () => {
  const context = fixture();
  const result = await finalizeGeneration(context.generation, adapters(context));
  boundary(result.evidence); boundary(result.manifest.evidence);
  assert.deepEqual(context.events.map((event) => event.action), ["read", "read", "read", "read", "read", "write", "read"]);
  const stored = context.objects.get(manifestKey(context.generation.runId));
  assert.deepEqual(JSON.parse(stored.bytes), result.manifest);
  assert.deepEqual(result.manifestReceipt, {
    key: manifestKey(context.generation.runId), versionId: stored.versionId,
    bytes: stored.bytes.length, sha256: sha256(stored.bytes)
  });
  assert.equal(result.manifest.manifestReceipt, undefined);
  assert.equal(result.manifest.sha256, undefined, "manifest cannot include its own hash");
});

await test("empty photo inventory is valid, but catalog is still required", async () => {
  const context = fixture({ photos: 0 });
  const result = await finalizeGeneration(context.generation, adapters(context));
  boundary(result.evidence);
  assert.equal(result.manifest.artifacts.length, 3);
});

await test("inventory order does not change its identity", async () => {
  const context = fixture(); context.generation.inventoryAfter.reverse();
  const result = await verifyGeneration(context.generation, { readObject: context.readObject });
  boundary(result.evidence);
  assert.equal(context.events.filter((item) => item.action === "write").length, 0);
});

await test("same-size content corruption is detected", async () => {
  const context = fixture(); context.objects.get(context.generation.artifacts[3].key).bytes[10] ^= 1;
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), fixedError);
  assert(!context.events.some((item) => item.action === "write"));
});

for (const [name, modify] of [
  ["wrong object version", (response) => { response.versionId = "unexpected-version"; }],
  ["wrong object key", (response) => { response.key = "backups/elsewhere"; }],
  ["truncated body", (response) => { response.body = (async function* () { yield Buffer.from("short"); })(); }],
  ["oversized body", (response) => { response.body = (async function* () { yield Buffer.alloc(1024); })(); }],
  ["text chunk", (response) => { response.body = (async function* () { yield sensitiveMarker; })(); }],
  ["empty chunks", (response) => { response.body = (async function* () { yield new Uint8Array(); })(); }],
  ["interrupted stream", (response) => { response.body = (async function* () { yield Buffer.from("partial"); throw new Error(sensitiveMarker); })(); }],
  ["not a stream", (response) => { response.body = Buffer.from("not-an-async-stream"); }]
]) await test(name, async () => {
  const context = fixture(); const original = context.readObject;
  context.readObject = async (...args) => { const response = await original(...args); modify(response); return response; };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), fixedError);
  assert(!context.events.some((item) => item.action === "write"));
});

await test("source mutation during await cannot change the sealed generation", async () => {
  const context = fixture(); const original = context.readObject;
  const originalSha = context.generation.artifacts[0].sha256;
  context.readObject = async (...args) => {
    context.generation.artifacts[0].sha256 = "f".repeat(64);
    return original(...args);
  };
  const result = await finalizeGeneration(context.generation, adapters(context));
  assert.equal(result.manifest.artifacts[0].sha256, originalSha);
});

for (const status of [409, 412, 500]) await test(`write status ${status} never succeeds or retries`, async () => {
  const context = fixture(); let writes = 0;
  context.writeManifest = async (request) => { writes++; return { status, key: request.key, versionId: "version-1" }; };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), fixedError);
  assert.equal(writes, 1);
});

await test("lost acknowledgement after storing manifest stays uncertain", async () => {
  const context = fixture(); const original = context.writeManifest;
  context.writeManifest = async (...args) => { await original(...args); throw new Error(sensitiveMarker); };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), (error) => {
    fixedError(error); assert.equal(error.code, "MANIFEST_WRITE_UNCERTAIN"); return true;
  });
  assert(context.objects.has(manifestKey(context.generation.runId)), "stored object cannot be assumed absent after timeout");
  assert.equal(context.events.filter((item) => item.action === "write").length, 1);
});

await test("corrupt manifest on independent reread stays uncertain", async () => {
  const context = fixture(); const original = context.writeManifest;
  context.writeManifest = async (...args) => {
    const response = await original(...args); context.objects.get(response.key).bytes[0] ^= 1; return response;
  };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), (error) => {
    fixedError(error); assert.equal(error.code, "MANIFEST_WRITE_UNCERTAIN"); return true;
  });
});

await test("missing returned manifest version does not issue a receipt", async () => {
  const context = fixture();
  context.writeManifest = async (request) => ({ status: 200, key: request.key, versionId: "null" });
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), fixedError);
});

await test("read timeout aborts and never writes completion", async () => {
  const context = fixture(); let seenSignal;
  context.readObject = async (_, { signal }) => { seenSignal = signal; return new Promise(() => {}); };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context, { timeoutMs: 10 })), fixedError);
  assert(seenSignal.aborted); assert.equal(context.events.length, 0);
});

await test("iterator that never advances cannot hold completion open", async () => {
  const context = fixture(); let seenSignal;
  context.readObject = async (request, { signal }) => {
    seenSignal = signal;
    return { ...request, body: { [Symbol.asyncIterator]() {
      return { next: () => new Promise(() => {}), return: () => new Promise(() => {}) };
    } } };
  };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context, { timeoutMs: 10 })), fixedError);
  assert(seenSignal.aborted); assert.equal(context.events.length, 0);
});

await test("stream exceeding one allowed chunk stops before completion", async () => {
  const context = fixture(); const original = context.readObject;
  let closed = false;
  context.readObject = async (...args) => {
    const response = await original(...args);
    response.body = (async function* () {
      try { yield new Uint8Array(8 * 1024 ** 2 + 1); }
      finally { closed = true; }
    })();
    return response;
  };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), fixedError);
  await Promise.resolve(); assert(closed);
  assert(!context.events.some((event) => event.action === "write"));
});

await test("caller cancellation aborts and never writes completion", async () => {
  const context = fixture(); const controller = new AbortController(); controller.abort();
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context, { signal: controller.signal })), fixedError);
  assert.equal(context.events.length, 0);
});

await test("fake AbortSignal is rejected before any adapter call", async () => {
  const context = fixture(); const signal = Object.create(AbortSignal.prototype);
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context, { signal })), fixedError);
  assert.equal(context.events.length, 0);
});

await test("typed array shadowed byteLength cannot falsify size", async () => {
  const context = fixture(); const original = context.readObject;
  context.readObject = async (...args) => {
    const response = await original(...args);
    const chunk = new Uint8Array(context.generation.artifacts[0].bytes + 1);
    Object.defineProperty(chunk, "byteLength", { value: context.generation.artifacts[0].bytes });
    response.body = (async function* () { yield chunk; })();
    return response;
  };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context)), (error) => {
    fixedError(error); assert.equal(error.code, "OBJECT_SIZE_MISMATCH"); return true;
  });
  assert(!context.events.some((event) => event.action === "write"));
});

await test("late successful write is not converted to accepted completion", async () => {
  const context = fixture(); let writes = 0; let seenSignal; let lateFinished = false;
  context.writeManifest = async (request, { signal }) => {
    writes++; seenSignal = signal;
    await delay(200); lateFinished = true;
    return { status: 200, key: request.key, versionId: "late-version" };
  };
  await assert.rejects(() => finalizeGeneration(context.generation, adapters(context, { timeoutMs: 100 })), (error) => {
    fixedError(error); assert.equal(error.code, "MANIFEST_WRITE_UNCERTAIN"); return true;
  });
  assert(seenSignal.aborted); await delay(220); assert(lateFinished); assert.equal(writes, 1);
});

console.log(JSON.stringify({ result: "BACKUP_GENERATION_TEST_PASS", cases,
  actualSyntheticStreamsHashed: true, realAws: "NOT_TESTED", realDbRestore: "NOT_TESTED",
  deletionCoverage: "NOT_VERIFIED", productionReady: false, credentialsRead: false, networkCalls: 0 }));
