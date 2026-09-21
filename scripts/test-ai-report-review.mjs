import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const ts = require("typescript");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
function load(name, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(name), { fileName: name, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
  } }).outputText;
  new Function("exports", "require", "module", code)(module.exports, (specifier) => {
    if (specifier in mocks) return mocks[specifier];
    if (specifier.startsWith("node:") || specifier === "crypto") return require(specifier);
    throw Error(`Unmocked dependency ${specifier}`);
  }, module);
  return module.exports;
}
const id = (digit, tail = 1) => `${digit}0000000-0000-4000-8000-${String(tail).padStart(12, "0")}`;
const ADMIN = id(1), REPORTER = id(2), OTHER = id(3), REPORT = id(4), TURN = id(5), THREAD = id(6), PERSON = id(7), FAMILY = id(8);
const REPORT_ACTION = "ai_consult_answer_report", REVIEW_ACTION = "ai_consult_answer_report_review";
const jwt = (aal, sub = ADMIN) => `header.${Buffer.from(JSON.stringify({ aal, sub })).toString("base64url")}.synthetic-signature`;
const TOKEN = jwt("aal2"), AAL1 = jwt("aal1");
const answer = { situation: "SYNTHETIC PRIVATE ANSWER", nextChecks: [], askQuestions: [], providerCategories: [], watchOuts: [], recordSuggestion: "synthetic" };
const reportRow = (reportId = REPORT) => ({ id: reportId, action: REPORT_ACTION, target_type: "ai_consult_turn", target_id: TURN,
  actor_user_id: REPORTER, metadata: { reason: "unsafe", consent_version: "ai-answer-report-v1-2026-09-20" }, created_at: "2026-09-21T00:00:00Z" });
const initialTables = () => ({
  app_admins: [{ id: id(9), user_id: ADMIN }],
  audit_logs: [reportRow()],
  ai_consult_turns: [{ id: TURN, thread_id: THREAD, question: "SYNTHETIC PRIVATE QUESTION", answer }],
  ai_consult_threads: [{ id: THREAD, person_id: PERSON, owner_user_id: REPORTER }],
  people: [{ id: PERSON, family_id: FAMILY }],
  family_members: [{ family_id: FAMILY, user_id: REPORTER }]
});
let db;
function createDb(options = {}) {
  const tables = { ...initialTables(), ...options.tables };
  const reads = [], writes = [];
  return {
    tables, reads, writes,
    auth: { getUser: async (token) => ({ data: { user: options.invalidAuth || ![TOKEN, AAL1, jwt("aal2", OTHER)].includes(token) ? null : { id: token === jwt("aal2", OTHER) ? OTHER : ADMIN, email: "synthetic@example.test" } }, error: null }) },
    from(table) {
      assert.ok(table in tables, table);
      const filters = [], orders = [];
      let columns, maximum, range, inserted;
      const query = {
        select(value) { columns = value; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        order(key, order) { orders.push([key, order]); return query; },
        limit(value) { maximum = value; return query; },
        range(start, end) { range = [start, end]; return query; },
        insert(value) { assert.equal(table, "audit_logs"); inserted = value; return query; },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); }
      };
      async function execute(single) {
        if (inserted) {
          writes.push(inserted);
          if (options.writeError) return { data: null, error: { code: "synthetic_failure" } };
          if (tables.audit_logs.some((row) => row.id === inserted.id)) return { data: null, error: { code: "23505" } };
          const row = { ...inserted, created_at: "2026-09-21T01:00:00Z" };
          tables.audit_logs.push(row);
          return { data: options.missingAck ? null : project(row), error: null };
        }
        reads.push({ table, columns, filters, orders });
        if (options.readError === table) return { data: null, error: { code: "synthetic_failure" } };
        let rows = tables[table].filter((row) => filters.every(([key, value]) => row[key] === value));
        rows.sort((a, b) => {
          for (const [key, order] of orders) {
            const get = (row) => key === "metadata->revision" ? row.metadata?.revision : row[key];
            if (get(a) < get(b)) return order.ascending ? -1 : 1;
            if (get(a) > get(b)) return order.ascending ? 1 : -1;
          }
          return 0;
        });
        if (range) rows = rows.slice(range[0], range[1] + 1);
        if (maximum !== undefined) rows = rows.slice(0, maximum);
        return { data: single ? rows.length === 1 ? project(rows[0]) : null : rows.map(project), error: null };
      }
      function project(row) { return Object.fromEntries(columns.split(",").map((key) => [key, row[key]])); }
      return query;
    }
  };
}
const next = { NextResponse: { json: (body, options = {}) => new Response(JSON.stringify(body), { ...options, headers: { "Content-Type": "application/json", ...options.headers } }) } };
const serverModule = { getServerSupabase: () => db };
const adminAuth = load("apps/web/lib/adminAuth.ts", { "next/server": next, "./serverSupabase": serverModule });
const operator = load("apps/web/lib/aiReportOperator.ts", { "next/server": next, "@/lib/serverSupabase": serverModule, "@/lib/adminAuth": adminAuth });
const types = load("apps/web/lib/aiReportReviewTypes.ts");
const reviews = load("apps/web/lib/aiReportReview.ts", { "@/lib/aiReportOperator": operator, "@/lib/aiReportReviewTypes": types,
  "@oyano/shared": { normalizeConsultAnswer: (value) => value?.situation ? value : null } });
