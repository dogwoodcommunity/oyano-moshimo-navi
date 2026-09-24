import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const ts = require("typescript");
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", compiled)(module.exports, (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("node:")) return require(name);
    throw new Error(`Unmocked dependency: ${name}`);
  }, module);
  return module.exports;
}

const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  other: "10000000-0000-4000-8000-000000000002",
  turn: "20000000-0000-4000-8000-000000000001",
  thread: "30000000-0000-4000-8000-000000000001",
  person: "40000000-0000-4000-8000-000000000001",
  family: "50000000-0000-4000-8000-000000000001"
};
const helper = load("apps/web/lib/consultReport.ts");
let server;
const { POST } = load("apps/web/app/api/consult/report/route.ts", {
  "next/server": { NextResponse: { json: (body, init) => ({ body, ...init }) } },
  "@/lib/serverSupabase": { getServerSupabase: () => server },
  "@/lib/consultReport": helper
});
const payload = { turnId: ids.turn, reason: "unsafe" };
function request(body = payload, authorization = "Bearer synthetic-token") {
  return { headers: { get: () => authorization }, json: async () => body };
}
function mockServer(options = {}) {
  const tables = {
    ai_consult_turns: [{ id: ids.turn, thread_id: ids.thread }],
    ai_consult_threads: [{ id: ids.thread, owner_user_id: ids.user, person_id: ids.person }],
    people: [{ id: ids.person, family_id: ids.family }],
    family_members: [{ user_id: ids.user, family_id: ids.family }],
    audit_logs: [],
    ...options.tables
  };
  const reads = [];
  const writes = [];
  return {
    tables, reads, writes,
    auth: { async getUser(token) {
      assert.equal(token, "synthetic-token");
      if (options.authThrow) throw new Error("synthetic auth outage");
      return { data: { user: options.noUser ? null : { id: ids.user } }, error: options.authError ? {} : null };
    } },
    from(table) {
      assert.ok(table in tables, table);
      const filters = [];
      let insert;
      const query = {
        select(columns) { reads.push({ table, columns }); return query; },
        eq(column, value) { filters.push((row) => row[column] === value); return query; },
        insert(value) { insert = value; writes.push(value); return query; },
        async maybeSingle() {
          if (options.throwTable === table) throw new Error("synthetic database outage");
          if (insert) {
            if (options.writeError) return { data: null, error: { code: options.writeError } };
            if (tables[table].some((row) => row.id === insert.id)) return { data: null, error: { code: "23505" } };
            tables[table].push(insert);
            return { data: options.missingAck ? null : { id: insert.id }, error: null };
          }
          if (options.readError === table) return { data: null, error: { code: "synthetic" } };
          return { data: tables[table].find((row) => filters.every((filter) => filter(row))) ?? null, error: null };
        }
      };
      return query;
    }
  };
}

for (const authorization of [null, "", "Basic abc", "Bearer ", "Bearer token extra"]) {
  server = mockServer();
  assert.equal((await POST(request(payload, authorization))).status, 401);
  assert.equal(server.reads.length, 0);
}
server = null;
assert.equal((await POST(request())).status, 503);
for (const options of [{ noUser: true }, { authError: true }, { authThrow: true }]) {
  server = mockServer(options);
  assert.equal((await POST(request())).status, options.authThrow ? 503 : 401);
  assert.equal(server.writes.length, 0);
}
for (const body of [null, [], {}, { ...payload, turnId: "local-id" }, { ...payload, turnId: "' OR true" },
  { ...payload, reason: "unknown" }, { ...payload, reason: null }, { ...payload, answer: "client forgery" },
  { ...payload, userId: ids.other }, { ...payload, personId: ids.person }]) {
  server = mockServer();
  assert.equal((await POST(request(body))).status, 400);
  assert.equal(server.writes.length, 0);
}
server = mockServer();
assert.equal((await POST({ ...request(), json: async () => { throw new Error("invalid JSON"); } })).status, 400);

