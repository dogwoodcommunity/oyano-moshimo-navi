import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const deferred = () => { let resolve; const promise = new Promise((complete) => { resolve = complete; }); return { promise, resolve }; };
function load(name, mocks, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, name), "utf8"), {
    fileName: name, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, require: (specifier) => {
    if (specifier in mocks) return mocks[specifier]; throw Error(`Unexpected dependency ${specifier}`);
  }, Date, Error, AbortController, ...globals });
  return module.exports;
}
const types = load("apps/web/lib/aiReportReviewTypes.ts", {});
const ID = "40000000-0000-4000-8000-000000000001";
const review = { revision: 0, status: "received", outcome: null, updatedAt: null, operatorId: null };
const report = { id: ID, reason: "unsafe", createdAt: "2026-09-21T00:00:00Z", review };
const detail = { ...report, reviews: [], content: { question: "SYNTHETIC PRIVATE QUESTION", answer: {
  situation: "SYNTHETIC PRIVATE ANSWER", nextChecks: [], askQuestions: [], providerCategories: [], watchOuts: [], recordSuggestion: "synthetic"
} } };
const page = { reports: [report], offset: 0, hasMore: false };
const response = (body, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: async () => body });
function harness() {
  let token = "operator-token", hooks = [], cursor = 0;
  const pendingEffects = [], cleanups = [], requests = [], windowEvents = new Map(), documentEvents = new Map();
  const pending = [];
  const storage = { getItem: () => token, setItem() { throw Error("Report content must not be persisted"); } };
  const document = { hidden: false, addEventListener: (type, fn) => documentEvents.set(type, fn), removeEventListener: (type) => documentEvents.delete(type) };
  const window = { localStorage: storage, addEventListener: (type, fn) => windowEvents.set(type, fn), removeEventListener: (type) => windowEvents.delete(type) };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], (value) => { hooks[i] = typeof value === "function" ? value(hooks[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useEffect(fn) { const i = cursor++; if (!(i in hooks)) { hooks[i] = true; pendingEffects.push(fn); } }
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const component = load("apps/web/components/AdminAiReports.tsx", {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@/lib/adminClientAuth": { ADMIN_BEARER_TOKEN_STORAGE_KEY: "bearer", adminBearerHeaders: () => token ? { Authorization: `Bearer ${token}` } : {} },
    "@/lib/aiReportReviewClient": { AI_REPORT_PAGE_SIZE: 20 },
    "@/lib/aiReportReviewTypes": types
  }, { window, document, fetch: (url, init) => {
    requests.push({ url, init });
    const next = pending.shift();
    assert.ok(next, "every request uses a synthetic queued response");
    return next;
  } }).AdminAiReports;
  const render = () => { cursor = 0; return component(); };
  return { requests, pending, render, document,
    mount() { render(); pendingEffects.splice(0).forEach((effect) => cleanups.push(effect())); },
    changeToken(value) { token = value; windowEvents.get("admin-auth-changed")?.(); },
    storageChange(value) { token = value; windowEvents.get("storage")?.({ key: "bearer" }); },
    hide() { document.hidden = true; documentEvents.get("visibilitychange")?.(); },
    unmount() { cleanups.forEach((cleanup) => cleanup?.()); }
  };
}
function nodes(node) { return Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props.children)] : []; }
function text(node) { return Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props.children) : typeof node === "string" ? node : ""; }
const button = (h, label) => nodes(h.render()).find((node) => node.type === "button" && text(node).includes(label));
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function loaded() {
  const h = harness(); h.pending.push(Promise.resolve(response(page))); h.mount(); await settle(); return h;
}

