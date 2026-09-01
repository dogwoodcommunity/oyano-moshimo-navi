import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const sourcePath = path.join(repoRoot, "apps/web/app/api/consult/route.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
}).outputText;

class MockNextResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.cookies = { set() {} };
  }

  static json(body, init = {}) {
    return new MockNextResponse(body, init.status ?? 200);
  }

  async json() {
    return this.body;
  }
}

class ConsultMemoryAccessError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class ConsultMemoryConflictError extends Error {
  constructor() {
    super("memory conflict");
    this.code = "memory_conflict";
  }
}

class ConsultMemoryConsentRequiredError extends Error {
  constructor() {
    super("consent required");
    this.code = "memory_consent_required";
    this.status = 422;
  }
}

class ConsultMemoryNotReadyError extends Error {}
class MockAnthropicError extends Error {}

let anthropicCallCount = 0;
let persistCallCount = 0;
let snapshotCallCount = 0;
let snapshotFailures = new Set();

const answer = {
  situation: "確認できた記録をもとに整理しました。",
  nextChecks: [{ title: "状況を確認する", why: "次の対応を決めるためです。" }],
  askQuestions: [],
  providerCategories: [],
  watchOuts: [],
  recordSuggestion: "確認した内容を記録する"
};

class MockAnthropic {
  static APIError = MockAnthropicError;
  static APIConnectionTimeoutError = class extends MockAnthropicError {};
  static AuthenticationError = class extends MockAnthropicError {};
  static BadRequestError = class extends MockAnthropicError {};
  static RateLimitError = class extends MockAnthropicError {};

  constructor() {
    this.messages = {
      create: async () => {
        anthropicCallCount += 1;
        return {
          content: [{ type: "tool_use", name: "organize_consultation", input: answer }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 }
        };
      }
    };
    this.beta = { messages: this.messages };
  }
}

function queryResult(data) {
  const query = {
    delete() { return query; },
    eq() { return query; },
    gte() { return query; },
    in() { return query; },
    insert() { return Promise.resolve({ data: null, error: null }); },
    is() { return query; },
    lt() { return query; },
    select() { return query; },
    update() { return query; },
    then(resolve, reject) {
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    }
  };
  return query;
}

const serverSupabase = {
  auth: {
    async getUser() {
      return { data: { user: { id: "user-1" } }, error: null };
    }
  },
  from(table) {
    if (table === "family_members") {
      return queryResult([{ family_id: "family-1" }]);
    }
    if (table === "families") {
      return queryResult([{ id: "family-1", plan: "plus", consult_trial_used_at: null }]);
    }
    if (table === "audit_logs") {
      return queryResult([]);
    }
    throw new Error(`Unexpected server table: ${table}`);
  }
};

const durableAuthorization = {
  familyId: "family-1",
  memberRole: "owner",
  personId: "person-1",
  personRow: {},
  supabase: serverSupabase,
  userId: "user-1"
};

const durableContext = {
  familyId: "family-1",
  historyTurns: 0,
  memory: {
    consultationOverview: "過去の相談はまだありません。",
    importantChanges: [],
    latestRecords: [],
    longTermSummary: "手帳の記録は1件です。",
    memoryVersion: 3,
    priorSuggestions: [],
    relevantOlderRecords: [],
    userSummary: ""
  },
  memoryState: {
    memoryResetAt: "2026-09-01T00:00:00.000Z",
    memoryVersion: 3,
    recordCount: 1
  },
  person: { careStatus: "見守り中" },
  personId: "person-1",
  sourceEventIds: ["event-1"],
  tasks: [],
  threadId: "thread-1"
};

