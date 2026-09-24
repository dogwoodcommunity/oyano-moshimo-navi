import { createHash, randomBytes } from "node:crypto";
import { types } from "node:util";
import { validatePrivacyCheckpoint } from "./backup-privacy-checkpoint.mjs";
import { classifySourceCatalog } from "./backup-source-catalog.mjs";

// This module has no storage, credentials or deployment adapter. Its evidence is
// byte integrity only: it cannot certify a DB snapshot, deletion replay or restore.
export const LIMITS = Object.freeze({
  maxArtifacts: 10_000,
  maxArtifactBytes: 256 * 1024 ** 3,
  maxTotalBytes: 1024 ** 4,
  maxChunkBytes: 8 * 1024 ** 2,
  maxChunks: 2_000_000,
  maxManifestBytes: 8 * 1024 ** 2,
  maxDurationMs: 24 * 60 * 60 * 1000,
  defaultTimeoutMs: 30_000,
  maxTimeoutMs: 60 * 60 * 1000,
});

const EVIDENCE = Object.freeze({
  scope: "BYTE_INTEGRITY_ONLY",
  productionReady: false,
  deletionCoverage: "NOT_VERIFIED",
  semanticRestore: "NOT_VERIFIED",
  sourceSnapshotConsistency: "NOT_VERIFIED",
});
const ID = /^[a-f0-9]{32}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const VERSION = /^[A-Za-z0-9._~+/=-]{1,256}$/;
const GENERATION_KEYS = ["schemaVersion", "runId", "startedAt", "finishedAt", "releaseSha", "inventoryBefore", "inventoryAfter", "artifacts"];
const SOURCE_BINDING_KEYS = ["sourceId", "sourceEpoch", "schemaHash", "allowlistSha256", "snapshotId",
  "pgMajor", "sealedTables", "excludedTables", "roleCatalogSha256", "storageCatalogSha256",
  "globalScopeHash", "baselineRowCount"];
const SOURCE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const TABLE = /^(?:public|auth|storage|account_delete_private|push_private)\.[a-z_][a-z0-9_]*$/;
const DEADLINES = new WeakMap();
const typedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
const signalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted").get;

class ProtocolError extends Error {
  constructor(code) {
    super(code);
    this.name = "BackupGenerationError";
    this.code = code;
  }
}
const fail = (code) => { throw new ProtocolError(code); };
const requireValue = (condition, code = "INVALID_GENERATION") => { if (!condition) fail(code); };
const isId = (value) => typeof value === "string" && ID.test(value);
const isVersion = (value) => typeof value === "string" && VERSION.test(value) && value.toLowerCase() !== "null";

function exactObject(value, keys, code = "INVALID_GENERATION") {
  requireValue(value !== null && typeof value === "object" && !types.isProxy(value) && Object.getPrototypeOf(value) === Object.prototype, code);
  const own = Reflect.ownKeys(value);
  requireValue(own.length === keys.length && own.every((key) => keys.includes(key)), code);
  requireValue(own.every((key) => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")), code);
}

function exactArray(value, maxLength) {
  requireValue(!types.isProxy(value) && Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length <= maxLength);
  requireValue(Reflect.ownKeys(value).length === value.length + 1);
  for (let i = 0; i < value.length; i += 1) {
    requireValue(Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(i)) ?? {}, "value"));
  }
}

function timestamp(value) {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value));
  const time = Date.parse(value);
  requireValue(Number.isFinite(time) && new Date(time).toISOString() === value);
  return time;
}

function photoReference(value) {
  exactObject(value, ["id", "version"]);
  requireValue(isId(value.id) && isVersion(value.version));
  return Object.freeze({ id: value.id, version: value.version });
}

function inventory(value, reservedArtifacts = 3) {
  exactArray(value, LIMITS.maxArtifacts - reservedArtifacts);
  const result = value.map(photoReference).sort((left, right) => left.id.localeCompare(right.id));
  requireValue(new Set(result.map((photo) => photo.id)).size === result.length, "DUPLICATE_INVENTORY");
  return Object.freeze(result);
}

