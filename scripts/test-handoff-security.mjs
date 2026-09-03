import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const caseId = "f5000000-0000-4000-8000-000000000001";
const caseToken = `anon_${"a".repeat(64)}`;
const proposedHandoff = `handoff_${"1".repeat(48)}`;
const persistedHandoff = `handoff_${"2".repeat(48)}`;

class MockNextResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
  }

  static json(body, init = {}) {
    return new MockNextResponse(body, init.status ?? 200);
  }

  async json() {
    return this.body;
  }
}

function compile(sourcePath) {
  return ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  }).outputText;
}

function loadCommonJs(sourcePath, mockRequire) {
  const moduleRecord = { exports: {} };
  const load = new Function("exports", "require", "module", "__filename", "__dirname", compile(sourcePath));
  load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));
  return moduleRecord.exports;
}

const ownershipPath = path.join(repoRoot, "apps/web/lib/caseOwnership.ts");
const ownership = loadCommonJs(ownershipPath, (specifier) => {
  throw new Error(`Unexpected ownership helper import: ${specifier}`);
});
const generatedCaseTokenA = ownership.createAnonymousCaseToken();
const generatedCaseTokenB = ownership.createAnonymousCaseToken();
assert.match(generatedCaseTokenA, ownership.ANONYMOUS_CASE_TOKEN_PATTERN);
assert.match(generatedCaseTokenB, ownership.ANONYMOUS_CASE_TOKEN_PATTERN);
assert.notEqual(generatedCaseTokenA, generatedCaseTokenB, "anonymous ownership tokens must not repeat");

const answers = {
  selectedStatus: "preparing",
  targetRelationship: "mother",
  targetName: "テスト母",
  parentSituation: "テスト",
  familyStructure: "テスト家族",
  hasHome: "unknown",
  knowsAssets: "unknown",
  concerns: [],
  homeClearance: "",
  consentToContact: false,
  consentToSensitiveInfo: true,
  consentTextVersion: "test-consent-v1"
};

function diagnosisRequest(token = caseToken) {
  return {
    headers: {
      get(name) {
        const key = name.toLowerCase();
        if (key === "x-case-anonymous-token") return token;
        if (key === "x-forwarded-for") return "127.0.0.1";
        if (key === "user-agent") return "handoff-regression";
        return null;
      }
    },
    async json() {
      return answers;
    }
  };
}

let rpcResult = {
  data: {
    handoffToken: persistedHandoff,
    createdAt: "2026-09-03T00:00:00.000Z",
    idempotentReplay: false
  },
  error: null
};
let rpcCalls = [];
let serverSupabase = {
  async rpc(name, params) {
    rpcCalls.push({ name, params });
    return rpcResult;
  }
};

const diagnosisPath = path.join(repoRoot, "apps/web/app/api/cases/[caseId]/diagnosis/route.ts");
const diagnosisRoute = loadCommonJs(diagnosisPath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@oyano/shared") {
    return {
      buildDiagnosisResult: () => ({
        diagnosisType: "preparing",
        summary: "summary",
        firstSteps: [],
        tasks: [],
        providerCategories: []
      }),
      createHandoffToken: () => proposedHandoff,
      SENSITIVE_INFO_CONSENT_TEXT: "consent text",
      SENSITIVE_INFO_CONSENT_VERSION: "default-consent"
    };
  }
  if (specifier === "@/lib/caseOwnership") {
    return { ANONYMOUS_CASE_TOKEN_PATTERN: /^anon_[a-f0-9]{64}$/i };
  }
  if (specifier === "@/lib/publicRateLimit") return { checkPublicRateLimit: async () => null };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => serverSupabase };
  throw new Error(`Unexpected diagnosis route import: ${specifier}`);
});

{
  rpcCalls = [];
  rpcResult = {
    data: {
      handoffToken: persistedHandoff,
      createdAt: "2026-09-03T00:00:00.000Z",
      idempotentReplay: false
    },
    error: null
  };
  const response = await diagnosisRoute.POST(diagnosisRequest(), { params: { caseId } });
  assert.equal(response.status, 200);
  assert.equal(response.body.persisted, true);
  assert.equal(response.body.record.handoffToken, persistedHandoff, "route must trust only the token committed by the RPC");
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, "submit_anonymous_case_diagnosis");
  assert.equal(rpcCalls[0].params.p_case_id, caseId);
  assert.equal(rpcCalls[0].params.p_anonymous_token, caseToken);
  assert.equal(rpcCalls[0].params.p_handoff_token, proposedHandoff);
}

{
  rpcCalls = [];
  const response = await diagnosisRoute.POST(diagnosisRequest(""), { params: { caseId } });
  assert.equal(response.status, 400);
  assert.equal(rpcCalls.length, 0, "missing ownership proof must fail before database access");
}

for (const [message, expectedStatus] of [
  ["invalid_case_token", 404],
  ["case_already_converted", 409],
  ["case_already_submitted", 409],
  ["case_state_conflict", 409],
  ["database exploded with internal detail", 500]
]) {
  rpcResult = { data: null, error: { message } };
  const response = await diagnosisRoute.POST(diagnosisRequest(), { params: { caseId } });
  assert.equal(response.status, expectedStatus, `${message} mapped to the wrong status`);
  if (expectedStatus === 500) {
    assert.doesNotMatch(response.body.error, /internal detail/, "unknown database errors must not be reflected");
  }
}

const handoffPath = path.join(repoRoot, "apps/web/app/api/handoff/consume/route.ts");
const handoffRoute = loadCommonJs(handoffPath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/serverSupabase") {
    return {
      getServerSupabase: () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "f5000000-0000-4000-8000-000000000002", email: "member@example.test" } },
            error: null
          })
        },
        rpc: async () => ({ data: null, error: { message: "case_not_ready" } })
      })
    };
  }
  throw new Error(`Unexpected handoff route import: ${specifier}`);
});

