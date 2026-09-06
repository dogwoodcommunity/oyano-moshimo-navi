import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const sourcePath = path.join(repoRoot, "apps/web/lib/consultMemory.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
}).outputText;

const moduleRecord = { exports: {} };
let mockServerSupabase = null;
let mockNormalizeConsultAnswer = () => null;
const mockRequire = (specifier) => {
  if (specifier === "@oyano/shared") {
    return {
      CONSULT_MEMORY_CONSENT_VERSION: "consult-memory-v02-2026-09-01",
      consultAnswerToHistoryTurn: (question, answer) => ({ question, situation: answer.situation }),
      normalizeConsultAnswer: (value) => mockNormalizeConsultAnswer(value)
    };
  }
  if (specifier === "@/lib/consult") {
    return { redactSensitive: (value) => value };
  }
  if (specifier === "@/lib/serverSupabase") {
    return { getServerSupabase: () => mockServerSupabase };
  }
  throw new Error(`Unexpected runtime import in consultMemory.ts: ${specifier}`);
};

const load = new Function("exports", "require", "module", "__filename", "__dirname", compiled);
load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));

const {
  ConsultMemoryAccessError,
  ConsultMemoryConflictError,
  ConsultMemoryConsentConflictError,
  authorizeConsultPerson,
  assertConsultMemorySnapshot,
  buildImportantChanges,
  buildConsultationOverview,
  buildLongTermOverview,
  isConsultMemorySchemaMissing,
  normalizeConsultMemberRole,
  normalizeMemoryState,
  normalizeSourceRecord,
  selectRelevantPriorTurns,
  selectRelevantOlderRecords,
  setConsultMemoryConsent,
  sortSourceRecords
} = moduleRecord.exports;