function sourceBinding(value) {
  exactObject(value, SOURCE_BINDING_KEYS);
  for (const field of ["sourceId", "sourceEpoch", "snapshotId"])
    requireValue(typeof value[field] === "string" && SOURCE_ID.test(value[field]));
  for (const field of ["schemaHash", "allowlistSha256", "roleCatalogSha256", "storageCatalogSha256", "globalScopeHash"])
    requireValue(typeof value[field] === "string" && SHA256.test(value[field]));
  requireValue(value.pgMajor === 17 && Number.isSafeInteger(value.baselineRowCount)
    && value.baselineRowCount >= 0 && value.baselineRowCount <= 250_000);
  exactArray(value.sealedTables, 150);
  const sealedTables = [...value.sealedTables].sort();
  requireValue(sealedTables.length > 0 && sealedTables.every((name) => typeof name === "string" && TABLE.test(name))
    && new Set(sealedTables).size === sealedTables.length);
  exactArray(value.excludedTables, 150);
  const excludedTables = value.excludedTables.map((entry) => {
    exactObject(entry, ["name", "reason"]);
    requireValue(typeof entry.name === "string" && TABLE.test(entry.name)
      && ["rebuildable", "secret"].includes(entry.reason));
    return Object.freeze({ name: entry.name, reason: entry.reason });
  }).sort((a, b) => a.name.localeCompare(b.name));
  requireValue(new Set(excludedTables.map((item) => item.name)).size === excludedTables.length);
  requireValue(excludedTables.every((item) => !sealedTables.includes(item.name)));
  return Object.freeze({ sourceId: value.sourceId, sourceEpoch: value.sourceEpoch,
    schemaHash: value.schemaHash, allowlistSha256: value.allowlistSha256,
    snapshotId: value.snapshotId, pgMajor: 17, sealedTables: Object.freeze(sealedTables),
    excludedTables: Object.freeze(excludedTables),
    roleCatalogSha256: value.roleCatalogSha256, storageCatalogSha256: value.storageCatalogSha256,
    globalScopeHash: value.globalScopeHash, baselineRowCount: value.baselineRowCount });
}

export function createOpaqueId() { return randomBytes(16).toString("hex"); }

export function artifactKey(runId, id) {
  requireValue(isId(runId) && isId(id) && runId !== id);
  return `backups/${runId}/artifacts/${id}`;
}

export function manifestKey(runId) {
  requireValue(isId(runId));
  return `backups/${runId}/complete.json`;
}

// Take a deeply frozen copy before the first await. Later caller mutations cannot
// substitute a path, expected digest, source inventory, or the final manifest.
function validateGenerationInput(input) {
  requireValue(input !== null && typeof input === "object" && !types.isProxy(input)
    && Object.getPrototypeOf(input) === Object.prototype);
  const version = Object.getOwnPropertyDescriptor(input, "schemaVersion")?.value;
  exactObject(input, version === 2 ? [...GENERATION_KEYS, "sourceBinding"] : GENERATION_KEYS);
  requireValue((version === 1 || version === 2) && isId(input.runId));
  const binding = version === 2 ? sourceBinding(input.sourceBinding) : null;
  requireValue(typeof input.releaseSha === "string" && /^[a-f0-9]{40}$/.test(input.releaseSha));
  const duration = timestamp(input.finishedAt) - timestamp(input.startedAt);
  requireValue(duration >= 0 && duration <= LIMITS.maxDurationMs);
  const before = inventory(input.inventoryBefore, version === 2 ? 5 : 3);
  const after = inventory(input.inventoryAfter, version === 2 ? 5 : 3);
  requireValue(JSON.stringify(before) === JSON.stringify(after), "INVENTORY_CHANGED");
  exactArray(input.artifacts, LIMITS.maxArtifacts);
  requireValue(input.artifacts.length === before.length + (version === 2 ? 5 : 3), "ARTIFACT_INVENTORY_MISMATCH");
  const ids = new Set();
  const photos = new Map();
  const counts = { database: 0, roles: 0, storage_catalog: 0,
    source_contract: 0, baseline_checkpoint: 0, photo: 0 };
  let total = 0;
  const artifacts = input.artifacts.map((artifact) => {
    exactObject(artifact, ["id", "kind", "key", "versionId", "bytes", "sha256", "photo"]);
    requireValue(isId(artifact.id) && artifact.key === artifactKey(input.runId, artifact.id));
    requireValue(!ids.has(artifact.id), "DUPLICATE_ARTIFACT");
    ids.add(artifact.id);
    requireValue(typeof artifact.kind === "string" && Object.hasOwn(counts, artifact.kind));
    requireValue(isVersion(artifact.versionId));
    requireValue(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0 && artifact.bytes <= LIMITS.maxArtifactBytes);
    requireValue(typeof artifact.sha256 === "string" && SHA256.test(artifact.sha256));
    total += artifact.bytes;
    requireValue(total <= LIMITS.maxTotalBytes);
    counts[artifact.kind] += 1;
    let photo = null;
    if (artifact.kind === "photo") {
      photo = photoReference(artifact.photo);
      requireValue(!photos.has(photo.id), "DUPLICATE_PHOTO");
      photos.set(photo.id, photo.version);
    } else requireValue(artifact.photo === null);
    return Object.freeze({ id: artifact.id, kind: artifact.kind, key: artifact.key,
      versionId: artifact.versionId, bytes: artifact.bytes, sha256: artifact.sha256, photo });
  }).sort((left, right) => left.id.localeCompare(right.id));
  requireValue(counts.database === 1 && counts.roles === 1 && counts.storage_catalog === 1, "REQUIRED_ARTIFACT_MISSING");
  requireValue(counts.source_contract === (version === 2 ? 1 : 0)
    && counts.baseline_checkpoint === (version === 2 ? 1 : 0), "REQUIRED_ARTIFACT_MISSING");
  if (binding) {
    requireValue(artifacts.find((item) => item.kind === "roles").sha256 === binding.roleCatalogSha256
      && artifacts.find((item) => item.kind === "storage_catalog").sha256 === binding.storageCatalogSha256,
    "SOURCE_BINDING_MISMATCH");
  }
  requireValue(photos.size === before.length && before.every((photo) => photos.get(photo.id) === photo.version), "ARTIFACT_INVENTORY_MISMATCH");
  return Object.freeze({ schemaVersion: version, runId: input.runId, startedAt: input.startedAt,
    finishedAt: input.finishedAt, releaseSha: input.releaseSha, inventoryBefore: before,
    inventoryAfter: after, artifacts: Object.freeze(artifacts),
    ...(binding ? { sourceBinding: binding } : {}) });
}

