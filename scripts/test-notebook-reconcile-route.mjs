import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// In-memory HTTP/database mocks only. No environment files, network or DB calls.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const routePath = "apps/web/app/api/notebook/reconcile/route.ts";
const routeSource = fs.readFileSync(path.join(repoRoot, routePath), "utf8");

function load(relativePath, requireModule) {
  const fileName = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(fileName, "utf8");
  const compiled = ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})(require,module,exports);`, {
    require: requireModule, module, exports: module.exports,
    crypto: webcrypto, TextEncoder, Uint8Array, Date
  });
  return module.exports;
}

const reconciliation = load("apps/web/lib/notebookReconciliation.ts", (name) => {
  throw new Error(`Pure reconciliation helper must not require ${name}`);
});
const A = "31000000-0000-4000-8000-000000000001";
const FAMILY = "31000000-0000-4000-8000-000000000002";
const PERSON = "31000000-0000-4000-8000-000000000003";
const OTHER = "31000000-0000-4000-8000-000000000004";
const EMAIL = "reconciliation-test@example.test";
const INTERNAL = "PRIVATE_PROVIDER_MESSAGE_DO_NOT_DISCLOSE";
const SOURCE = "local-source-case";
const TARGET = "remote-target-case";
const original = {
  id: "source-diary-1", caseId: SOURCE, date: "2026-09-05", mood: "stable",
  body: "保存テスト1。これは動作確認用の仮の記録です。", attachments: [],
  createdAt: "2026-09-05T10:11:12.000Z"
};
const payload = (entries = [original]) => ({
  familyId: FAMILY, personId: PERSON, targetCaseId: TARGET, sourceCaseId: SOURCE,
  samePersonConfirmed: true, diaryEntries: structuredClone(entries)
});
const copiedId = (caseId, diaryId) => `reconciled_${createHash("sha256").update(JSON.stringify([caseId, diaryId])).digest("hex")}`;
const plain = (value) => JSON.parse(JSON.stringify(value));
let scenario;
let requestNumber = 0;
let checks = 0;

function reset(overrides = {}) {
  scenario = {
    configured: true,
    user: { id: A, email: EMAIL, email_confirmed_at: "2026-09-05T09:00:00Z" },
    authError: null, authThrows: false, authCalls: [],
    membership: { family_id: FAMILY, user_id: A, role: "owner" },
    membershipError: null,
    person: { id: PERSON, family_id: FAMILY, profile: { localCaseId: TARGET } },
    personError: null, ignorePersonFilters: false,
    rpcError: null, rpcThrows: false, transformResult: (value) => value,
    queries: [], rpcCalls: [], ...overrides
  };
}

const supabase = {
  auth: {
    async getUser(token) {
      scenario.authCalls.push(token);
      if (scenario.authThrows) throw new Error(INTERNAL);
      return { data: { user: scenario.user }, error: scenario.authError };
    }
  },
  from(table) {
    assert.ok(["family_members", "people"].includes(table), "only authority/target SELECTs are permitted");
    const call = { table, columns: null, filters: [] };
    scenario.queries.push(call);
    return {
      select(columns) { call.columns = columns; return this; },
      eq(column, value) { call.filters.push([column, value]); return this; },
      async maybeSingle() {
        const membership = table === "family_members";
        let data = membership ? scenario.membership : scenario.person;
        const error = membership ? scenario.membershipError : scenario.personError;
        if (!(table === "people" && scenario.ignorePersonFilters)
          && data && call.filters.some(([key, value]) => data[key] !== value)) data = null;
        return { data, error };
      }
    };
  },
  async rpc(name, input) {
    assert.equal(name, "reconcile_notebook_diaries_v1", "only the transactional exact-person wrapper can write");
    const saved = plain(input);
    scenario.rpcCalls.push(saved);
    if (scenario.rpcThrows) throw new Error(INTERNAL);
    if (scenario.rpcError) return { data: null, error: scenario.rpcError };
    return {
      error: null,
      data: scenario.transformResult({
        ok: true, familyId: FAMILY, personId: PERSON, targetCaseId: TARGET,
        syncedPeople: 0, syncedTasks: 0, syncedEntries: saved.p_diary_entries.length,
        caseRevisions: [], taskRevisions: [],
        diaryRevisions: saved.p_diary_entries.map((entry) => ({
          localCaseId: entry.localCaseId, localDiaryId: entry.localDiaryId,
          cloudRevision: 1, cloudHash: "a".repeat(64)
        })),
        notice: INTERNAL
      })
    };
  }
};

const { POST } = load(routePath, (name) => {
  if (name === "node:crypto") return {
    randomUUID: () => `32000000-0000-4000-8000-${String(++requestNumber).padStart(12, "0")}`
  };
  if (name === "next/server") return {
    NextResponse: { json: (body, init = {}) => ({ status: init.status ?? 200, body: plain(body) }) }
  };
  if (name === "@/lib/serverSupabase") return { getServerSupabase: () => scenario.configured ? supabase : null };
  if (name === "@/lib/notebookReconciliation") return reconciliation;
  throw new Error(`Unexpected route dependency ${name}`);
});

async function call(body = payload(), authorization = "Bearer local-test-token", malformedJson = false) {
  checks += 1;
  const response = await POST({
    headers: { get: (key) => key === "authorization" ? authorization : null },
    json: async () => {
      if (malformedJson) throw new Error(INTERNAL);
      return plain(body);
    }
  });
  assert.doesNotMatch(JSON.stringify(response.body), new RegExp(`${INTERNAL}|local-test-token|${EMAIL}`), "never disclose secrets/provider messages");
  return response;
}

for (const [overrides, authorization, expected] of [
  [{ configured: false }, "Bearer local-test-token", 501],
  [{}, null, 401],
  [{}, "Basic local-test-token", 401],
  [{ user: null }, "Bearer local-test-token", 401],
  [{ authError: { message: INTERNAL } }, "Bearer local-test-token", 401],
  [{ authThrows: true }, "Bearer local-test-token", 503],
  [{ user: { id: A, email: EMAIL, email_confirmed_at: null } }, "Bearer local-test-token", 403],
  [{ user: { id: A, email_confirmed_at: "2026-09-05T09:00:00Z" } }, "Bearer local-test-token", 403]
]) {
  reset(overrides);
  assert.equal((await call(payload(), authorization)).status, expected);
  assert.equal(scenario.queries.length, 0);
  assert.equal(scenario.rpcCalls.length, 0);
}

const invalidBodies = [
  null, [], {}, { ...payload(), samePersonConfirmed: false },
  { ...payload(), samePersonConfirmed: "true" },
  { ...payload(), userId: OTHER }, { ...payload(), cases: [] },
  { ...payload(), familyId: "not-a-uuid" }, { ...payload(), personId: "not-a-uuid" },
  { ...payload(), sourceCaseId: TARGET }, { ...payload(), sourceCaseId: "" },
  { ...payload(), sourceCaseId: "a".repeat(201) },
  { ...payload(), targetCaseId: "a".repeat(201) }, { ...payload(), targetCaseId: " target " },
  payload([]), payload(Array.from({ length: 101 }, (_, i) => ({ ...original, id: `entry-${i}` }))),
  payload([original, original]),
  ...[
    { id: "" }, { id: "a".repeat(201) }, { id: " whitespace " }, { caseId: "other-case" },
    { body: "   " }, { body: "a".repeat(10_001) }, { body: null },
    { date: "2026-02-30" }, { date: "2026-13-01" }, { date: "2026-2-01" },
    { mood: "other" }, { createdAt: "2026-02-30T12:00:00Z" },
    { createdAt: "not-a-date" }, { createdAt: "2026-09-05" },
    { createdAt: "2026-09-05T24:00:00Z" }, { updatedAt: "bad" }, { updatedAt: null },
    { attachments: [{}] }, { attachments: null }, { attachments: "[]" },
    { cloudRevision: 0 }, { cloudRevision: null }, { cloudHash: null },
    { cloudSyncedUpdatedAt: original.createdAt }, { cloudPersonId: PERSON },
    { metadata: {} }, { storagePath: "private/path" }, { arbitraryField: true }
  ].map((patch) => payload([{ ...original, ...patch }]))
];
for (const body of invalidBodies) {
  reset();
  assert.equal((await call(body)).status, 400, "malformed/unsupported input must fail closed");
  assert.equal(scenario.queries.length, 0);
  assert.equal(scenario.rpcCalls.length, 0);
}
reset();
assert.equal((await call(payload(), "Bearer local-test-token", true)).status, 400);
assert.equal(scenario.rpcCalls.length, 0);

for (const [overrides, body, expected] of [
  [{ membership: null }, payload(), 403],
  [{ membership: { family_id: FAMILY, user_id: A, role: "viewer" } }, payload(), 403],
  [{ membershipError: { message: INTERNAL } }, payload(), 503],
  [{}, { ...payload(), familyId: OTHER }, 403],
  [{}, { ...payload(), personId: OTHER }, 409],
  [{ person: null }, payload(), 409],
  [{ personError: { message: INTERNAL } }, payload(), 503],
  [{ person: { id: PERSON, family_id: FAMILY, profile: { localCaseId: "different-case" } } }, payload(), 409],
  [{ person: { id: PERSON, family_id: FAMILY, profile: {} } }, payload(), 409],
  [{ person: { id: OTHER, family_id: FAMILY, profile: { localCaseId: TARGET } }, ignorePersonFilters: true }, payload(), 409],
  [{ person: { id: PERSON, family_id: OTHER, profile: { localCaseId: TARGET } }, ignorePersonFilters: true }, payload(), 409]
]) {
  reset(overrides);
  assert.equal((await call(body)).status, expected);
  assert.equal(scenario.rpcCalls.length, 0);
}

for (const [message, expected] of [
  ["notebook_diary_conflict", 409], ["notebook_new_diary_has_cloud_identity", 409],
  ["notebook_diary_deleted", 409], ["person_notebook_deleted_identity", 409],
  ["notebook_sync_request_id_reused", 409], ["notebook_sync_viewer_cannot_mutate", 403],
  ["notebook_sync_family_membership_required", 403], ["notebook_sync_receipt_membership_no_longer_valid", 403],
  ["notebook_sync_diary_person_not_found", 409],
  ["notebook_reconciliation_person_not_found", 409], ["notebook_reconciliation_person_binding_conflict", 409],
  ["notebook_reconciliation_person_deleted", 409], ["notebook_reconciliation_viewer_cannot_mutate", 403],
  ["notebook_reconciliation_family_membership_required", 403], ["notebook_reconciliation_actor_verification_required", 403],
  [INTERNAL, 500]
]) {
  reset({ rpcError: { message: `${message} ${INTERNAL}`, details: INTERNAL } });
  assert.equal((await call()).status, expected);
  assert.equal(scenario.rpcCalls.length, 1, "RPC errors must not trigger an unguarded fallback write");
}
reset({ rpcThrows: true });
assert.equal((await call()).status, 503);
assert.equal(scenario.rpcCalls.length, 1);

for (const change of [
  (r) => ({ ...r, ok: false }), (r) => ({ ...r, familyId: OTHER }),
  (r) => ({ ...r, personId: OTHER }), (r) => ({ ...r, targetCaseId: "other-case" }),
  (r) => { const { personId: omitted, ...remaining } = r; return remaining; },
  (r) => { const { targetCaseId: omitted, ...remaining } = r; return remaining; },
  (r) => ({ ...r, syncedPeople: 1 }), (r) => ({ ...r, syncedTasks: 1 }),
  (r) => ({ ...r, syncedEntries: 0 }), (r) => ({ ...r, caseRevisions: [{}] }),
  (r) => ({ ...r, taskRevisions: [{}] }), (r) => ({ ...r, diaryRevisions: [] }),
  (r) => ({ ...r, diaryRevisions: [{ ...r.diaryRevisions[0], localCaseId: "other" }] }),
  (r) => ({ ...r, diaryRevisions: [{ ...r.diaryRevisions[0], localDiaryId: "other" }] }),
  (r) => ({ ...r, diaryRevisions: [{ ...r.diaryRevisions[0], cloudRevision: 0 }] }),
  (r) => ({ ...r, diaryRevisions: [{ ...r.diaryRevisions[0], cloudHash: "bad" }] })
]) {
  reset({ transformResult: change });
  assert.equal((await call()).status, 502, "unknown write outcomes must not be reported as confirmed success");
}

for (const role of ["owner", "admin", "member"]) {
  reset({ membership: { family_id: FAMILY, user_id: A, role } });
  const entries = [original, {
    ...original, id: "source-diary-2", date: "2026-02-28", body: "別の日付の仮記録", mood: "changed",
    createdAt: "2026-02-28T14:15:16+09:00", updatedAt: "2026-03-01T00:00:00.000Z"
  }];
  const first = await call(payload(entries));
  const second = await call(payload(entries));
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { ok: true, familyId: FAMILY, personId: PERSON, targetCaseId: TARGET, syncedEntries: 2 });
  assert.deepEqual(first.body, second.body);
  const [one, two] = scenario.rpcCalls;
  assert.notEqual(one.p_request_id, two.p_request_id, "every fresh RPC request gets a fresh receipt ID");
  assert.deepEqual(one.p_diary_entries, two.p_diary_entries, "copy identities AND contents remain stable across retries");
  assert.deepEqual(Object.keys(one).sort(), [
    "p_actor_email", "p_actor_user_id", "p_diary_entries", "p_family_id", "p_person_id", "p_request_id", "p_target_case_id"
  ], "the wrapper has no profile, task, or create-family input");
  assert.equal(one.p_family_id, FAMILY);
  assert.equal(one.p_person_id, PERSON, "exact person UUID must cross the transaction boundary");
  assert.equal(one.p_target_case_id, TARGET, "local identity must be rechecked with UUID in the transaction");
  assert.equal(one.p_actor_user_id, A);
  assert.equal(one.p_actor_email, EMAIL);
  assert.deepEqual(scenario.queries[0], {
    table: "family_members", columns: "role", filters: [["family_id", FAMILY], ["user_id", A]]
  });
  assert.deepEqual(scenario.queries[1], {
    table: "people", columns: "id,family_id,profile", filters: [["id", PERSON], ["family_id", FAMILY]]
  });
  one.p_diary_entries.forEach((entry, index) => {
    const source = entries[index];
    assert.deepEqual(entry, {
      localCaseId: TARGET, localDiaryId: copiedId(SOURCE, source.id),
      cloudRevision: null, cloudHash: null, date: source.date,
      title: source.mood === "changed" ? "変化の記録" : "日々の記録",
      body: source.body, mood: source.mood, attachments: [], metadata: { source: "pwa-notebook" },
      createdAt: source.createdAt, updatedAt: source.updatedAt ?? source.createdAt
    });
  });
}

reset();
assert.equal((await call(payload([{ ...original, date: "2024-02-29", mood: "urgent" }]))).status, 200);
assert.equal(scenario.rpcCalls[0].p_diary_entries[0].title, "急ぎの記録");
reset();
const maximum = Array.from({ length: 100 }, (_, i) => ({ ...original, id: `${i}-${"a".repeat(190)}` }));
assert.equal((await call(payload(maximum))).status, 200);
assert.equal(scenario.rpcCalls[0].p_diary_entries.length, 100);
assert.equal(new Set(scenario.rpcCalls[0].p_diary_entries.map((entry) => entry.localDiaryId)).size, 100);

for (const body of ["あ".repeat(9999), "あ".repeat(10000), "🙂".repeat(5001), "🙂".repeat(10000), " \r\n記録🙂\n\n"]) {
  reset();
  assert.equal((await call(payload([{ ...original, body }]))).status, 200);
  assert.equal(scenario.rpcCalls[0].p_diary_entries[0].body, body, "accepted text reaches the RPC unchanged");
}
for (const body of ["あ".repeat(10001), "🙂".repeat(10001)]) {
  reset();
  const response = await call(payload([{ ...original, body }]));
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "reconcile_body_too_long");
  assert.match(response.body.message, /どちらの手帳も変更せず/);
  assert.equal(scenario.rpcCalls.length, 0, "oversize reconciliation never writes or truncates");
}

const routeAst = ts.createSourceFile(routePath, routeSource, ts.ScriptTarget.ES2022, true);
function checkNoDirectWrites(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const method = node.expression.name.text;
    // This in-memory Set operation is not a database DELETE.
    const removesVerifiedId = method === "delete" && node.expression.expression.getText(routeAst) === "expectedIds";
    assert.ok(!["insert", "upsert", "update", "delete"].includes(method) || removesVerifiedId,
      "all persistent writes must remain inside the exact-person atomic RPC wrapper");
  }
  ts.forEachChild(node, checkNoDirectWrites);
}
checkNoDirectWrites(routeAst);
assert.doesNotMatch(routeSource, /console\./, "do not log raw identity or notebook payloads");
assert.doesNotMatch(routeSource, /\.rpc\(["']sync_notebook_v2["']/, "do not fall back to a preflight-only UUID check");
console.log(`Notebook reconcile route regression: ok (${checks} mocked requests; no external calls)`);