const mocks = { "@/lib/aiReportOperator": operator, "@/lib/aiReportReview": reviews };
const listRoute = load("apps/web/app/api/admin/ai-reports/route.ts", mocks);
const detailRoute = load("apps/web/app/api/admin/ai-reports/[reportId]/route.ts", mocks);
const authRoute = load("apps/web/app/api/admin/ai-reports/auth-status/route.ts", mocks);
const context = (reportId = REPORT) => ({ params: { reportId } });
const req = (token = TOKEN, body, suffix = "") => new Request(`https://synthetic.invalid/api/admin/ai-reports${suffix}`, {
  method: body === undefined ? "GET" : "PATCH", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body)
});
const change = { expectedRevision: 0, status: "reviewing", outcome: "investigating" };

for (const token of [null, "invalid", AAL1, jwt("aal2", OTHER)]) {
  db = createDb();
  for (const response of [await listRoute.GET(req(token)), await detailRoute.GET(req(token), context()), await detailRoute.PATCH(req(token, change), context())]) {
    assert.ok([401, 403].includes(response.status));
  }
  assert.equal(db.writes.length, 0);
  assert.ok(db.reads.every((entry) => entry.table === "app_admins"));
}
const oldStatic = process.env.ADMIN_ACCESS_TOKEN;
try {
  process.env.ADMIN_ACCESS_TOKEN = "synthetic-static";
  db = createDb({ tables: { app_admins: [] } });
  const request = req(); request.headers.set("x-admin-token", "synthetic-static");
  assert.equal((await listRoute.GET(request)).status, 403, "static fallback never grants report access");
} finally { if (oldStatic === undefined) delete process.env.ADMIN_ACCESS_TOKEN; else process.env.ADMIN_ACCESS_TOKEN = oldStatic; }
db = createDb();
assert.equal((await authRoute.GET(req(AAL1))).status, 200, "allowlisted AAL1 can reach MFA step-up but cannot read reports");
db = createDb({ invalidAuth: true });
assert.equal((await listRoute.GET(req())).status, 401, "forged AAL2 is not trusted without getUser verification");
db = null;
assert.equal((await listRoute.GET(req())).status, 503);

db = createDb({ tables: { audit_logs: Array.from({ length: 23 }, (_, index) => reportRow(id(4, index + 1))) } });
let response = await listRoute.GET(req());
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "private, no-store");
const page = await response.json();
assert.equal(page.reports.length, 20); assert.equal(page.hasMore, true);
assert.ok(db.reads.every((entry) => ["app_admins", "audit_logs"].includes(entry.table)));
assert.doesNotMatch(JSON.stringify(page), /SYNTHETIC PRIVATE|actor_user_id|target_id|question|answer|family_id|person_id/);
assert.equal((await listRoute.GET(req(TOKEN, undefined, "?offset=-1"))).status, 400);
assert.equal((await listRoute.GET(req(TOKEN, undefined, "?offset=20"))).status, 200);

db = createDb();
response = await detailRoute.GET(req(), context());
assert.equal(response.status, 200);
let detail = await response.json();
assert.equal(detail.content.question, "SYNTHETIC PRIVATE QUESTION");
assert.equal(detail.content.answer.situation, answer.situation);
const contentReads = db.reads.filter((entry) => entry.columns === "question,answer");
assert.equal(contentReads.length, 1);
assert.deepEqual(contentReads[0].filters, [["id", TURN], ["thread_id", THREAD]]);
assert.equal(db.writes[0].action, "ai_consult_answer_report_viewed");
assert.equal(db.writes[0].actor_user_id, ADMIN);
assert.deepEqual(db.writes[0].metadata, { content_available: true });
assert.doesNotMatch(JSON.stringify(db.writes), /SYNTHETIC PRIVATE/);
db.tables.app_admins = [];
assert.equal((await detailRoute.GET(req(), context())).status, 403, "revoked allowlist is rechecked every time");