export function validateGeneration(input) {
  try { return validateGenerationInput(input); }
  catch (error) {
    if (error instanceof ProtocolError) throw error;
    fail("INVALID_GENERATION");
  }
}

function checkSignal(signal) {
  if (signal.aborted) fail(signal.reason === "TIMEOUT" ? "GENERATION_TIMEOUT" : "GENERATION_ABORTED");
  // An immediately resolving iterator can keep the microtask queue busy and delay
  // timer callbacks. Check elapsed time at each boundary as well as using a timer.
  const deadline = DEADLINES.get(signal);
  if (deadline && performance.now() >= deadline.at) {
    deadline.expire();
    fail("GENERATION_TIMEOUT");
  }
}

// A deadline never turns an uncertain write into success. Adapters must honor the
// signal too; cancellation cannot guarantee that a submitted remote write stopped.
async function withDeadline(options, operation, writing) {
  const timeoutMs = options.timeoutMs ?? LIMITS.defaultTimeoutMs;
  requireValue(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= LIMITS.maxTimeoutMs, "INVALID_ADAPTER_OPTIONS");
  const controller = new AbortController();
  let rejectCancellation;
  const cancelled = new Promise((_, reject) => { rejectCancellation = reject; });
  const cancel = (reason) => {
    if (controller.signal.aborted) return;
    controller.abort(reason);
    rejectCancellation(new ProtocolError(writing() ? "MANIFEST_WRITE_UNCERTAIN"
      : reason === "TIMEOUT" ? "GENERATION_TIMEOUT" : "GENERATION_ABORTED"));
  };
  DEADLINES.set(controller.signal, { at: performance.now() + timeoutMs, expire: () => cancel("TIMEOUT") });
  const onAbort = () => cancel("ABORTED");
  if (options.signal) EventTarget.prototype.addEventListener.call(options.signal, "abort", onAbort, { once: true });
  const timer = setTimeout(() => cancel("TIMEOUT"), timeoutMs);
  if (options.signal && signalAborted.call(options.signal)) cancel("ABORTED");
  try {
    return await Promise.race([cancelled, Promise.resolve().then(() => {
      checkSignal(controller.signal);
      return operation(controller.signal);
    })]);
  } finally {
    clearTimeout(timer);
    if (options.signal) EventTarget.prototype.removeEventListener.call(options.signal, "abort", onAbort);
  }
}