{
  const response = await handoffRoute.POST({
    headers: { get: (name) => name.toLowerCase() === "authorization" ? "Bearer test-token" : null },
    json: async () => ({ caseId, token: persistedHandoff, displayName: "Member" })
  });
  assert.equal(response.status, 409, "a diagnosis that is not result_ready must be a state conflict, not a server error");
}

{
  serverSupabase = null;
  const response = await diagnosisRoute.POST(diagnosisRequest(), { params: { caseId } });
  assert.equal(response.status, 200);
  assert.equal(response.body.persisted, false);
  assert.equal(response.body.record.handoffToken, proposedHandoff);
}

let insertedCase = null;
const createSupabase = {
  from(table) {
    assert.equal(table, "cases");
    return {
      async insert(value) {
        insertedCase = value;
        return { error: null };
      }
    };
  }
};
const createPath = path.join(repoRoot, "apps/web/app/api/cases/route.ts");
const createRoute = loadCommonJs(createPath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/caseOwnership") return { createAnonymousCaseToken: () => caseToken };
  if (specifier === "@/lib/publicRateLimit") return { checkPublicRateLimit: async () => null };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => createSupabase };
  if (specifier === "@oyano/shared") return {};
  throw new Error(`Unexpected case-create route import: ${specifier}`);
});

{
  const response = await createRoute.POST({ async json() { return { selectedStatus: "preparing" }; } });
  assert.equal(response.status, 200);
  assert.equal(response.body.caseToken, caseToken, "draft creator must receive its ownership proof");
  assert.equal(insertedCase.anonymous_token, caseToken, "draft must persist the same high-entropy ownership proof");
  assert.match(insertedCase.anonymous_token, /^anon_[a-f0-9]{64}$/);
  assert.equal(insertedCase.status, "draft");
}

let consumeRpcError = null;
let consumeRpcCalls = [];
const consumeSupabase = {
  auth: {
    async getUser(token) {
      assert.equal(token, "valid-bearer");
      return {
        data: { user: { id: "f5000000-0000-4000-8000-000000000002", email: "owner@example.test" } },
        error: null
      };
    }
  },
  async rpc(name, params) {
    consumeRpcCalls.push({ name, params });
    return consumeRpcError
      ? { data: null, error: { message: consumeRpcError } }
      : {
          data: {
            familyId: "f5000000-0000-4000-8000-000000000003",
            personId: "f5000000-0000-4000-8000-000000000004",
            reusedExistingCase: false,
            idempotentReplay: false
          },
          error: null
        };
  }
};
const consumePath = path.join(repoRoot, "apps/web/app/api/handoff/consume/route.ts");
const consumeRoute = loadCommonJs(consumePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => consumeSupabase };
  throw new Error(`Unexpected consume route import: ${specifier}`);
});
const consumeRequest = () => ({
  headers: {
    get(name) {
      return name.toLowerCase() === "authorization" ? "Bearer valid-bearer" : null;
    }
  },
  async json() {
    return { caseId, token: proposedHandoff, displayName: "Owner" };
  }
});

for (const [message, expectedStatus] of [
  ["invalid_or_consumed_handoff_token", 404],
  ["case_already_converted", 409],
  ["case_not_ready", 409],
  ["case_state_conflict", 409]
]) {
  consumeRpcError = message;
  consumeRpcCalls = [];
  const response = await consumeRoute.POST(consumeRequest());
  assert.equal(response.status, expectedStatus, `consume ${message} mapped to the wrong status`);
  assert.equal(consumeRpcCalls.length, 1);
  assert.equal(consumeRpcCalls[0].name, "consume_case_handoff");
}

consumeRpcError = null;

const diagnosisFormSource = fs.readFileSync(
  path.join(repoRoot, "apps/web/app/diagnosis/DiagnosisForm.tsx"),
  "utf8"
);
assert.match(diagnosisFormSource, /createAnonymousCaseToken\(\)/, "diagnosis UI must create an ownership proof");
assert.match(diagnosisFormSource, /submitDiagnosis\(caseId, answers, caseToken\)/, "diagnosis UI must send its proof");

const storeSource = fs.readFileSync(path.join(repoRoot, "apps/web/lib/store.ts"), "utf8");
assert.match(storeSource, /"X-Case-Anonymous-Token": caseToken/, "client request must carry the proof in a header");
assert.doesNotMatch(
  storeSource.slice(storeSource.indexOf("export async function submitDiagnosis"), storeSource.indexOf("export function createLocalDemoCase")),
  /createHandoffToken/,
  "HTTP failures must not fabricate a handoff token that the server never persisted"
);

for (const relativePath of [
  "supabase/handoff_consume_rpc.sql",
  "supabase/production_pending_hardening.sql"
]) {
  const sql = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  assert.match(sql, /raise exception 'case_already_converted'/);
  assert.match(sql, /v_result\.app_handoff_consumed_at is not null/);
  assert.match(sql, /exists \(\s*select 1\s*from family_members\s*where family_id = v_case\.family_id\s*and user_id = p_user_id/s);
  assert.doesNotMatch(sql, /on conflict \(family_id, user_id\) do update set/);
  assert.match(sql, /v_case\.status is distinct from 'result_ready'/);
  assert.match(sql, /and status = 'result_ready'/);
  assert.ok(
    sql.indexOf("raise exception 'case_already_converted'") < sql.indexOf("insert into profiles"),
    `${relativePath} must reject linked cases before any user/profile mutation`
  );
}

console.log("Anonymous diagnosis and handoff route regression: ok");
