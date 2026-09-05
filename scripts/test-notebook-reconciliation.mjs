import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, crypto: webcrypto, TextEncoder, URLSearchParams, Date,
    require(name) { if (name in imports) return imports[name]; throw Error(`Unexpected import: ${name}`); }, ...globals });
  return module.exports;
}
const helper = load("apps/web/lib/notebookReconciliation.ts");
const client = load("apps/web/lib/notebookReconciliationClient.ts", { "./notebookReconciliation": helper });
const clone = (value) => JSON.parse(JSON.stringify(value));
const localCase = { id: "source", status: "result_ready", selectedStatus: "preparing", answers: {}, createdAt: "2026-09-01T00:00:00.000Z", personProfile: { displayName: "テストの母" }, result: { summary: "端末のみ", tasks: [{ id: "task-one", title: "残す確認" }] } };
const remoteCase = { ...localCase, id: "target", cloudPersonId: "00000000-0000-4000-8000-000000000001", cloudRevision: 1, cloudHash: "a".repeat(64), personProfile: { displayName: "クラウドの母" }, result: { summary: "クラウドの基本情報", tasks: [] } };
const entry = { id: "original-diary", caseId: "source", date: "2026-09-01", mood: "stable", body: "  端末の記録\n改行も残す  ", attachments: [], createdAt: "2026-09-01T00:00:00.000Z" };
const cloudEntry = { ...entry, id: "old-cloud-diary", caseId: "target", body: "元からある記録" };
const local = { cases: [localCase], diaryEntries: [entry] };
const remote = { cases: [remoteCase], diaryEntries: [cloudEntry] };
const input = { local, remote, userId: "user-a", familyId: "family-a", memberRole: "owner", binding: null };
let checks = 0;
const planned = await helper.planNotebookReconciliation(input);
assert.equal(planned.addedCount, 1); assert.equal(planned.copies[0].body, entry.body);
assert.equal(planned.copies[0].caseId, "target"); assert.equal(planned.copies[0].cloudRevision, undefined);
assert.equal(planned.copies[0].id, await helper.reconciledDiaryId("source", "original-diary"));
assert.notEqual(planned.copies[0].id, await helper.reconciledDiaryId("different-source", "original-diary"));
assert.equal(planned.copies[0].updatedAt, entry.createdAt); checks += 7;
const saved = { cases: remote.cases, diaryEntries: [...remote.diaryEntries, ...planned.copies] };
const retried = await helper.planNotebookReconciliation({ ...input, remote: saved });
assert.equal(retried.addedCount, 0); assert.equal(retried.alreadyPresentCount, 1); checks += 2;
for (const patch of [
  { memberRole: "viewer" }, { userId: "" }, { familyId: "" },
  { binding: { authUserId: "other", familyId: "family-a" } },
  { binding: { authUserId: "user-a", familyId: "other" } },
  { local: { ...local, cases: [localCase, localCase] } },
  { local: { ...local, cases: [{ ...localCase, cloudRevision: 0 }] } },
  { local: { ...local, cases: [{ ...localCase, cloudPersonId: "other" }] } },
  { local: { ...local, diaryEntries: [] } },
  { local: { ...local, diaryEntries: [entry, entry] } },
  { local: { ...local, diaryEntries: [{ ...entry, attachments: [{ id: "photo" }] }] } },
  { local: { ...local, diaryEntries: [{ ...entry, cloudRevision: 1 }] } },
  { local: { ...local, diaryEntries: [{ ...entry, caseId: "other" }] } },
  { local: { ...local, diaryEntries: [{ ...entry, date: "2026-02-30" }] } },
  { local: { ...local, diaryEntries: [{ ...entry, date: "2026-13-01" }] } },
  { remote: { ...saved, diaryEntries: [...remote.diaryEntries, { ...planned.copies[0], body: "別端末で訂正" }] } }
]) { await assert.rejects(helper.planNotebookReconciliation({ ...input, ...patch })); checks++; }
assert.equal(helper.notebookReconciliationFingerprint({ ...local, exportedAt: "one" }), helper.notebookReconciliationFingerprint({ ...local, exportedAt: "two" })); checks++;