function validateOptionsInput(options, finalize) {
  requireValue(options !== null && typeof options === "object" && !types.isProxy(options) && Object.getPrototypeOf(options) === Object.prototype, "INVALID_ADAPTER_OPTIONS");
  const allowed = ["readObject", "timeoutMs", "signal", ...(finalize ? ["writeManifest"] : [])];
  requireValue(Reflect.ownKeys(options).every((key) => allowed.includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), "value")), "INVALID_ADAPTER_OPTIONS");
  requireValue(typeof options.readObject === "function" && (!finalize || typeof options.writeManifest === "function"), "INVALID_ADAPTER_OPTIONS");
  if (options.signal !== undefined) signalAborted.call(options.signal);
  return { readObject: options.readObject, writeManifest: options.writeManifest, timeoutMs: options.timeoutMs, signal: options.signal };
}

function validateOptions(options, finalize) {
  try { return validateOptionsInput(options, finalize); }
  catch (error) {
    if (error instanceof ProtocolError) throw error;
    fail("INVALID_ADAPTER_OPTIONS");
  }
}

async function verifyObject(expected, readObject, signal, capture = false) {
  let iterator;
  let finished = false;
  const captured = [];
  try {
    checkSignal(signal);
    const response = await readObject(Object.freeze({ key: expected.key, versionId: expected.versionId }), { signal });
    checkSignal(signal);
    exactObject(response, ["key", "versionId", "body"], "INVALID_OBJECT_RESPONSE");
    requireValue(response.key === expected.key && response.versionId === expected.versionId, "OBJECT_VERSION_MISMATCH");
    requireValue(response.body != null && typeof response.body[Symbol.asyncIterator] === "function", "INVALID_OBJECT_BODY");
    iterator = response.body[Symbol.asyncIterator]();
    requireValue(iterator != null && typeof iterator.next === "function", "INVALID_OBJECT_BODY");
    const hash = createHash("sha256");
    let bytes = 0;
    let chunks = 0;
    while (true) {
      const item = await iterator.next();
      checkSignal(signal);
      requireValue(item !== null && typeof item === "object" && typeof item.done === "boolean", "INVALID_OBJECT_BODY");
      if (item.done) { finished = true; break; }
      const chunk = item.value;
      requireValue(chunk instanceof Uint8Array, "INVALID_OBJECT_CHUNK");
      const chunkBytes = typedArrayByteLength.call(chunk);
      requireValue(chunkBytes > 0 && chunkBytes <= LIMITS.maxChunkBytes, "INVALID_OBJECT_CHUNK");
      bytes += chunkBytes;
      chunks += 1;
      requireValue(bytes <= expected.bytes && chunks <= LIMITS.maxChunks, "OBJECT_SIZE_MISMATCH");
      if (capture) {
        requireValue(bytes <= 8 * 1024 * 1024, "SEMANTIC_ARTIFACT_TOO_LARGE");
        captured.push(Buffer.from(chunk));
      }
      hash.update(chunk);
    }
    requireValue(bytes === expected.bytes, "OBJECT_SIZE_MISMATCH");
    requireValue(hash.digest("hex") === expected.sha256, "OBJECT_HASH_MISMATCH");
    return capture ? Buffer.concat(captured) : null;
  } catch (error) {
    if (error instanceof ProtocolError) throw error;
    fail("OBJECT_READ_FAILED");
  } finally {
    // Do not await an untrusted iterator's cleanup; it may never settle.
    if (iterator && !finished) {
      try { Promise.resolve(iterator.return?.()).catch(() => {}); } catch { /* no sensitive error propagation */ }
    }
  }
}

async function verifyArtifacts(generation, readObject, signal) {
  const semantic = new Map();
  for (const artifact of generation.artifacts) {
    const capture = generation.schemaVersion === 2
      && ["source_contract", "baseline_checkpoint"].includes(artifact.kind);
    const bytes = await verifyObject(artifact, readObject, signal, capture);
    if (capture) semantic.set(artifact.kind, bytes);
  }
  checkSignal(signal);
  if (generation.schemaVersion === 2) verifyV2Evidence(generation, semantic);
}

function parseSemantic(bytes, code) {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail(code); }
}

