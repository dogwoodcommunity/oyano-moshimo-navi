import { createHash } from "node:crypto";
import { types } from "node:util";
import { performance } from "node:perf_hooks";
import { artifactKey, createOpaqueId, validateGeneration } from "./backup-generation.mjs";

// Offline contract exercise only. It accepts injected synthetic adapters and
// deliberately rejects production source IDs. No credential, URL, SDK, or
// scheduler is loaded here; its output is a candidate, never a completion.
const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{64}$/;
const VERSION = /^[A-Za-z0-9._~+/=-]{1,256}$/;
const MAX_PHOTOS = 100;
const MAX_PAGES = 10;
const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_CHUNK_BYTES = 64 * 1024;
const MAX_DURATION_MS = 30_000;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;

export class SyntheticCollectionError extends Error {
  constructor(code) { super(code); this.name = "SyntheticCollectionError"; this.code = code; }
}
const fail = (code) => { throw new SyntheticCollectionError(code); };
const requireValue = (condition, code) => { if (!condition) fail(code); };
const exact = (value, keys, code) => {
  requireValue(value !== null && typeof value === "object" && !types.isProxy(value) && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).length === keys.length
    && Reflect.ownKeys(value).every((key) => keys.includes(key)
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")), code);
};
const check = (signal, deadline) => {
  if (performance.now() >= deadline) fail("COLLECTION_TIMEOUT");
  if (signal.aborted) fail("COLLECTION_ABORTED");
};
const safeCall = async (operation, code) => {
  try { return await operation(); }
  catch (error) { if (error instanceof SyntheticCollectionError) throw error; fail(code); }
};
const photoIdentity = (entry) => {
  exact(entry, ["id", "version"], "INVALID_PHOTO_INVENTORY");
  requireValue(typeof entry.id === "string" && ID.test(entry.id)
    && typeof entry.version === "string" && VERSION.test(entry.version)
    && entry.version.toLowerCase() !== "null", "INVALID_PHOTO_INVENTORY");
  return Object.freeze({ id: entry.id, version: entry.version });
};
const sortedInventory = (entries) => Object.freeze(entries.sort((a, b) => a.id.localeCompare(b.id)));

async function inventory(adapter, snapshotId, count, pass, signal, deadline) {
  const entries = [];
  const cursors = new Set();
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    check(signal, deadline);
    const result = await safeCall(() => adapter.listPhotos(Object.freeze({ snapshotId, cursor, pass }), { signal }), "PHOTO_PAGE_FAILED");
    check(signal, deadline);
    exact(result, ["snapshotId", "entries", "nextCursor"], "INVALID_PHOTO_PAGE");
    requireValue(result.snapshotId === snapshotId && !types.isProxy(result.entries) && Array.isArray(result.entries)
      && Object.getPrototypeOf(result.entries) === Array.prototype
      && result.entries.length <= 50
      && result.entries.every((_, index) => Object.hasOwn(result.entries, index)), "INVALID_PHOTO_PAGE");
    entries.push(...result.entries.map(photoIdentity));
    requireValue(entries.length <= MAX_PHOTOS && entries.length <= count, "PHOTO_COUNT_MISMATCH");
    if (result.nextCursor === null) {
      requireValue(entries.length === count && new Set(entries.map((item) => item.id)).size === count,
        "PHOTO_COUNT_MISMATCH");
      return sortedInventory(entries);
    }
    requireValue(typeof result.nextCursor === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(result.nextCursor)
      && !cursors.has(result.nextCursor) && result.entries.length > 0, "INVALID_PHOTO_PAGE");
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  fail("PHOTO_PAGE_LIMIT");
}

async function writeOne(adapter, snapshotId, runId, kind, photo, signal, deadline, state, remainingBytes) {
  check(signal, deadline);
  const source = await safeCall(() => adapter.readArtifact(Object.freeze({ snapshotId, kind, photo }), { signal }), "SOURCE_READ_FAILED");
  check(signal, deadline);
  exact(source, ["snapshotId", "sourceVersion", "body"], "INVALID_SOURCE_RESPONSE");
  requireValue(source.snapshotId === snapshotId && source.sourceVersion === (photo?.version ?? null)
    && source.body != null && typeof source.body[Symbol.asyncIterator] === "function", "INVALID_SOURCE_RESPONSE");
  const id = createOpaqueId();
  const key = artifactKey(runId, id);
  const digest = createHash("sha256");
  let bytes = 0;
  let complete = false;
  let submitted = false;
  const body = (async function* () {
    for await (const chunk of source.body) {
      check(signal, deadline);
      requireValue(chunk instanceof Uint8Array, "INVALID_SOURCE_CHUNK");
      const length = typedArrayByteLength.call(chunk);
      requireValue(length > 0 && length <= MAX_CHUNK_BYTES, "INVALID_SOURCE_CHUNK");
      bytes += length;
      requireValue(bytes <= MAX_ARTIFACT_BYTES, "ARTIFACT_TOO_LARGE");
      requireValue(bytes <= remainingBytes, "GENERATION_TOO_LARGE");
      digest.update(chunk);
      yield chunk;
    }
    complete = true;
  })();
  try {
    submitted = true;
    state.writePending = true;
    const response = await adapter.writeArtifact(Object.freeze({ key, kind, ifNoneMatch: "*", body }), { signal });
    check(signal, deadline);
    if (response?.status === 409 || response?.status === 412) fail("ARTIFACT_WRITE_CONFLICT");
    exact(response, ["status", "key", "versionId"], "ARTIFACT_WRITE_UNCERTAIN");
    requireValue(response.status === 200 && response.key === key && complete && bytes > 0
      && typeof response.versionId === "string" && VERSION.test(response.versionId)
      && response.versionId.toLowerCase() !== "null", "ARTIFACT_WRITE_UNCERTAIN");
    state.writePending = false;
    return { id, kind, key, versionId: response.versionId, bytes,
      sha256: digest.digest("hex"), photo };
  } catch (error) {
    if (error instanceof SyntheticCollectionError && error.code === "ARTIFACT_WRITE_CONFLICT") throw error;
    if (submitted) fail("ARTIFACT_WRITE_UNCERTAIN");
    fail("SOURCE_READ_FAILED");
  } finally {
    // A callback can resolve without draining the stream. Never treat that as
    // a complete upload; closing only releases the local iterator.
    if (!complete) try { await body.return?.(); } catch { /* no data in errors */ }
  }
}

export async function collectSyntheticCandidate(plan, adapter, options = { timeoutMs: MAX_DURATION_MS }) {
  exact(plan, ["runId", "sourceId", "sourceEpoch", "schemaHash", "releaseSha"], "INVALID_PLAN");
  requireValue(typeof plan.runId === "string" && ID.test(plan.runId)
    && typeof plan.sourceId === "string" && /^synthetic-[a-z0-9-]{1,64}$/.test(plan.sourceId)
    && typeof plan.sourceEpoch === "string" && /^[a-z0-9-]{1,64}$/.test(plan.sourceEpoch)
    && typeof plan.schemaHash === "string" && SHA.test(plan.schemaHash)
    && typeof plan.releaseSha === "string" && /^[a-f0-9]{40}$/.test(plan.releaseSha), "INVALID_PLAN");
  exact(adapter, ["openSnapshot", "listPhotos", "readArtifact", "writeArtifact", "closeSnapshot"], "INVALID_ADAPTER");
  requireValue(Object.values(adapter).every((method) => typeof method === "function"), "INVALID_ADAPTER");
  exact(options, ["timeoutMs"], "INVALID_OPTIONS");
  requireValue(Number.isSafeInteger(options.timeoutMs) && options.timeoutMs > 0
    && options.timeoutMs <= MAX_DURATION_MS, "INVALID_OPTIONS");
  // Never rely on caller-owned objects again after an awaited adapter call.
  const fixedPlan = Object.freeze({ ...plan });
  const fixedAdapter = Object.freeze({ ...adapter });
  const deadline = performance.now() + options.timeoutMs;
  const controller = new AbortController();
  const state = { writePending: false };
  let rejectTimeout;
  const timeout = new Promise((_, reject) => { rejectTimeout = reject; });
  const timer = setTimeout(() => { controller.abort(); rejectTimeout(new SyntheticCollectionError(
    state.writePending ? "ARTIFACT_WRITE_UNCERTAIN" : "COLLECTION_TIMEOUT")); }, options.timeoutMs);
  const startedAt = new Date().toISOString();
  try {
    const work = (async () => {
      let snapshot;
      try {
        snapshot = await safeCall(() => fixedAdapter.openSnapshot({ signal: controller.signal }), "SOURCE_OPEN_FAILED");
        check(controller.signal, deadline);
        exact(snapshot, ["snapshotId", "sourceId", "sourceEpoch", "schemaHash", "pgMajor", "photoCount"], "INVALID_SNAPSHOT");
        snapshot = Object.freeze({ ...snapshot });
        requireValue(typeof snapshot.snapshotId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(snapshot.snapshotId)
          && snapshot.sourceId === fixedPlan.sourceId && snapshot.sourceEpoch === fixedPlan.sourceEpoch
          && snapshot.schemaHash === fixedPlan.schemaHash && snapshot.pgMajor === 17
          && Number.isSafeInteger(snapshot.photoCount) && snapshot.photoCount >= 0
          && snapshot.photoCount <= MAX_PHOTOS, "SNAPSHOT_MISMATCH");
        const before = await inventory(fixedAdapter, snapshot.snapshotId, snapshot.photoCount, "before", controller.signal, deadline);
        const artifacts = [];
        let totalBytes = 0;
        for (const [kind, photo] of [
          ["database", null], ["roles", null], ["storage_catalog", null],
          ...before.map((item) => ["photo", item])
        ]) {
          const artifact = await writeOne(fixedAdapter, snapshot.snapshotId, fixedPlan.runId, kind, photo,
            controller.signal, deadline, state, MAX_TOTAL_BYTES - totalBytes);
          artifacts.push(artifact);
          totalBytes += artifact.bytes;
          requireValue(totalBytes <= MAX_TOTAL_BYTES, "GENERATION_TOO_LARGE");
        }
        const after = await inventory(fixedAdapter, snapshot.snapshotId, snapshot.photoCount, "after", controller.signal, deadline);
        requireValue(JSON.stringify(before) === JSON.stringify(after), "SOURCE_INVENTORY_CHANGED");
        check(controller.signal, deadline);
        const generation = validateGeneration({ schemaVersion: 1, runId: fixedPlan.runId,
          releaseSha: fixedPlan.releaseSha, startedAt, finishedAt: new Date().toISOString(),
          inventoryBefore: before, inventoryAfter: after, artifacts });
        return Object.freeze({ generation, sourceSnapshotId: snapshot.snapshotId,
          status: "CANDIDATE_ONLY", publicReleaseAllowed: false, productionReady: false });
      } finally {
        if (snapshot) await safeCall(() => fixedAdapter.closeSnapshot(Object.freeze({ snapshotId: snapshot.snapshotId }),
          { signal: AbortSignal.timeout(1000) }), "SOURCE_CLOSE_FAILED");
      }
    })();
    return await Promise.race([work, timeout]);
  } catch (error) {
    if (error instanceof SyntheticCollectionError) throw error;
    fail("COLLECTION_FAILED");
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