function storage() {
  const values = new Map();
  let fail = () => false;
  let failRemove = () => false;
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { if (fail(key, value)) throw Error("quota"); values.set(key, String(value)); },
    removeItem(key) { if (failRemove(key)) throw Error("storage unavailable"); values.delete(key); },
    failWhen(fn) { fail = fn; },
    failRemoveWhen(fn) { failRemove = fn; }
  };
}
function store(storage) {
  return load("apps/web/lib/store.ts", {
    "@/lib/funnel": { trackFunnel() {} }, "@/lib/date": { japanDateInputValue: () => "2026-09-05" },
    "@/lib/caseOwnership": { ANONYMOUS_CASE_TOKEN_PATTERN: /^anon_[a-f0-9]{64}$/ },
    "@oyano/shared": { buildDiagnosisResult: () => ({ tasks: [] }), canCreateNotebook: () => true }
  }, { window: { localStorage: storage } });
}
const destination = { version: 1, authUserId: "user-a", familyId: "family-a" };
for (const deletedCase of ["source", "target", "unrelated"]) {
  for (const cleanupFails of [false, true]) {
    const s = storage(); let st = store(s);
    st.overwriteLocalNotebook(clone(local));
    const original = st.exportNotebookData();
    assert.equal(st.archiveNotebookForReconciliation(original, destination), true);
    assert.equal(st.installReconciledNotebook({ source: original, destination, notebook: clone(saved) }), true);
    const deletion = { familyId: "family-a", personId: "test-person", localCaseId: deletedCase,
      cloudRevision: 1, cloudHash: "a".repeat(64) };
    assert.equal(st.preparePersonNotebookLocalDeletion(deletion), true);
    s.failRemoveWhen((key) => cleanupFails && key.includes("reconciliation_archive"));
    assert.equal(st.completePersonNotebookLocalDeletion(deletion).deleted, true);
    st = store(s);
    assert.equal(Boolean(st.readNotebookReconciliationArchive()), deletedCase === "unrelated");
    s.failRemoveWhen(() => false);
    assert.equal(st.retryCompletedPersonNotebookLocalDeletions(), true);
    assert.equal(Boolean(s.getItem("oyano_notebook_reconciliation_archive_v01")), deletedCase === "unrelated");
    checks += 7;
  }
}
{
  const s = storage(); const st = store(s);
  st.overwriteLocalNotebook(clone(local));
  assert.equal(st.archiveNotebookForReconciliation(st.exportNotebookData(), destination), true);
  st.resetLocalNotebookData();
  assert.equal(st.readNotebookReconciliationArchive(), null);
  checks += 2;
}
for (const failStep of ["none", "installing", "cases", "diary", "binding", "complete"]) {
  const s = storage(); let st = store(s);
  st.overwriteLocalNotebook(clone(local));
  const original = st.exportNotebookData();
  assert.equal(st.archiveNotebookForReconciliation(original, destination), true);
  s.failWhen((key, value) => failStep === "installing" ? key.includes("reconciliation_archive") && JSON.parse(value).status === "installing"
    : failStep === "complete" ? key.includes("reconciliation_archive") && JSON.parse(value).status === "complete"
      : failStep === "cases" ? key === "oyano_cases_v03"
        : failStep === "diary" ? key === "oyano_diary_entries_v01" // gitleaks:allow -- Public localStorage key, not a credential.
          : failStep === "binding" ? key === "oyano_notebook_cloud_binding_v01" : false);
  const ok = st.installReconciledNotebook({ source: original, destination, notebook: clone(saved) });
  assert.equal(ok, failStep === "none");
  st = store(s); // A new page load must not observe partially installed keys.
  const visible = st.exportNotebookData();
  assert.deepEqual(clone(visible.cases), failStep === "none" ? saved.cases : local.cases);
  assert.deepEqual(clone(visible.diaryEntries), clone(failStep === "none" ? saved.diaryEntries : local.diaryEntries));
  assert.equal(st.readNotebookCloudBinding()?.authUserId ?? null, failStep === "none" ? "user-a" : null);
  assert.deepEqual(clone(st.readNotebookReconciliationArchive().source.cases), local.cases);
  assert.deepEqual(clone(st.readNotebookReconciliationArchive().source.diaryEntries), local.diaryEntries);
  if (["cases", "diary", "binding", "complete"].includes(failStep)) {
    assert.equal(st.writeNotebookCloudBinding(destination), false, "pending install must not enable normal sync");
    s.failWhen(() => true); // Reads must work even when ALL storage writes fail.
    st = store(s);
    assert.deepEqual(clone(st.exportNotebookData().cases), local.cases);
    assert.deepEqual(clone(st.exportNotebookData().diaryEntries), local.diaryEntries);
    assert.equal(st.readNotebookCloudBinding(), null);
    checks += 3;
  }
  s.failWhen(() => false);
  if (failStep !== "none") {
    assert.equal(st.archiveNotebookForReconciliation(original, destination), true);
    assert.equal(st.installReconciledNotebook({ source: original, destination, notebook: clone(saved) }), true);
  }
  checks += 9;
}
for (const deletedCase of ["source", "target"]) {
  for (const cleanupFailure of ["none", "cases", "diary", "binding", "archive"]) {
    const s = storage(); let st = store(s);
    st.overwriteLocalNotebook(clone(local));
    const original = st.exportNotebookData();
    assert.equal(st.archiveNotebookForReconciliation(original, destination), true);
    // Three destination keys written, but not the commit marker.
    s.failWhen((key, value) => key.includes("reconciliation_archive") && JSON.parse(value).status === "complete");
    assert.equal(st.installReconciledNotebook({ source: original, destination, notebook: clone(saved) }), false);
    s.failWhen((key) => cleanupFailure === "cases" ? key === "oyano_cases_v03"
      : cleanupFailure === "diary" ? key === "oyano_diary_entries_v01" : false); // gitleaks:allow -- Public localStorage key, not a credential.
    s.failRemoveWhen((key) => cleanupFailure === "binding" ? key === "oyano_notebook_cloud_binding_v01"
      : cleanupFailure === "archive" ? key.includes("reconciliation_archive") : false);
    const deletion = { familyId: "family-a", personId: "test-person", localCaseId: deletedCase,
      cloudRevision: 1, cloudHash: "a".repeat(64) };
    assert.equal(st.preparePersonNotebookLocalDeletion(deletion), true);
    assert.equal(st.completePersonNotebookLocalDeletion(deletion).persisted, cleanupFailure === "none");
    st = store(s);
    assert.equal(st.readNotebookCloudBinding(), null, "partial destination binding must never become authoritative");
    assert.equal(st.readNotebookReconciliationArchive(), null, "deleted archive cannot be downloaded");
    if (cleanupFailure !== "none") {
      st.overwriteLocalNotebook({ cases: [{ ...localCase, id: "unexpected" }], diaryEntries: [] });
      assert.equal(st.exportNotebookData().cases.some((item) => item.id === "unexpected"), false, "raw journal still blocks writes when hidden by a tombstone");
      checks++;
    }
    s.failWhen(() => false); s.failRemoveWhen(() => false);
    assert.equal(st.retryCompletedPersonNotebookLocalDeletions(), true);
    st = store(s);
    assert.deepEqual(clone(st.exportNotebookData().cases), deletedCase === "source" ? [] : local.cases);
    assert.deepEqual(clone(st.exportNotebookData().diaryEntries), deletedCase === "source" ? [] : local.diaryEntries);
    assert.equal(st.readNotebookCloudBinding(), null);
    assert.equal(s.getItem("oyano_notebook_reconciliation_archive_v01"), null);
    checks += 11;
  }
}
{
  const s = storage(); const st = store(s); st.overwriteLocalNotebook(clone(local));
  const before = st.exportNotebookData();
  assert.equal(st.archiveNotebookForReconciliation(before, destination), true);
  st.overwriteLocalNotebook({ ...clone(local), diaryEntries: [{ ...entry, body: "待っている間に追記" }] });
  assert.equal(st.installReconciledNotebook({ source: before, destination, notebook: saved }), false);
  assert.equal(st.listDiaryEntries("source")[0].body, "待っている間に追記");
  assert.equal(st.archiveNotebookForReconciliation(st.exportNotebookData(), { ...destination, authUserId: "other" }), false);
  checks += 4;
}
const page = { ...remote, familyId: "family-a", memberRole: "owner", diaryEntriesOffset: 0, diaryEntriesTotal: 1, diaryEntriesHasMore: false };
const read = (result, options = {}) => client.readReconciliationCloudNotebook({ token: "mock", familyId: "family-a", assertCurrent() {}, request: async () => ({ ok: true, json: async () => result }), ...options });
assert.equal((await read(page)).diaryEntries.length, 1); checks++;
for (const result of [
  { ...page, familyId: "other" }, { ...page, memberRole: "viewer" }, { ...page, diaryEntriesTotal: 2 },
  { ...page, diaryEntriesOffset: 500 }, { ...page, diaryEntriesHasMore: true },
  { ...page, diaryEntries: [cloudEntry, cloudEntry], diaryEntriesTotal: 2 }
]) { await assert.rejects(read(result)); checks++; }
await assert.rejects(read(page, { assertCurrent() { throw Error("auth changed"); } })); checks++;
let requests = 0;
const many = Array.from({ length: 500 }, (_, i) => ({ ...cloudEntry, id: `cloud-${i}` }));
const paginated = await read(null, { request: async (url) => {
  requests++;
  assert.match(url, requests === 1 ? /diaryOffset=0/ : /diaryOffset=500/);
  return { ok: true, json: async () => ({ ...page, diaryEntriesTotal: 501, diaryEntriesOffset: requests === 1 ? 0 : 500,
    diaryEntriesHasMore: requests === 1, diaryEntries: requests === 1 ? many : [{ ...cloudEntry, id: "last" }] }) };
} });
assert.equal(paginated.diaryEntries.length, 501); checks++;
const component = source("apps/web/components/NotebookReconciliation.tsx");
assert.ok(component.indexOf("archiveNotebookForReconciliation(local, destination)") < component.indexOf('fetch("/api/notebook/reconcile"'));
assert.match(component, /choice !== "same" \|\| !acknowledged/);
assert.match(component, /verified\.alreadyPresentCount !== local\.diaryEntries\.length/);
assert.match(component, /installReconciledNotebook/);
assert.doesNotMatch(component, /resetLocalNotebookData|syncNotebookToCloud|writeNotebookCloudBinding/);
assert.match(component, /!mounted\.current \|\| operationGeneration !== generation\.current \|\| current\.current\.unavailable/);
assert.match(component, /const sendingSession = await verifySession\(\)/);
assert.match(component, /await verifySession\(\);\s*assertNoDeletion\(local\);/);
checks += 5;
console.log(`Notebook reconciliation regression: ok (${checks} checks; no external calls)`);