function verifyV2Evidence(generation, semantic) {
  try {
    const source = parseSemantic(semantic.get("source_contract"), "SOURCE_CONTRACT_INVALID");
    exactObject(source, ["binding", "allowlist"], "SOURCE_CONTRACT_INVALID");
    const binding = sourceBinding(source.binding);
    requireValue(SOURCE_BINDING_KEYS.every((key) =>
      JSON.stringify(binding[key]) === JSON.stringify(generation.sourceBinding[key])), "SOURCE_BINDING_MISMATCH");
    exactArray(source.allowlist, 150);
    const observed = source.allowlist.map((table) => {
      exactObject(table, ["name", "columns", "primaryKey", "classification"], "SOURCE_CONTRACT_INVALID");
      return { name: table.name, columns: table.columns, primaryKey: table.primaryKey };
    });
    const catalog = classifySourceCatalog(observed, source.allowlist);
    requireValue(catalog.allowlistSha256 === binding.allowlistSha256
      && JSON.stringify(catalog.sealed.map((item) => item.name)) === JSON.stringify(binding.sealedTables)
      && JSON.stringify(catalog.excluded.map((item) => ({ name: item.name,
        reason: item.classification === "secret_excluded" ? "secret" : "rebuildable" })))
        === JSON.stringify(binding.excludedTables), "SOURCE_BINDING_MISMATCH");
    const baseline = parseSemantic(semantic.get("baseline_checkpoint"), "BASELINE_INVALID");
    validatePrivacyCheckpoint(baseline);
    requireValue(baseline.sourceId === binding.sourceId && baseline.sourceEpoch === binding.sourceEpoch
      && baseline.schemaHash === binding.schemaHash && baseline.snapshotId === binding.snapshotId
      && baseline.rowCount === binding.baselineRowCount
      && JSON.stringify(baseline.expectedTables) === JSON.stringify(binding.sealedTables)
      && baseline.tables.every((table) => table.rows.every((row) => row.scopes.includes(binding.globalScopeHash))),
    "BASELINE_BINDING_MISMATCH");
  } catch (error) {
    if (error instanceof ProtocolError) throw error;
    // Do not expose parsed content, paths or underlying checkpoint failures.
    fail("SEMANTIC_EVIDENCE_INVALID");
  }
}

export async function verifyGeneration(input, adapterOptions) {
  const generation = validateGeneration(input);
  const options = validateOptions(adapterOptions, false);
  return withDeadline(options, async (signal) => {
    await verifyArtifacts(generation, options.readObject, signal);
    return Object.freeze({ generation, evidence: EVIDENCE });
  }, () => false);
}

export async function finalizeGeneration(input, adapterOptions) {
  const generation = validateGeneration(input);
  const options = validateOptions(adapterOptions, true);
  const manifest = Object.freeze({ ...generation, evidence: EVIDENCE });
  const body = new TextEncoder().encode(JSON.stringify(manifest));
  requireValue(body.byteLength <= LIMITS.maxManifestBytes, "MANIFEST_TOO_LARGE");
  const expected = { key: manifestKey(generation.runId), bytes: body.byteLength,
    sha256: createHash("sha256").update(body).digest("hex") };
  let submitted = false;
  return withDeadline(options, async (signal) => {
    await verifyArtifacts(generation, options.readObject, signal);
    checkSignal(signal);
    submitted = true;
    try {
      const response = await options.writeManifest(Object.freeze({ key: expected.key, ifNoneMatch: "*", body }), { signal });
      checkSignal(signal);
      exactObject(response, ["status", "key", "versionId"], "MANIFEST_WRITE_UNCERTAIN");
      requireValue(response.status !== 409 && response.status !== 412, "MANIFEST_WRITE_REJECTED");
      requireValue(response.status === 200 && response.key === expected.key && isVersion(response.versionId), "MANIFEST_WRITE_UNCERTAIN");
      const manifestReceipt = Object.freeze({ ...expected, versionId: response.versionId });
      // The manifest cannot contain its own hash or version. Read the separately
      // acknowledged version back and verify its bytes before returning a receipt.
      await verifyObject(manifestReceipt, options.readObject, signal);
      checkSignal(signal);
      return Object.freeze({ manifest, manifestReceipt, evidence: EVIDENCE });
    } catch (error) {
      if (error instanceof ProtocolError && error.code === "MANIFEST_WRITE_REJECTED") throw error;
      fail("MANIFEST_WRITE_UNCERTAIN");
    }
  }, () => submitted);
}