for (const altered of [
  { audit_logs: [{ ...reportRow(), actor_user_id: null }] },
  { audit_logs: [{ ...reportRow(), metadata: { reason: "unsafe" } }] },
  { ai_consult_turns: [] }, { ai_consult_threads: [] }, { people: [] }, { family_members: [] },
  { ai_consult_threads: [{ id: THREAD, person_id: PERSON, owner_user_id: OTHER }] },
  { family_members: [{ family_id: FAMILY, user_id: OTHER }] }
]) {
  db = createDb({ tables: altered });
  response = await detailRoute.GET(req(), context());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content, null);
  assert.equal(db.reads.some((entry) => entry.columns === "question,answer"), false, "no body read without exact owner, active family access and report consent");
}
db = createDb({ tables: { audit_logs: [{ ...reportRow(), action: "unrelated_audit" }] } });
assert.equal((await detailRoute.GET(req(), context())).status, 404);
db = createDb();
assert.equal((await detailRoute.GET(req(), context("not-a-uuid"))).status, 400);
assert.equal((await detailRoute.GET(req(), context(id(4, 99)))).status, 404);
for (const table of ["audit_logs", "app_admins", "ai_consult_turns", "ai_consult_threads", "people", "family_members"]) {
  db = createDb({ readError: table });
  response = await detailRoute.GET(req(), context());
  assert.equal(response.status, 503, table);
  assert.doesNotMatch(await response.text(), /SYNTHETIC PRIVATE|synthetic_failure/);
}
for (const options of [{ writeError: true }, { missingAck: true }]) {
  db = createDb(options);
  response = await detailRoute.GET(req(), context());
  assert.equal(response.status, 503, "content is withheld when view audit is not acknowledged");
  assert.doesNotMatch(await response.text(), /SYNTHETIC PRIVATE/);
}

for (const invalid of [null, {}, { ...change, expectedRevision: -1 }, { ...change, expectedRevision: 1.5 },
  { ...change, status: "closed" }, { ...change, outcome: "freeform" }, { ...change, note: "PRIVATE COPY" }]) {
  db = createDb();
  assert.equal((await detailRoute.PATCH(req(TOKEN, invalid), context())).status, 400);
  assert.equal(db.writes.length, 0);
}
db = createDb();
response = await detailRoute.PATCH(req(TOKEN, change), context());
assert.equal(response.status, 200);
assert.equal((await response.json()).review.revision, 1);
assert.equal(db.tables.audit_logs.length, 2);
assert.deepEqual(db.tables.audit_logs[0], reportRow(), "original report is unchanged");
assert.equal((await detailRoute.PATCH(req(TOKEN, change), context())).status, 200, "lost acknowledgment can be retried idempotently");
assert.equal(db.tables.audit_logs.length, 2);
assert.equal((await detailRoute.PATCH(req(TOKEN, { ...change, status: "closed", outcome: "no_issue" }), context())).status, 409);
for (let revision = 1; revision < 11; revision++) {
  assert.equal((await detailRoute.PATCH(req(TOKEN, { ...change, expectedRevision: revision }), context())).status, 200);
}
response = await detailRoute.GET(req(), context());
detail = await response.json();
assert.equal(detail.review.revision, 11, "revisions are ordered numerically, not lexically or by timestamp");
assert.equal(detail.reviews[0].revision, 11);
db = createDb();
const concurrent = await Promise.all([
  detailRoute.PATCH(req(TOKEN, change), context()),
  detailRoute.PATCH(req(TOKEN, { ...change, status: "closed", outcome: "no_issue" }), context())
]);
assert.deepEqual(concurrent.map((item) => item.status).sort(), [200, 409]);
assert.equal(db.tables.audit_logs.filter((row) => row.action === REVIEW_ACTION).length, 1);
for (const options of [{ writeError: true }, { missingAck: true }]) {
  db = createDb(options);
  assert.equal((await detailRoute.PATCH(req(TOKEN, change), context())).status, 503);
}

assert.doesNotMatch(read("apps/web/lib/aiReportReview.ts"), /\.delete\(|\.select\("\*"\)|console\./);
assert.match(read("apps/web/app/admin/ai-reports/page.tsx"), /showEmergencyToken=\{false\}/);
assert.match(read("apps/web/app/admin/ai-reports/page.tsx"), /mfaSetupHref=\{null\}/);
assert.match(read("apps/web/app/legal/privacy/page.tsx"), /通報調査に本人が同意した場合を除き/);
console.log("PASS AI report operator: Bearer/allowlist/AAL2, one reported owner/turn, audited reads, deletion/permission failures, append-only revisions, conflicts and acknowledged writes (synthetic only)");
