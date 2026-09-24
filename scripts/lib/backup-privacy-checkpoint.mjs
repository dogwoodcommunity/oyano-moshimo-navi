import { createHmac } from "node:crypto";
import { types } from "node:util";

// Pure, offline contract. A source adapter must prove table coverage and the
// snapshot boundary; this module cannot attest that a live database was read.
const SHA = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9._:-]{1,128}$/;
const TABLE = /^(?:public|auth|storage|account_delete_private|push_private)\.[a-z_][a-z0-9_]*$/;
const MAX_ROWS = 250_000;
const MAX_TABLES = 150;

export class PrivacyCheckpointError extends Error {
  constructor(code) { super(code); this.name = "PrivacyCheckpointError"; this.code = code; }
}
const fail = (code) => { throw new PrivacyCheckpointError(code); };
const requireValue = (ok, code) => { if (!ok) fail(code); };
const plain = (value) => value !== null && typeof value === "object" && !types.isProxy(value)
  && Object.getPrototypeOf(value) === Object.prototype;
function exact(value, keys, code = "INVALID_CHECKPOINT") {
  requireValue(plain(value) && Reflect.ownKeys(value).length === keys.length
    && Reflect.ownKeys(value).every((key) => keys.includes(key)
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")), code);
}
function array(value, maximum, code = "INVALID_CHECKPOINT") {
  requireValue(Array.isArray(value) && !types.isProxy(value) && Object.getPrototypeOf(value) === Array.prototype
    && value.length <= maximum && Reflect.ownKeys(value).length === value.length + 1
    && value.every((_, index) => Object.hasOwn(value, index)), code);
}
function utc(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  requireValue(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
    && Number.isFinite(parsed) && new Date(parsed).toISOString() === value, "INVALID_TIME");
  return parsed;
}

// Stable JSON serialization excludes unsupported values, getters, cycles,
// proxies, sparse arrays, and ambiguous non-finite numeric values.
function canonical(value, depth = 0, seen = new WeakSet()) {
  requireValue(depth <= 24, "INVALID_ROW");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    requireValue(Number.isFinite(value), "INVALID_ROW");
    return JSON.stringify(value);
  }
  requireValue(value !== null && typeof value === "object" && !types.isProxy(value) && !seen.has(value), "INVALID_ROW");
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      array(value, MAX_ROWS, "INVALID_ROW");
      return `[${value.map((item) => canonical(item, depth + 1, seen)).join(",")}]`;
    }
    requireValue(plain(value), "INVALID_ROW");
    const keys = Reflect.ownKeys(value);
    requireValue(keys.every((key) => typeof key === "string"
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")), "INVALID_ROW");
    return `{${keys.sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key], depth + 1, seen)}`).join(",")}}`;
  } finally { seen.delete(value); }
}

function digest(key, domain, value) {
  return createHmac("sha256", key).update(domain).update("\0").update(value).digest("hex");
}

export function createPrivacyCheckpoint(input, hmacKey) {
  requireValue(Buffer.isBuffer(hmacKey) && hmacKey.length >= 32, "INVALID_KEY");
  exact(input, ["sourceId", "sourceEpoch", "schemaHash", "keyVersion", "snapshotId", "capturedAt", "expectedTables", "tables"]);
  for (const field of ["sourceId", "sourceEpoch", "keyVersion", "snapshotId"])
    requireValue(typeof input[field] === "string" && ID.test(input[field]), "INVALID_SOURCE");
  requireValue(typeof input.schemaHash === "string" && SHA.test(input.schemaHash), "INVALID_SCHEMA");
  utc(input.capturedAt);
  array(input.expectedTables, MAX_TABLES);
  array(input.tables, MAX_TABLES);
  requireValue(input.expectedTables.length > 0 && input.tables.length === input.expectedTables.length, "TABLE_COVERAGE_UNPROVEN");
  requireValue(input.expectedTables.every((name) => typeof name === "string" && TABLE.test(name))
    && new Set(input.expectedTables).size === input.expectedTables.length, "INVALID_SCHEMA");
  const expected = [...input.expectedTables].sort();
  const actual = input.tables.map((table) => {
    exact(table, ["name", "rows"]);
    return table.name;
  }).sort();
  requireValue(JSON.stringify(expected) === JSON.stringify(actual), "TABLE_COVERAGE_UNPROVEN");
  let totalRows = 0;
  const result = input.tables.map((table) => {
    array(table.rows, MAX_ROWS);
    totalRows += table.rows.length;
    requireValue(totalRows <= MAX_ROWS, "TOO_MANY_ROWS");
    const identities = new Set();
    const rows = table.rows.map((row) => {
      exact(row, ["id", "scopes", "body"], "INVALID_ROW");
      requireValue(typeof row.id === "string" && row.id.length > 0 && row.id.length <= 512, "INVALID_ROW");
      array(row.scopes, 8, "INVALID_SCOPE");
      requireValue(row.scopes.length > 0, "INVALID_SCOPE");
      const rowId = digest(hmacKey, "row-id-v1", canonical([table.name, row.id]));
      requireValue(!identities.has(rowId), "DUPLICATE_ROW");
      identities.add(rowId);
      const scopes = row.scopes.map((scope) => {
        exact(scope, ["kind", "id"], "INVALID_SCOPE");
        requireValue(["family", "user", "global"].includes(scope.kind)
          && typeof scope.id === "string" && scope.id.length > 0 && scope.id.length <= 512,
        "INVALID_SCOPE");
        return digest(hmacKey, "scope-v1", canonical([scope.kind, scope.id]));
      });
      requireValue(new Set(scopes).size === scopes.length, "DUPLICATE_SCOPE");
      const body = canonical(row.body);
      requireValue(Buffer.byteLength(body) <= 2 * 1024 * 1024, "INVALID_ROW");
      return { rowId, bodyDigest: digest(hmacKey, "row-body-v1", body), scopes: scopes.sort() };
    });
    rows.sort((left, right) => left.rowId.localeCompare(right.rowId));
    return { name: table.name, rows };
  }).sort((left, right) => left.name.localeCompare(right.name));
  return Object.freeze({
    schemaVersion: 1, sourceId: input.sourceId, sourceEpoch: input.sourceEpoch,
    schemaHash: input.schemaHash, keyVersion: input.keyVersion,
    snapshotId: input.snapshotId, capturedAt: input.capturedAt,
    expectedTables: expected, tables: result, rowCount: totalRows,
    publicReleaseAllowed: false,
  });
}

function validateCheckpoint(value) {
  exact(value, ["schemaVersion", "sourceId", "sourceEpoch", "schemaHash", "keyVersion", "snapshotId",
    "capturedAt", "expectedTables", "tables", "rowCount", "publicReleaseAllowed"]);
  requireValue(value.schemaVersion === 1 && value.publicReleaseAllowed === false, "INVALID_CHECKPOINT");
  utc(value.capturedAt);
  array(value.expectedTables, MAX_TABLES);
  array(value.tables, MAX_TABLES);
  requireValue(value.expectedTables.length > 0 && value.tables.length === value.expectedTables.length
    && JSON.stringify(value.expectedTables) === JSON.stringify(value.tables.map((table) => table.name)), "TABLE_COVERAGE_UNPROVEN");
  requireValue(value.expectedTables.every((name) => typeof name === "string" && TABLE.test(name))
    && new Set(value.expectedTables).size === value.expectedTables.length, "INVALID_SCHEMA");
  let rowCount = 0;
  for (const table of value.tables) {
    exact(table, ["name", "rows"]);
    array(table.rows, MAX_ROWS);
    rowCount += table.rows.length;
    const ids = new Set();
    for (const row of table.rows) {
      exact(row, ["rowId", "bodyDigest", "scopes"]);
      requireValue(typeof row.rowId === "string" && SHA.test(row.rowId)
        && typeof row.bodyDigest === "string" && SHA.test(row.bodyDigest), "INVALID_CHECKPOINT");
      requireValue(!ids.has(row.rowId), "DUPLICATE_ROW");
      ids.add(row.rowId);
      array(row.scopes, 8);
      requireValue(row.scopes.length > 0 && row.scopes.every((scope) => typeof scope === "string" && SHA.test(scope)), "INVALID_SCOPE");
    }
  }
  requireValue(Number.isSafeInteger(value.rowCount) && value.rowCount === rowCount && rowCount <= MAX_ROWS,
    "INVALID_CHECKPOINT");
}

export function comparePrivacyCheckpoints(backup, latest) {
  validateCheckpoint(backup); validateCheckpoint(latest);
  for (const field of ["sourceId", "sourceEpoch", "schemaHash", "keyVersion"]) {
    requireValue(backup[field] === latest[field], "CHECKPOINT_INCOMPARABLE");
  }
  requireValue(JSON.stringify(backup.expectedTables) === JSON.stringify(latest.expectedTables), "CHECKPOINT_INCOMPARABLE");
  requireValue(Date.parse(latest.capturedAt) >= Date.parse(backup.capturedAt), "CHECKPOINT_TOO_OLD");
  const changes = [];
  const isolated = new Set();
  for (let index = 0; index < backup.tables.length; index++) {
    const oldTable = backup.tables[index];
    const liveTable = latest.tables[index];
    const live = new Map(liveTable.rows.map((row) => [row.rowId, row]));
    for (const oldRow of oldTable.rows) {
      const current = live.get(oldRow.rowId);
      if (current && oldRow.bodyDigest === current.bodyDigest
        && JSON.stringify(oldRow.scopes) === JSON.stringify(current.scopes)) continue;
      for (const scope of oldRow.scopes) isolated.add(scope);
      for (const scope of current?.scopes ?? []) isolated.add(scope);
      changes.push({ table: oldTable.name, rowId: oldRow.rowId,
        kind: current ? "CHANGED" : "REMOVED" });
    }
  }
  return Object.freeze({ publicReleaseAllowed: false,
    status: changes.length ? "ISOLATION_REQUIRED" : "NO_OLDER_ROW_DIFFERENCE",
    changes: changes.sort((a, b) => `${a.table}:${a.rowId}`.localeCompare(`${b.table}:${b.rowId}`)),
    isolatedScopeHashes: [...isolated].sort(),
    laterRowsNotRecovered: latest.rowCount - backup.rowCount + changes.filter((change) => change.kind === "REMOVED").length,
  });
}

export function assessIsolatedRestore(input) {
  exact(input, ["backup", "latest", "bytesVerified", "isolationVerified", "sourceAvailable", "cutoffVerified"]);
  requireValue(typeof input.bytesVerified === "boolean" && typeof input.isolationVerified === "boolean"
    && typeof input.sourceAvailable === "boolean" && typeof input.cutoffVerified === "boolean", "INVALID_EVIDENCE");
  // These booleans are local evidence inputs, not cryptographic attestations.
  if (!input.sourceAvailable || !input.latest) return Object.freeze({
    publicReleaseAllowed: false, status: "BLOCKED", reason: "SOURCE_COVERAGE_UNPROVEN" });
  const comparison = comparePrivacyCheckpoints(input.backup, input.latest);
  if (!input.bytesVerified || !input.isolationVerified || !input.cutoffVerified) return Object.freeze({
    publicReleaseAllowed: false, status: "BLOCKED", reason: "RESTORE_EVIDENCE_INCOMPLETE",
    isolatedScopeHashes: comparison.isolatedScopeHashes });
  return Object.freeze({ publicReleaseAllowed: false, status: "HUMAN_REVIEW_REQUIRED",
    isolatedScopeHashes: comparison.isolatedScopeHashes, changeCount: comparison.changes.length });
}