for (const table of ["ai_consult_turns", "ai_consult_threads", "people", "family_members"]) {
  server = mockServer({ tables: { [table]: [] } });
  assert.equal((await POST(request())).status, 404, `missing ${table}`);
  assert.equal(server.writes.length, 0);
  server = mockServer({ readError: table });
  assert.equal((await POST(request())).status, 503, `read failure ${table}`);
  assert.equal(server.writes.length, 0);
}
server = mockServer({ tables: { ai_consult_threads: [{ id: ids.thread, owner_user_id: ids.other, person_id: ids.person }] } });
assert.equal((await POST(request())).status, 404, "a family member cannot report another user's private turn");
assert.equal(server.writes.length, 0);
server = mockServer({ tables: { family_members: [{ user_id: ids.user, family_id: ids.other }] } });
assert.equal((await POST(request())).status, 404, "membership in another family is insufficient");

server = mockServer();
const accepted = await POST(request());
assert.equal(accepted.status, 200);
assert.equal(accepted.headers["Cache-Control"], "no-store");
assert.deepEqual(accepted.body, { received: true, alreadyReported: false });
const stored = server.tables.audit_logs[0];
assert.equal(stored.actor_user_id, ids.user);
assert.equal(stored.target_id, ids.turn);
assert.deepEqual(stored.metadata, { reason: "unsafe", consent_version: "ai-answer-report-v1-2026-09-20" });
assert.ok(server.reads.every((entry) => !entry.columns.includes("question") && !entry.columns.includes("answer")));
const duplicate = await POST(request({ ...payload, reason: "other" }));
assert.deepEqual(duplicate.body, { received: true, alreadyReported: true });
assert.equal(server.tables.audit_logs.length, 1);
assert.equal(server.tables.audit_logs[0].metadata.reason, "unsafe", "retry cannot overwrite the first report");
server.tables.family_members = [];
assert.equal((await POST(request())).status, 404, "duplicates also require current authorization");

server = mockServer();
const simultaneous = await Promise.all([POST(request()), POST(request())]);
assert.equal(server.tables.audit_logs.length, 1);
assert.equal(simultaneous.filter((result) => result.body.alreadyReported).length, 1);
for (const options of [{ writeError: "42501" }, { writeError: "23503" }, { writeError: "23505" },
  { missingAck: true }, { throwTable: "audit_logs" }]) {
  server = mockServer(options);
  assert.equal((await POST(request())).status, 503, JSON.stringify(options));
}
server = mockServer({ readError: "audit_logs" });
assert.equal((await POST(request())).status, 200);
assert.equal((await POST(request())).status, 503, "cannot confirm duplicate on read failure");
server = mockServer();
await POST(request());
server.tables.audit_logs[0].actor_user_id = null;
assert.equal((await POST(request())).status, 503, "a conflicting row with an erased actor is not an acknowledgment");