const mockRequire = (specifier) => {
  if (specifier === "@anthropic-ai/sdk") {
    return { __esModule: true, default: MockAnthropic };
  }
  if (specifier === "next/server") {
    return { NextResponse: MockNextResponse };
  }
  if (specifier === "@oyano/shared") {
    return {
      CONSULT_DISCLAIMER: "免責",
      CONSULT_MAX_HISTORY: 6,
      CONSULT_MAX_QUESTION_LENGTH: 600,
      hasNotebookSubstance: () => true,
      normalizeConsultAnswer: (value) => value === answer ? answer : null
    };
  }
  if (specifier === "@/lib/consult") {
    return {
      buildConsultPrompt: () => "test prompt",
      CONSULT_SYSTEM_PROMPT: "test system prompt",
      CONSULT_TOOL: { name: "organize_consultation" }
    };
  }
  if (specifier === "@/lib/consultLimits") {
    return {
      CONSULT_INPUT_USD_PER_MILLION_TOKENS: 3,
      CONSULT_MAX_OUTPUT_TOKENS: 100,
      CONSULT_OUTPUT_USD_PER_MILLION_TOKENS: 15,
      CONSULT_PER_CLIENT_DAILY_LIMIT: 20,
      CONSULT_PER_FAMILY_MONTHLY_LIMIT: 100,
      CONSULT_SERVICE_DAILY_LIMIT: 1_000,
      currentJstDayStart: () => "2026-09-01T00:00:00.000Z",
      currentJstMonthStart: () => "2026-09-01T00:00:00.000Z",
      wasUsedOnCurrentJstDay: () => false
    };
  }
  if (specifier === "@/lib/publicRateLimit") {
    return {
      checkPublicRateLimit: async () => null,
      checkServiceRateLimit: async () => ({ allowed: true, retryAfter: 0 })
    };
  }
  if (specifier === "@/lib/serverSupabase") {
    return { getServerSupabase: () => serverSupabase };
  }
  if (specifier === "@/lib/consultMemory") {
    return {
      CONSULT_MEMORY_NOT_READY_MESSAGE: "memory not ready",
      ConsultMemoryAccessError,
      ConsultMemoryConflictError,
      ConsultMemoryConsentRequiredError,
      ConsultMemoryNotReadyError,
      assertConsultMemorySnapshot: async (_authorized, expected) => {
        snapshotCallCount += 1;
        assert.deepEqual(expected, {
          memoryResetAt: "2026-09-01T00:00:00.000Z",
          memoryVersion: 3
        });
        if (snapshotFailures.has(snapshotCallCount)) throw new ConsultMemoryConflictError();
      },
      authorizeConsultPerson: async () => durableAuthorization,
      isConsultMemorySchemaMissing: () => false,
      loadDurableConsultContext: async () => durableContext,
      persistConsultTurn: async () => {
        persistCallCount += 1;
        return { id: "turn-1", createdAt: "2026-09-01T00:01:00.000Z" };
      },
      recordConsultMemoryConsent: async () => {}
    };
  }
  throw new Error(`Unexpected runtime import in consult route: ${specifier}`);
};

const moduleRecord = { exports: {} };
const load = new Function("exports", "require", "module", "__filename", "__dirname", compiled);
load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));

function consultRequest() {
  return {
    cookies: { get: () => undefined },
    headers: {
      get(name) {
        return name.toLowerCase() === "authorization" ? "Bearer test-token" : null;
      }
    },
    async json() {
      return {
        memoryConsentVersion: "consult-memory-v02-2026-09-01",
        personId: "person-1",
        question: "薬の確認について相談したいです"
      };
    }
  };
}

async function runScenario(failures) {
  anthropicCallCount = 0;
  persistCallCount = 0;
  snapshotCallCount = 0;
  snapshotFailures = new Set(failures);
  return moduleRecord.exports.POST(consultRequest());
}

const previousApiKey = process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_API_KEY = "test-key";

try {
  const changedBeforeSend = await runScenario([1]);
  assert.equal(changedBeforeSend.status, 409);
  assert.equal((await changedBeforeSend.json()).error, "memory_conflict");
  assert.equal(snapshotCallCount, 1);
  assert.equal(anthropicCallCount, 0, "stale or reset memory must never reach Anthropic");
  assert.equal(persistCallCount, 0);

  const changedDuringResponse = await runScenario([2]);
  assert.equal(changedDuringResponse.status, 409);
  assert.equal((await changedDuringResponse.json()).error, "memory_conflict");
  assert.equal(snapshotCallCount, 2, "the post-response memory assertion must remain in place");
  assert.equal(anthropicCallCount, 1);
  assert.equal(persistCallCount, 0, "a response made from stale memory must not be persisted");

  const unchanged = await runScenario([]);
  assert.equal(unchanged.status, 200);
  assert.equal(snapshotCallCount, 2);
  assert.equal(anthropicCallCount, 1);
  assert.equal(persistCallCount, 1);
} finally {
  if (previousApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previousApiKey;
}

console.log("consult route memory snapshot tests: ok");
