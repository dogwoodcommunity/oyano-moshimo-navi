import assert from "node:assert/strict";
import { classifySourceCatalog, serializePgRow } from "./lib/backup-source-catalog.mjs";

const observed = [{ name: "public.synthetic", columns: [
  { name: "id", type: "bigint", notNull: true },
  { name: "amount", type: "numeric(30,0)", notNull: false },
], primaryKey: ["id"] }];
const allowed = [{ ...structuredClone(observed[0]), classification: "sealed" }];
const clone = (value) => structuredClone(value);
const fails = (code, operation) => assert.throws(operation,
  (error) => error.code === code && error.message === code);
let cases = 0;
function test(name, run) {
  try { run(); cases++; }
  catch (error) { throw new Error(`source_catalog_case_failed:${name}`, { cause: error }); }
}
test("exact allowlist and opaque hash", () => {
  const result = classifySourceCatalog(observed, allowed);
  assert.equal(result.tableCount, 1);
  assert.equal(result.excluded.length, 0);
  assert.match(result.allowlistSha256, /^[a-f0-9]{64}$/);
  assert(Object.isFrozen(result.sealed[0].columns));
});
test("unknown and missing table are not silently empty", () => {
  fails("TABLE_COVERAGE_UNPROVEN", () => classifySourceCatalog([...observed,
    { name: "public.unknown", columns: observed[0].columns, primaryKey: ["id"] }], allowed));
  fails("TABLE_COVERAGE_UNPROVEN", () => classifySourceCatalog([], allowed));
});
test("column and PK drift fail closed", () => {
  const changed = clone(observed); changed[0].columns[1].type = "integer";
  fails("CATALOG_DRIFT", () => classifySourceCatalog(changed, allowed));
  const noPk = clone(observed); noPk[0].primaryKey = [];
  fails("PK_UNPROVEN", () => classifySourceCatalog(noPk, allowed));
});
test("unsupported column and unclassified table rejected", () => {
  const changed = clone(observed); changed[0].columns[1].type = "money";
  fails("UNSUPPORTED_COLUMN", () => classifySourceCatalog(changed, allowed));
  fails("INVALID_CLASSIFICATION", () => classifySourceCatalog(observed,
    [{ ...allowed[0], classification: "unknown" }]));
});
test("exact bigint and numeric text survive without JS Number", () => {
  const row = serializePgRow(allowed[0], [
    { name: "id", text: "9007199254740993" },
    { name: "amount", text: "999999999999999999999999999999" },
  ]);
  assert(row.id.includes("9007199254740993"));
  assert(row.body.includes("999999999999999999999999999999"));
  fails("INVALID_ROW", () => serializePgRow(allowed[0], [
    { name: "id", text: 9007199254740993 }, { name: "amount", text: "1" }]));
});
test("null PK and nested accessors cannot enter source row", () => {
  fails("INVALID_ROW", () => serializePgRow(allowed[0], [
    { name: "id", text: null }, { name: "amount", text: "1" }]));
  const row = { name: "id", text: "1" };
  Object.defineProperty(row, "text", { get() { throw new Error("PRIVATE_DATA"); } });
  fails("INVALID_ROW", () => serializePgRow(allowed[0], [row, { name: "amount", text: "1" }]));
});
console.log(JSON.stringify({ result: "BACKUP_SOURCE_CATALOG_TEST_PASS", cases,
  realSource: false, productionReady: false, networkCalls: 0 }));
