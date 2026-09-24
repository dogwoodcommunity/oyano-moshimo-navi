import { createHash } from "node:crypto";
import { types } from "node:util";

// Offline catalog contract. The caller must obtain a real exported snapshot and
// trustworthy allowlist separately; matching this structure is not source proof.
const TABLE = /^(?:public|auth|storage|account_delete_private|push_private)\.[a-z_][a-z0-9_]*$/;
const COLUMN = /^[a-z_][a-z0-9_]*$/;
const SUPPORTED = /^(?:uuid|text|boolean|integer|bigint|numeric(?:\([1-9][0-9]?,[0-9]{1,2}\))?|timestamp with time zone|jsonb)$/;
const MAX_TABLES = 150;
const MAX_COLUMNS = 150;

export class SourceCatalogError extends Error {
  constructor(code) { super(code); this.name = "SourceCatalogError"; this.code = code; }
}
const fail = (code) => { throw new SourceCatalogError(code); };
const requireValue = (ok, code) => { if (!ok) fail(code); };
function exact(value, keys, code) {
  requireValue(value !== null && typeof value === "object" && !types.isProxy(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).length === keys.length
    && Reflect.ownKeys(value).every((key) => keys.includes(key)
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")), code);
}
function array(value, max, code) {
  requireValue(Array.isArray(value) && !types.isProxy(value)
    && Object.getPrototypeOf(value) === Array.prototype && value.length <= max
    && Reflect.ownKeys(value).length === value.length + 1
    && value.every((_, index) => Object.hasOwn(value, index)), code);
}
function tableDescriptor(value, classified) {
  exact(value, classified ? ["name", "columns", "primaryKey", "classification"]
    : ["name", "columns", "primaryKey"], "INVALID_CATALOG");
  requireValue(typeof value.name === "string" && TABLE.test(value.name), "INVALID_CATALOG");
  array(value.columns, MAX_COLUMNS, "INVALID_CATALOG");
  array(value.primaryKey, MAX_COLUMNS, "INVALID_CATALOG");
  requireValue(value.columns.length > 0, "INVALID_CATALOG");
  const columns = value.columns.map((column) => {
    exact(column, ["name", "type", "notNull"], "INVALID_CATALOG");
    requireValue(typeof column.name === "string" && COLUMN.test(column.name)
      && typeof column.type === "string" && SUPPORTED.test(column.type)
      && typeof column.notNull === "boolean", "UNSUPPORTED_COLUMN");
    return Object.freeze({ name: column.name, type: column.type, notNull: column.notNull });
  });
  const names = columns.map(({ name }) => name);
  requireValue(new Set(names).size === names.length, "INVALID_CATALOG");
  requireValue(value.primaryKey.length > 0 && value.primaryKey.every((name) => typeof name === "string"
    && names.includes(name)) && new Set(value.primaryKey).size === value.primaryKey.length, "PK_UNPROVEN");
  const classification = classified ? value.classification : undefined;
  if (classified) requireValue(["sealed", "rebuildable_excluded", "secret_excluded"].includes(classification), "INVALID_CLASSIFICATION");
  return Object.freeze({ name: value.name, columns: Object.freeze(columns),
    primaryKey: Object.freeze([...value.primaryKey]), ...(classified ? { classification } : {}) });
}

export function classifySourceCatalog(actual, allowlist) {
  array(actual, MAX_TABLES, "INVALID_CATALOG");
  array(allowlist, MAX_TABLES, "INVALID_CATALOG");
  requireValue(allowlist.length > 0, "TABLE_COVERAGE_UNPROVEN");
  const observed = actual.map((item) => tableDescriptor(item, false)).sort((a, b) => a.name.localeCompare(b.name));
  const permitted = allowlist.map((item) => tableDescriptor(item, true)).sort((a, b) => a.name.localeCompare(b.name));
  requireValue(new Set(observed.map((item) => item.name)).size === observed.length
    && new Set(permitted.map((item) => item.name)).size === permitted.length, "INVALID_CATALOG");
  requireValue(observed.length === permitted.length, "TABLE_COVERAGE_UNPROVEN");
  for (let i = 0; i < observed.length; i++) {
    const { classification, ...expected } = permitted[i];
    requireValue(JSON.stringify(observed[i]) === JSON.stringify(expected), "CATALOG_DRIFT");
    requireValue(classification === "sealed" || classification.endsWith("_excluded"), "INVALID_CLASSIFICATION");
  }
  const allowlistSha256 = createHash("sha256").update(JSON.stringify(permitted)).digest("hex");
  return Object.freeze({ allowlistSha256, tableCount: permitted.length,
    sealed: Object.freeze(permitted.filter((item) => item.classification === "sealed")),
    excluded: Object.freeze(permitted.filter((item) => item.classification !== "sealed")) });
}

// A DB adapter must obtain each field as SQL-side ::text (or NULL) with fixed
// DateStyle, TimeZone and extra_float_digits. Numbers are never JS Numbers.
export function serializePgRow(table, values) {
  const descriptor = tableDescriptor(table, true);
  requireValue(descriptor.classification === "sealed", "INVALID_CLASSIFICATION");
  array(values, MAX_COLUMNS, "INVALID_ROW");
  requireValue(values.length === descriptor.columns.length, "INVALID_ROW");
  const fields = values.map((value, index) => {
    exact(value, ["name", "text"], "INVALID_ROW");
    const column = descriptor.columns[index];
    requireValue(value.name === column.name && (value.text === null
      ? !column.notNull : typeof value.text === "string" && value.text.length <= 2_000_000), "INVALID_ROW");
    return [column.name, column.type, value.text];
  });
  const byName = new Map(values.map(({ name, text }) => [name, text]));
  requireValue(descriptor.primaryKey.every((name) => byName.get(name) !== null), "PK_UNPROVEN");
  return Object.freeze({ id: JSON.stringify(descriptor.primaryKey.map((name) => [name, byName.get(name)])),
    body: JSON.stringify([descriptor.name, fields]) });
}
