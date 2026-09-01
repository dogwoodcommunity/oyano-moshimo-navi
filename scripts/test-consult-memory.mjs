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
const mockRequire = (specifier) => {
  if (specifier === "@oyano/shared") {
    return {
      CONSULT_MEMORY_CONSENT_VERSION: "consult-memory-v02-2026-09-01",
      consultAnswerToHistoryTurn: (question, answer) => ({ question, situation: answer.situation }),
      normalizeConsultAnswer: () => null
    };
  }
  if (specifier === "@/lib/consult") {
    return { redactSensitive: (value) => value };
  }
  if (specifier === "@/lib/serverSupabase") {
    return { getServerSupabase: () => null };
  }
  throw new Error(`Unexpected runtime import in consultMemory.ts: ${specifier}`);
};

const load = new Function("exports", "require", "module", "__filename", "__dirname", compiled);
load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));

const {
  ConsultMemoryConflictError,
  ConsultMemoryConsentConflictError,
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

console.log("consult memory core tests: ok");