const source = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
assert.match(source, /create table if not exists audit_logs \([\s\S]*?actor_user_id uuid references profiles\(id\) on delete set null/);
assert.match(fs.readFileSync(path.join(root, "supabase/production_rls.sql"), "utf8"), /create policy "admin read audit_logs"\s+on audit_logs for select\s+using \(is_app_admin\(\)\)/);

let mobileSession = { data: { session: { access_token: "synthetic-mobile-token" } }, error: null };
let mobileConfigured = true;
const mobile = load("apps/mobile/lib/consultReport.ts", {
  "./supabase": { getSupabase: () => mobileConfigured ? { auth: { getSession: async () => mobileSession } } : null }
});
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
let fetchCalls = [];
let response = { ok: true, json: async () => ({ received: true, alreadyReported: false }) };
globalThis.fetch = async (url, options) => { fetchCalls.push({ url, options }); return response; };
try {
  delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
  assert.equal((await mobile.reportAiAnswer(ids.turn, "unsafe")).ok, false);
  process.env.EXPO_PUBLIC_WEB_BASE_URL = "https://synthetic.invalid/";
  assert.equal((await mobile.reportAiAnswer("local-turn", "unsafe")).ok, false);
  assert.equal((await mobile.reportAiAnswer(ids.turn, "unknown")).ok, false);
  mobileConfigured = false;
  assert.equal((await mobile.reportAiAnswer(ids.turn, "unsafe")).ok, false);
  mobileConfigured = true;
  mobileSession = { data: { session: null }, error: null };
  assert.equal((await mobile.reportAiAnswer(ids.turn, "unsafe")).ok, false);
  mobileSession = { data: { session: { access_token: "synthetic-mobile-token" } }, error: {} };
  assert.equal((await mobile.reportAiAnswer(ids.turn, "unsafe")).ok, false);
  assert.equal(fetchCalls.length, 0);
  mobileSession.error = null;
  assert.deepEqual(await mobile.reportAiAnswer(ids.turn, "unsafe"), { ok: true, alreadyReported: false });
  assert.equal(fetchCalls[0].url, "https://synthetic.invalid/api/consult/report");
  assert.equal(fetchCalls[0].options.headers.Authorization, "Bearer synthetic-mobile-token");
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), payload);
  for (const body of [null, {}, { received: true }, { received: "true", alreadyReported: false }]) {
    response = { ok: true, json: async () => body };
    assert.equal((await mobile.reportAiAnswer(ids.turn, "unsafe")).ok, false);
  }
  response = { ok: false, json: async () => ({ received: true, alreadyReported: false, message: "synthetic denied" }) };
  assert.deepEqual(await mobile.reportAiAnswer(ids.turn, "unsafe"), { ok: false, message: "synthetic denied" });
  response = { ok: true, json: async () => ({ received: true, alreadyReported: true }) };
  assert.deepEqual(await mobile.reportAiAnswer(ids.turn, "unsafe"), { ok: true, alreadyReported: true });
  globalThis.fetch = async () => { throw new Error("synthetic disconnect"); };
  assert.equal((await mobile.reportAiAnswer(ids.turn, "unsafe")).ok, false);
} finally {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
  else process.env.EXPO_PUBLIC_WEB_BASE_URL = originalUrl;
}

let hooks = [];
let cursor = 0;
let reports = [];
let sendResult = async () => ({ ok: false, message: "synthetic retry" });
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const { ReportAiAnswer } = load("apps/mobile/components/ReportAiAnswer.tsx", {
  "react": {
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; }
  },
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "react-native": { Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: (value) => value } },
  "@/lib/consultReport": { AI_REPORT_REASONS: mobile.AI_REPORT_REASONS, reportAiAnswer: (...args) => { reports.push(args); return sendResult(); } },
  "@/lib/theme": { colors: {}, radius: {} }
});
const form = ReportAiAnswer({ turnId: ids.turn });
assert.equal(form.key, ids.turn, "identity changes remount the form and discard consent");
function render() { cursor = 0; return form.type(form.props); }
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object") return [];
  return [node, ...flatten(node.props.children)];
}
function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join("");
  return node && typeof node === "object" ? textOf(node.props.children) : typeof node === "string" ? node : "";
}
function button(label) { return flatten(render()).find((node) => node.type === "Pressable" && textOf(node).includes(label)); }
button("このAI回答").props.onPress();
assert.equal(reports.length, 0, "opening does not report");
button("同意して報告する").props.onPress();
assert.equal(reports.length, 0);
button("危険な行動").props.onPress();
button("同意して報告する").props.onPress();
assert.equal(reports.length, 0, "a reason alone is insufficient");
button("説明を確認").props.onPress();
assert.equal(button("同意して報告する").props.disabled, false);
button("同意して報告する").props.onPress();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(reports, [[ids.turn, "unsafe"]]);
assert.ok(textOf(render()).includes("synthetic retry"));
assert.ok(button("説明を確認").props.accessibilityState.checked, "failure preserves explicit choice for retry");
let resolveSend;
sendResult = () => new Promise((resolve) => { resolveSend = resolve; });
const retry = button("同意して報告する");
retry.props.onPress();
retry.props.onPress();
assert.equal(reports.length, 2, "rapid double press cannot send twice");
assert.equal(button("受付を確認").props.disabled, true);
resolveSend({ ok: true, alreadyReported: true });
await new Promise((resolve) => setImmediate(resolve));
assert.ok(textOf(render()).includes("この回答は報告済みです"));
assert.equal(flatten(render()).some((node) => node.type === "Pressable"), false);
console.log("PASS consult report: authorization, private ownership, revoked family access, input validation, read/write failures, insert-once retries, mobile transport and consent UI (synthetic only)");