{
  const h = await loaded();
  assert.equal(h.requests.length, 1);
  assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE/);
  h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
  assert.equal(h.requests[1].url, `/api/admin/ai-reports/${ID}`);
  assert.match(text(h.render()), /SYNTHETIC PRIVATE QUESTION/);
  const select = nodes(h.render()).find((node) => node.type === "select");
  select.props.onChange({ target: { value: "reviewing:investigating" } });
  h.pending.push(Promise.resolve(response({ message: "synthetic failure" }, false)));
  button(h, "対応状況を保存").props.onClick(); await settle();
  assert.match(text(h.render()), /synthetic failure/);
  assert.doesNotMatch(text(h.render()), /対応状況を保存しました/);
  assert.equal(nodes(h.render()).find((node) => node.type === "select").props.value, "reviewing:investigating");
  const saved = { ...review, revision: 1, status: "reviewing", outcome: "investigating", operatorId: "operator", updatedAt: "2026-09-21T01:00:00Z" };
  h.pending.push(Promise.resolve(response({ saved: true, review: saved })));
  button(h, "対応状況を保存").props.onClick(); await settle();
  assert.match(text(h.render()), /対応状況を保存しました/);
  assert.deepEqual(JSON.parse(h.requests.at(-1).init.body), { expectedRevision: 0, status: "reviewing", outcome: "investigating" });
  button(h, "本文を閉じる").props.onClick();
  assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE/);
  h.unmount();
}
for (const boundary of ["logout", "storage", "hidden", "unmount"]) {
  const h = await loaded(), delayed = deferred();
  h.pending.push(delayed.promise); button(h, "この1件を確認").props.onClick();
  if (boundary === "logout") h.changeToken(null);
  if (boundary === "storage") h.storageChange(null);
  if (boundary === "hidden") h.hide();
  if (boundary === "unmount") h.unmount();
  delayed.resolve(response(detail)); await settle();
  assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE/, `${boundary} must discard a delayed detail`);
  assert.equal(h.requests[1].init.signal.aborted, true);
  if (boundary !== "unmount") h.unmount();
}
{
  const h = await loaded();
  h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
  assert.match(text(h.render()), /SYNTHETIC PRIVATE/);
  h.changeToken(null);
  assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE/, "logout clears already displayed content immediately");
  h.unmount();
}
{
  const h = await loaded();
  h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
  nodes(h.render()).find((node) => node.type === "select").props.onChange({ target: { value: "reviewing:investigating" } });
  const delayed = deferred(); h.pending.push(delayed.promise); button(h, "対応状況を保存").props.onClick();
  h.changeToken(null); delayed.resolve(response({ saved: true, review: { ...review, revision: 1 } })); await settle();
  assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE|対応状況を保存しました/, "late save cannot revive signed-out content or success");
  h.unmount();
}
for (const status of [401, 403, 404]) {
  const h = await loaded();
  h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
  nodes(h.render()).find((node) => node.type === "select").props.onChange({ target: { value: "reviewing:investigating" } });
  let readErrorBody = false;
  h.pending.push(Promise.resolve({ ok: false, status, json: async () => { readErrorBody = true; throw Error("invalid error body"); } }));
  button(h, "対応状況を保存").props.onClick(); await settle();
  assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE|選んだ通報|対応状況を保存しました/, `${status} must immediately remove disclosed content`);
  assert.match(text(h.render()), /通報内容を非表示/);
  assert.equal(readErrorBody, false, "known access loss cannot depend on error-body parsing/completion");
  assert.equal(button(h, "一覧を読み直す").props.disabled, false, "access rejection must leave recovery enabled");
  assert.equal(button(h, "この1件を確認"), undefined, "stale list entries are discarded too");
  if (status === 404) {
    h.pending.push(Promise.resolve(response({ reports: [], offset: 0, hasMore: false })));
    button(h, "一覧を読み直す").props.onClick(); await settle();
    assert.match(text(h.render()), /このページに通報はありません/);
    assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE/);
  } else {
    h.pending.push(Promise.resolve(response(page))); h.changeToken(`reauthenticated-${status}`); await settle();
    assert.doesNotMatch(text(h.render()), /SYNTHETIC PRIVATE/, "reauthentication loads the minimal list only");
    h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
    assert.equal(h.requests.at(-1).init.headers.Authorization, `Bearer reauthenticated-${status}`);
    assert.match(text(h.render()), /SYNTHETIC PRIVATE QUESTION/, "explicit fresh view is possible after reauthentication");
    nodes(h.render()).find((node) => node.type === "select").props.onChange({ target: { value: "reviewing:investigating" } });
    h.pending.push(Promise.resolve(response({ saved: true, review: { ...review, revision: 1, status: "reviewing", outcome: "investigating" } })));
    button(h, "対応状況を保存").props.onClick(); await settle();
    assert.match(text(h.render()), /対応状況を保存しました/);
  }
  h.unmount();
}
{
  const h = await loaded();
  h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
  nodes(h.render()).find((node) => node.type === "select").props.onChange({ target: { value: "reviewing:investigating" } });
  h.pending.push(Promise.resolve(response({ message: "synthetic revision conflict" }, false, 409)));
  button(h, "対応状況を保存").props.onClick(); await settle();
  assert.match(text(h.render()), /synthetic revision conflict/);
  assert.match(text(h.render()), /SYNTHETIC PRIVATE QUESTION/, "a revision conflict is not a loss of access");
  assert.doesNotMatch(text(h.render()), /対応状況を保存しました/);
  const latestReview = { ...review, revision: 2, status: "action_required", outcome: "unsafe_content" };
  h.pending.push(Promise.resolve(response({ ...detail, review: latestReview, reviews: [latestReview] })));
  button(h, "この1件を確認").props.onClick(); await settle();
  nodes(h.render()).find((node) => node.type === "select").props.onChange({ target: { value: "reviewing:investigating" } });
  h.pending.push(Promise.resolve(response({ saved: true, review: { ...review, revision: 3, status: "reviewing", outcome: "investigating" } })));
  button(h, "対応状況を保存").props.onClick(); await settle();
  assert.equal(JSON.parse(h.requests.at(-1).init.body).expectedRevision, 2, "reopening a conflict uses the fresh revision");
  assert.match(text(h.render()), /対応状況を保存しました/);
  h.unmount();
}
{
  const h = await loaded();
  h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
  nodes(h.render()).find((node) => node.type === "select").props.onChange({ target: { value: "reviewing:investigating" } });
  const oldSave = deferred(); h.pending.push(oldSave.promise); button(h, "対応状況を保存").props.onClick();
  h.pending.push(Promise.resolve(response(page))); h.changeToken("new-verified-session"); await settle();
  h.pending.push(Promise.resolve(response(detail))); button(h, "この1件を確認").props.onClick(); await settle();
  oldSave.resolve(response({}, false, 401)); await settle();
  assert.match(text(h.render()), /SYNTHETIC PRIVATE QUESTION/, "a late denial for the old session cannot clear newly authorized content");
  assert.doesNotMatch(text(h.render()), /権限を確認できない/);
  h.unmount();
}
console.log("PASS AI report operator UI: explicit one-item view, acknowledged save/retry, immediate 401/403/404 content removal, conflict/reauthentication recovery, logout/storage/hide/unmount response isolation (synthetic only)");
