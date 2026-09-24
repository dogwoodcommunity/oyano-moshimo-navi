import assert from "node:assert/strict";
import { createPrivacyCheckpoint, comparePrivacyCheckpoints, assessIsolatedRestore } from "./lib/backup-privacy-checkpoint.mjs";

// Synthetic identifiers only. This test never opens a database or file.
const key = Buffer.alloc(32, 0x52);
const secret = "SYNTHETIC_PRIVATE_NOTE_DO_NOT_PRINT";
const family = (id) => ({ kind: "family", id });
const user = (id) => ({ kind: "user", id });
const row = (id, scopes, body) => ({ id, scopes, body });
const baseline = {
  sourceId: "synthetic-project", sourceEpoch: "epoch-1", schemaHash: "a".repeat(64),
  keyVersion: "key-1", snapshotId: "snapshot-1", capturedAt: "2026-09-24T00:00:00.000Z",
  expectedTables: ["auth.users", "public.families", "public.family_members", "public.person_ai_memories", "storage.objects"],
  tables: [
    { name: "auth.users", rows: [row("owner", [user("owner")], { email: "example.invalid" })] },
    { name: "public.families", rows: [row("family-1", [family("family-1")], { owner: "owner" })] },
    { name: "public.family_members", rows: [row("membership", [family("family-1"), user("owner")], { role: "owner" })] },
    { name: "public.person_ai_memories", rows: [row("memory", [family("family-1")], { text: secret, resetAt: null })] },
    { name: "storage.objects", rows: [row("photo", [family("family-1")], { version: "v1" })] },
  ],
};
const clone = (value) => structuredClone(value);
const checkpoint = (value) => createPrivacyCheckpoint(value, key);
const earlier = checkpoint(baseline);
const later = (mutate = () => {}) => {
  const value = clone(baseline);
  value.snapshotId = "snapshot-2";
  value.capturedAt = "2026-09-24T00:15:00.000Z";
  mutate(value);
  return checkpoint(value);
};
let cases = 0;
function test(name, fn) {
  try { fn(); cases++; }
  catch (error) { throw new Error(`synthetic_case_failed:${name}`, { cause: error }); }
}
const fails = (code, fn) => assert.throws(fn, (error) => error.code === code && error.message === code
  && !JSON.stringify(error).includes(secret));