function mockConsultSupabase({ memberships, people }) {
  const tables = { family_members: memberships, people };
  return {
    auth: {
      async getUser(token) {
        assert.equal(token, "test-token");
        return { data: { user: { id: "user-1" } }, error: null };
      }
    },
    from(table) {
      const rows = tables[table];
      if (!rows) throw new Error(`Unexpected table in authorization test: ${table}`);
      const filters = [];
      const query = {
        select() { return query; },
        eq(column, value) {
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column, values) {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        async maybeSingle() {
          const matched = rows.filter((row) => filters.every((filter) => filter(row)));
          return { data: matched.length === 1 ? matched[0] : null, error: null };
        },
        then(resolve, reject) {
          const matched = rows.filter((row) => filters.every((filter) => filter(row)));
          return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

const authorizationRequest = {
  headers: {
    get(name) {
      return name.toLowerCase() === "authorization" ? "Bearer test-token" : null;
    }
  }
};

mockServerSupabase = mockConsultSupabase({
  memberships: [
    { user_id: "user-1", family_id: "family-a", role: "owner" },
    { user_id: "user-1", family_id: "family-b", role: "member" }
  ],
  people: [
    { id: "person-a", family_id: "family-a", profile: { localCaseId: "same-local-case" } },
    { id: "person-b", family_id: "family-b", profile: { localCaseId: "same-local-case" } }
  ]
});

await assert.rejects(
  () => authorizeConsultPerson(authorizationRequest, { localCaseId: "same-local-case" }),
  (error) => error instanceof ConsultMemoryAccessError && error.code === "family_required"
);
const familyBoundPerson = await authorizeConsultPerson(authorizationRequest, {
  familyId: "family-b",
  localCaseId: "same-local-case"
});
assert.equal(familyBoundPerson.personId, "person-b");
assert.equal(familyBoundPerson.familyId, "family-b");
assert.equal(familyBoundPerson.memberRole, "member");
await assert.rejects(
  () => authorizeConsultPerson(authorizationRequest, { familyId: "family-c", localCaseId: "same-local-case" }),
  (error) => error instanceof ConsultMemoryAccessError && error.code === "forbidden"
);
mockServerSupabase = null;

const records = Array.from({ length: 14 }, (_, index) => {
  const day = index + 1;
  return {
    sourceEventId: `event-${day}`,
    date: `2026-08-${String(day).padStart(2, "0")}`,
    mood: day === 1 ? "urgent" : day === 2 ? "changed" : "stable",
    body: day === 2 ? "薬の飲み忘れがあった" : day === 1 ? "転倒した" : `いつもの記録 ${day}`,
    createdAt: `2026-08-${String(day).padStart(2, "0")}T09:00:00.000Z`
  };
});

assert.equal(sortSourceRecords(records)[0].sourceEventId, "event-14");
assert.equal(sortSourceRecords(records).at(-1).sourceEventId, "event-1");

const relevant = selectRelevantOlderRecords(records, "薬について確認したい", 12, 6);
assert.deepEqual(
  relevant.map((record) => record.sourceEventId),
  ["event-2"],
  "最新12件と重複せず、質問と実際に関連する古い記録だけを選ぶ"
);

const changes = buildImportantChanges(records);
assert.deepEqual(changes.map((change) => change.sourceEventId), ["event-2", "event-1"]);
assert.ok(changes.every((change) => change.summary.length > 0));

const overview = buildLongTermOverview(records);
assert.match(overview, /14件/);
assert.match(overview, /2026-08-01から2026-08-14/);
assert.match(overview, /記録ID:event-14/);
assert.match(overview, /薬・服薬/);

const consultTurns = [
  {
    id: "turn-1",
    question: "薬の飲み忘れを次の受診でどう伝えますか",
    answer: {
      situation: "薬の飲み忘れが記録されています。",
      nextChecks: [{ title: "服薬状況を確認する", why: "受診で伝えるためです。" }],
      askQuestions: ["飲み忘れた時はどうすればよいですか"],
      providerCategories: ["主治医"],
      watchOuts: ["自己判断で薬を増減しない"],
      recordSuggestion: "飲んだ時刻を残す"
    },
    sourceEventIds: ["event-2"],
    memoryVersion: 1,
    savedToNotebookAt: null,
    createdAt: "2026-08-01T09:00:00.000Z"
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `turn-${index + 2}`,
    question: `介護サービスについての相談 ${index + 2}`,
    answer: {
      situation: "介護サービスの確認が必要です。",
      nextChecks: [{ title: "ケアマネジャーへ確認する", why: "利用条件を確かめるためです。" }],
      askQuestions: [],
      providerCategories: ["地域包括支援センター"],
      watchOuts: [],
      recordSuggestion: "連絡結果を残す"
    },
    sourceEventIds: [],
    memoryVersion: 1,
    savedToNotebookAt: null,
    createdAt: `2026-08-0${index + 2}T09:00:00.000Z`
  }))
];
const relatedPrior = selectRelevantPriorTurns(consultTurns, "前に相談した薬のことを確認したい", 4, 4);
assert.deepEqual(relatedPrior.map((turn) => turn.id), ["turn-1"]);
const consultationOverview = buildConsultationOverview(consultTurns);
assert.match(consultationOverview, /過去相談6件/);
assert.match(consultationOverview, /薬・服薬 1件/);
assert.match(consultationOverview, /介護・施設・支援 5件/);
assert.match(consultationOverview, /AI提案の集計/);

const normalized = normalizeSourceRecord({
  id: "source-1",
  event_date: "2026-08-20",
  mood: "changed",
  body: "食事量が変わった",
  created_at: "2026-08-20T10:00:00.000Z"
});
assert.deepEqual(normalized, {
  sourceEventId: "source-1",
  date: "2026-08-20",
  mood: "changed",
  body: "食事量が変わった",
  createdAt: "2026-08-20T10:00:00.000Z"
});

const memory = normalizeMemoryState({
  person_id: "person-1",
  long_term_summary: "長期要約",
  user_summary: "利用者の補足",
  record_count: 14,
  memory_version: 3,
  memory_reset_at: "2026-08-01T00:00:00.000Z"
});
assert.equal(memory.personId, "person-1");
assert.equal(memory.userSummary, "利用者の補足");
assert.equal(memory.recordCount, 14);
assert.equal(memory.memoryVersion, 3);
assert.equal(memory.memoryResetAt, "2026-08-01T00:00:00.000Z");

let memorySnapshotRow = {
  memory_version: 3,
  memory_reset_at: "2026-08-01T00:00:00.000Z"
};
const memorySnapshotSupabase = {
  from(table) {
    assert.equal(table, "person_ai_memories");
    const query = {
      select() { return query; },
      eq() { return query; },
      async maybeSingle() { return { data: memorySnapshotRow, error: null }; }
    };
    return query;
  }
};
const memorySnapshotAuthorization = {
  supabase: memorySnapshotSupabase,
  userId: "user-1",
  familyId: "family-1",
  memberRole: "owner",
  personId: "person-1",
  personRow: {}
};
await assertConsultMemorySnapshot(memorySnapshotAuthorization, {
  memoryVersion: 3,
  memoryResetAt: "2026-08-01T00:00:00.000Z"
});
memorySnapshotRow = { ...memorySnapshotRow, memory_version: 4 };
await assert.rejects(
  () => assertConsultMemorySnapshot(memorySnapshotAuthorization, {
    memoryVersion: 3,
    memoryResetAt: "2026-08-01T00:00:00.000Z"
  }),
  (error) => error instanceof ConsultMemoryConflictError && error.code === "memory_conflict"
);
memorySnapshotRow = { memory_version: 3, memory_reset_at: "2026-09-01T00:00:00.000Z" };
await assert.rejects(
  () => assertConsultMemorySnapshot(memorySnapshotAuthorization, {
    memoryVersion: 3,
    memoryResetAt: "2026-08-01T00:00:00.000Z"
  }),
  (error) => error instanceof ConsultMemoryConflictError
);

assert.equal(isConsultMemorySchemaMissing({ code: "42P01" }), true);
assert.equal(isConsultMemorySchemaMissing({
  code: "PGRST204",
  message: "Could not find the 'revision' column of 'ai_memory_consents' in the schema cache"
}), true);
assert.equal(isConsultMemorySchemaMissing({ code: "23505", message: "duplicate" }), false);

assert.equal(normalizeConsultMemberRole("owner"), "owner");
assert.equal(normalizeConsultMemberRole("member"), "member");
assert.equal(normalizeConsultMemberRole("unexpected-role"), "viewer");
assert.equal(normalizeConsultMemberRole(null), "viewer");

const staleConsentRead = {
  from(table) {
    assert.equal(table, "ai_memory_consents");
    const query = {
      select() { return query; },
      eq() { return query; },
      async maybeSingle() {
        return {
          data: {
            consent_version: "consult-memory-v02-2026-09-01",
            revision: 2,
            accepted_at: "2026-09-01T00:00:00.000Z",
            revoked_at: "2026-09-01T00:01:00.000Z",
            updated_at: "2026-09-01T00:01:00.000Z"
          },
          error: null
        };
      }
    };
    return query;
  }
};
await assert.rejects(
  () => setConsultMemoryConsent({
    supabase: staleConsentRead,
    userId: "user-1",
    familyId: "family-1",
    memberRole: "owner",
    personId: "person-1",
    personRow: {}
  }, "accept", "consult-memory-v02-2026-09-01", "web", 1),
  (error) => error instanceof ConsultMemoryConsentConflictError && error.code === "consent_conflict"
);

let consentRow = {
  person_id: "person-1",
  user_id: "user-1",
  consent_version: "consult-memory-v02-2026-09-01",
  revision: 2,
  accepted_at: "2026-09-01T00:00:00.000Z",
  revoked_at: "2026-09-01T00:01:00.000Z",
  updated_at: "2026-09-01T00:01:00.000Z"
};
let revisionCompared = null;
const casConsentSupabase = {
  from(table) {
    if (table === "audit_logs") {
      return { async insert() { return { error: null }; } };
    }
    assert.equal(table, "ai_memory_consents");
    return {
      select() {
        const query = {
          eq() { return query; },
          async maybeSingle() { return { data: consentRow, error: null }; }
        };
        return query;
      },
      update(payload) {
        let matches = true;
        const query = {
          eq(column, value) {
            if (column === "revision") {
              revisionCompared = value;
              matches = matches && consentRow.revision === value;
            }
            return query;
          },
          select() { return query; },
          async maybeSingle() {
            if (!matches) return { data: null, error: null };
            consentRow = { ...consentRow, ...payload };
            return { data: { revision: consentRow.revision }, error: null };
          }
        };
        return query;
      }
    };
  }
};
const acceptedConsent = await setConsultMemoryConsent({
  supabase: casConsentSupabase,
  userId: "user-1",
  familyId: "family-1",
  memberRole: "owner",
  personId: "person-1",
  personRow: {}
}, "accept", "consult-memory-v02-2026-09-01", "web", 2);
assert.equal(revisionCompared, 2);
assert.equal(acceptedConsent.revision, 3);
assert.equal(acceptedConsent.active, true);

// Continuous synthetic flow: run the actual DELETE route, then the actual next
// durable-context assembly. The DB double only applies query operations; it
// must not implement the reset-time/source-record filtering being tested.
{
  const beforeReset = new Date(Date.now() - 86_400_000).toISOString();
  const historyAnswer = {
    situation: "残る本人相談履歴のAI提案です。",
    nextChecks: [], askQuestions: [], providerCategories: [], watchOuts: [], recordSuggestion: ""
  };
  mockNormalizeConsultAnswer = (value) => value?.situation === historyAnswer.situation ? value : null;
  const tables = {
    family_members: [{ user_id: "user-reset", family_id: "family-reset", role: "owner" }],
    people: [{ id: "person-reset", family_id: "family-reset", profile: { localCaseId: "case-reset" } }],
    person_ai_memories: [{ person_id: "person-reset", memory_version: 1, user_summary: "削除前の補足" }],
    timeline_events: Array.from({ length: 16 }, (_, index) => ({
      id: `old-reset-${index}`, person_id: "person-reset", event_type: "diary",
      event_date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      created_at: beforeReset, body: `RESET_OLD 原記録 薬の確認 ${index}`, mood: "changed", metadata: {}
    })),
    tasks: [],
    ai_consult_threads: [{ id: "thread-reset", person_id: "person-reset", owner_user_id: "user-reset" }],
    ai_consult_turns: [{
      id: "private-history-before-reset", thread_id: "thread-reset", question: "以前の薬の相談",
      answer: historyAnswer, source_event_ids: ["old-reset-0"], memory_version: 1, created_at: beforeReset
    }],
    audit_logs: []
  };
  const writes = [];
  const supabase = {
    auth: { async getUser(token) {
      assert.equal(token, "test-token");
      return { data: { user: { id: "user-reset" } }, error: null };
    } },
    from(table) {
      assert.ok(Object.hasOwn(tables, table), `unexpected reset fixture table: ${table}`);
      const filters = [];
      const orders = [];
      let start = 0;
      let end = Infinity;
      let update = null;
      let insert = null;
      function run(single = false) {
        let rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
        if (update) {
          assert.equal(table, "person_ai_memories", "reset may only update derived memory");
          writes.push(["update", table]);
          rows.forEach((row) => Object.assign(row, update));
        }
        if (insert) {
          assert.equal(table, "audit_logs", "an existing private thread must not be recreated");
          writes.push(["insert", table]);
          tables[table].push(insert);
          rows = [insert];
        }
        rows = [...rows].sort((a, b) => {
          for (const [column, ascending] of orders) {
            const comparison = String(a[column] ?? "").localeCompare(String(b[column] ?? ""));
            if (comparison) return ascending ? comparison : -comparison;
          }
          return 0;
        }).slice(start, end === Infinity ? undefined : end + 1);
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
      const query = {
        select() { return query; },
        eq(column, value) { filters.push((row) => row[column] === value); return query; },
        neq(column, value) { filters.push((row) => row[column] !== value); return query; },
        in(column, values) { filters.push((row) => values.includes(row[column])); return query; },
        order(column, { ascending }) { orders.push([column, ascending]); return query; },
        range(from, to) { start = from; end = to; return query; },
        limit(count) { end = count - 1; return query; },
        update(value) { update = value; return query; },
        insert(value) { insert = value; return query; },
        delete() { assert.fail("memory-only deletion must not delete raw records or private history"); },
        async maybeSingle() { return run(true); },
        async single() { return run(true); },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); }
      };
      return query;
    }
  };
  mockServerSupabase = supabase;
  const request = {
    ...authorizationRequest,
    nextUrl: new URL("https://example.test/api/consult/memory?scope=memory&personId=person-reset&familyId=family-reset")
  };
  const routePath = path.join(repoRoot, "apps/web/app/api/consult/memory/route.ts");
  const routeModule = { exports: {} };
  const routeCode = ts.transpileModule(fs.readFileSync(routePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("exports", "require", "module", routeCode)(routeModule.exports, (specifier) => {
    if (specifier === "@/lib/consultMemory") return moduleRecord.exports;
    if (specifier === "next/server") return { NextResponse: {
      json: (body, init = {}) => ({ status: init.status ?? 200, body })
    } };
    throw new Error(`Unexpected memory DELETE import: ${specifier}`);
  }, routeModule);
  const authorized = await authorizeConsultPerson(request, { personId: "person-reset", familyId: "family-reset" });
  const before = await moduleRecord.exports.loadDurableConsultContext(authorized, "薬の確認");
  assert.equal(before.memoryState.recordCount, 16, "the fixture must be remembered before deletion");
  assert.match(before.memory.longTermSummary, /RESET_OLD/);
  const originalRows = JSON.stringify(tables.timeline_events);
  const originalHistory = JSON.stringify(tables.ai_consult_turns);
  const deleted = await routeModule.exports.DELETE(request);
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body.deleted, { memory: true, history: false });
  assert.equal(deleted.body.notebookRecordsDeleted, false);
  assert.equal(JSON.stringify(tables.timeline_events), originalRows, "deleting memory preserves all original diary rows");
  assert.equal(JSON.stringify(tables.ai_consult_turns), originalHistory, "private consultation history is a separate deletion scope");
  const empty = await moduleRecord.exports.loadDurableConsultContext(authorized, "薬の確認");
  assert.equal(empty.memoryState.recordCount, 0);
  assert.equal(empty.memoryState.userSummary, "");
  assert.deepEqual(empty.sourceEventIds, []);
  assert.deepEqual(empty.memory.latestRecords, []);
  assert.deepEqual(empty.memory.relevantOlderRecords, []);
  assert.deepEqual(empty.memory.importantChanges, []);
  assert.equal(empty.historyTurns, 1);
  assert.equal(empty.memory.priorSuggestions[0].situation, historyAnswer.situation,
    "memory reset does not promise removal of retained private AI suggestions");

  const resetAt = deleted.body.memoryResetAt;
  const resetTime = Date.parse(resetAt);
  assert.ok(Number.isFinite(resetTime));
  const newRows = Array.from({ length: 14 }, (_, index) => ({
    id: `new-reset-${index}`, person_id: "person-reset", event_type: "diary",
    // A newly entered backdated diary remains eligible: created_at defines the boundary.
    event_date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    created_at: new Date(resetTime + index + 1).toISOString(),
    body: index === 0 ? "新しい薬の確認" : `新しい毎日の記録 ${index}`,
    mood: index === 0 ? "changed" : "stable", metadata: {}
  }));
  tables.timeline_events.push(...newRows,
    { ...newRows[0], id: "exact-reset-boundary", body: "RESET_OLD 境界と同時刻", created_at: resetAt },
    { ...newRows[0], id: "invalid-created-at", body: "RESET_OLD 時刻不明", created_at: "invalid" },
    { ...newRows[0], id: "other-person-record", person_id: "person-other", body: "OTHER_PERSON" },
    { ...newRows[0], id: "saved-ai-memo", body: "相談メモ: 過去のAI提案" },
    { ...newRows[0], id: "ai-source-record", metadata: { source: "ai_consult" } });
  const rawAfterAppend = JSON.stringify(tables.timeline_events);
  const after = await moduleRecord.exports.loadDurableConsultContext(authorized, "薬の確認");
  assert.equal(after.memoryState.memoryResetAt, resetAt);
  assert.equal(after.memoryState.recordCount, 14);
  assert.equal(after.memory.latestRecords.length, 12);
  assert.deepEqual(after.memory.relevantOlderRecords.map((record) => record.sourceEventId), ["new-reset-0"]);
  assert.deepEqual(new Set(after.memoryState.sourceEventIds), new Set(newRows.map((row) => row.id)));
  const recordContext = {
    longTermSummary: after.memory.longTermSummary, userSummary: after.memory.userSummary,
    importantChanges: after.memory.importantChanges, latestRecords: after.memory.latestRecords,
    relevantOlderRecords: after.memory.relevantOlderRecords, sourceEventIds: after.sourceEventIds
  };
  assert.doesNotMatch(JSON.stringify(recordContext), /RESET_OLD|old-reset-|OTHER_PERSON|saved-ai-memo|ai-source-record/);
  assert.equal(JSON.stringify(tables.timeline_events), rawAfterAppend, "context assembly must not change raw fixture rows");
  assert.equal(JSON.stringify(tables.ai_consult_turns), originalHistory);
  assert.equal(after.historyTurns, 1);
  const storedMemory = JSON.stringify(tables.person_ai_memories);
  const repeated = await moduleRecord.exports.loadDurableConsultContext(authorized, "薬の確認");
  assert.deepEqual(repeated.sourceEventIds, after.sourceEventIds);
  assert.equal(JSON.stringify(tables.person_ai_memories), storedMemory, "repeated context must not resurrect pre-reset memory");
  assert.ok(writes.some(([operation, table]) => operation === "insert" && table === "audit_logs"));
  mockNormalizeConsultAnswer = () => null;
  mockServerSupabase = null;
}

console.log("consult memory core tests: ok");