test("HMAC inventory omits source IDs and note text", () => {
  const saved = JSON.stringify(earlier);
  for (const value of [secret, "family-1", "membership", "example.invalid", "owner", "photo"])
    assert(!saved.includes(value));
  assert.equal(earlier.rowCount, 5);
  assert.equal(earlier.publicReleaseAllowed, false);
});
test("checkpoint and comparison results are deeply immutable", () => {
  assert(Object.isFrozen(earlier.tables));
  assert(Object.isFrozen(earlier.tables[0]));
  assert(Object.isFrozen(earlier.tables[0].rows[0]));
  assert(Object.isFrozen(earlier.tables[0].rows[0].scopes));
  assert.throws(() => { earlier.tables[0].rows[0].bodyDigest = "b".repeat(64); }, TypeError);
  const result = comparePrivacyCheckpoints(earlier, later((value) => {
    value.tables[3].rows[0].body.text = "updated";
  }));
  assert(Object.isFrozen(result.changes[0]));
  assert(Object.isFrozen(result.isolatedScopeHashes));
});
test("stable canonical row order", () => {
  const current = later((value) => { value.tables[3].rows[0].body = { resetAt: null, text: secret }; });
  assert.equal(comparePrivacyCheckpoints(earlier, current).status, "NO_OLDER_ROW_DIFFERENCE");
});
test("account erasure after receipts were scrubbed", () => {
  const current = later((value) => {
    value.tables[0].rows = [];
    value.tables[1].rows = [];
    value.tables[2].rows = [];
    value.tables[3].rows = [];
    value.tables[4].rows = [];
  });
  const result = comparePrivacyCheckpoints(earlier, current);
  assert.equal(result.changes.length, 5);
  assert.equal(result.status, "ISOLATION_REQUIRED");
  assert.equal(result.isolatedScopeHashes.length, 2);
  assert.equal(result.publicReleaseAllowed, false);
});
test("edited personal note does not reappear", () => {
  const result = comparePrivacyCheckpoints(earlier, later((value) => {
    value.tables[3].rows[0].body.text = "redacted";
  }));
  assert.deepEqual(result.changes.map(({ kind, table }) => [kind, table]), [["CHANGED", "public.person_ai_memories"]]);
});
test("family transfer is isolated, not called a deletion", () => {
  const result = comparePrivacyCheckpoints(earlier, later((value) => {
    value.tables[1].rows[0].body.owner = "new-owner";
    value.tables[2].rows[0].body.role = "member";
  }));
  assert.equal(result.changes.length, 2);
  assert(result.changes.every((change) => change.kind === "CHANGED"));
});
test("photo replacement and AI memory reset", () => {
  const result = comparePrivacyCheckpoints(earlier, later((value) => {
    value.tables[4].rows[0].body.version = "v2";
    value.tables[3].rows[0].body.resetAt = "2026-09-24";
  }));
  assert.equal(result.changes.length, 2);
});
test("source loss blocks any release review", () => {
  assert.deepEqual(assessIsolatedRestore({ backup: earlier, latest: null, bytesVerified: true,
    isolationVerified: true, sourceAvailable: false, cutoffVerified: true }), {
    publicReleaseAllowed: false, status: "BLOCKED", reason: "SOURCE_COVERAGE_UNPROVEN" });
});
test("byte verification alone cannot satisfy cutoff", () => {
  const result = assessIsolatedRestore({ backup: earlier, latest: later(), bytesVerified: true,
    isolationVerified: true, sourceAvailable: true, cutoffVerified: false });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.publicReleaseAllowed, false);
});
test("even all local evidence only reaches human review", () => {
  const result = assessIsolatedRestore({ backup: earlier, latest: later(), bytesVerified: true,
    isolationVerified: true, sourceAvailable: true, cutoffVerified: true });
  assert.equal(result.status, "HUMAN_REVIEW_REQUIRED");
  assert.equal(result.publicReleaseAllowed, false);
});
test("missing table is not zero rows", () => {
  const value = clone(baseline); value.tables.pop();
  fails("TABLE_COVERAGE_UNPROVEN", () => checkpoint(value));
});
test("unknown table never silently enters scope", () => {
  const value = clone(baseline); value.expectedTables.push("private.secret_table");
  value.tables.push({ name: "private.secret_table", rows: [] });
  fails("INVALID_SCHEMA", () => checkpoint(value));
});
test("duplicated row and missing scope are rejected", () => {
  const duplicate = clone(baseline); duplicate.tables[3].rows.push(clone(duplicate.tables[3].rows[0]));
  fails("DUPLICATE_ROW", () => checkpoint(duplicate));
  const missing = clone(baseline); missing.tables[3].rows[0].scopes = [];
  fails("INVALID_SCOPE", () => checkpoint(missing));
});
test("no raw weak key or invalid time", () => {
  fails("INVALID_KEY", () => createPrivacyCheckpoint(baseline, Buffer.alloc(4)));
  const invalid = clone(baseline); invalid.capturedAt = "2026-02-30T00:00:00.000Z";
  fails("INVALID_TIME", () => checkpoint(invalid));
});
test("unsafe JS integer is rejected instead of silently rounded", () => {
  const value = clone(baseline);
  value.tables[3].rows[0].body.count = 9007199254740993;
  fails("INVALID_ROW", () => checkpoint(value));
});
test("different source, epoch, schema or key cannot be compared", () => {
  for (const field of ["sourceId", "sourceEpoch", "schemaHash", "keyVersion"]) {
    const next = clone(baseline); next[field] = field === "schemaHash" ? "b".repeat(64) : "other";
    const actual = checkpoint(next);
    fails("CHECKPOINT_INCOMPARABLE", () => comparePrivacyCheckpoints(earlier, actual));
  }
});
test("older and forged checkpoints fail closed", () => {
  const old = clone(baseline); old.capturedAt = "2026-09-23T00:00:00.000Z";
  fails("CHECKPOINT_TOO_OLD", () => comparePrivacyCheckpoints(earlier, checkpoint(old)));
  const forged = clone(earlier); forged.publicReleaseAllowed = true;
  fails("INVALID_CHECKPOINT", () => comparePrivacyCheckpoints(earlier, forged));
  const partial = clone(earlier); partial.rowCount = 1;
  fails("INVALID_CHECKPOINT", () => comparePrivacyCheckpoints(earlier, partial));
});
test("forged matching metadata and duplicate scopes fail validation", () => {
  const source = clone(earlier); source.sourceId = "bad source id";
  fails("INVALID_SOURCE", () => comparePrivacyCheckpoints(earlier, source));
  const schema = clone(earlier); schema.schemaHash = "not-a-hash";
  fails("INVALID_SCHEMA", () => comparePrivacyCheckpoints(earlier, schema));
  const scope = clone(earlier); scope.tables[0].rows[0].scopes.push(scope.tables[0].rows[0].scopes[0]);
  fails("INVALID_SCOPE", () => comparePrivacyCheckpoints(earlier, scope));
});

console.log(JSON.stringify({ result: "BACKUP_PRIVACY_CHECKPOINT_TEST_PASS", cases,
  productionReady: false, publicReleaseAllowed: false, sourceAdapter: "NOT_IMPLEMENTED",
  realData: "NOT_ACCESSED", networkCalls: 0 }));
