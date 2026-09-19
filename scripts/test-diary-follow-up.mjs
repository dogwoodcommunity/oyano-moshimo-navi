import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual pure helpers and home handlers, with synthetic records and queued React
// state only. No browser, real storage, cloud/API calls or production records.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("apps/web/app/home/page.tsx");
const helper = read("apps/web/lib/diaryFollowUp.ts");
function evaluate(source, sandbox = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, { ...sandbox, module, exports: module.exports });
  return module.exports;
}
const { buildDiaryFollowUpBody, diaryFollowUpSourceVersion, hasUnsavedDiaryFollowUp,
  DIARY_FOLLOW_UP_OUTCOMES } = evaluate(helper);
const { findRelatedDiaryEntry } = evaluate(read("apps/web/lib/diaryContinuity.ts"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const fixture = (id, caseId = "case-a", patch = {}) => ({
  id, caseId, date: "2026-09-01", body: "服薬の確認について。合成の元本文。",
  mood: "changed", attachments: [{ id: "synthetic-attachment" }],
  createdAt: "2026-09-01T09:00:00.000Z", ...patch
});
const seed = (entry, patch = {}) => ({
  entryId: entry.id, sourceVersion: diaryFollowUpSourceVersion(entry),
  scopeKey: "local:local", date: "2026-09-19", subject: "", mood: null, outcome: null, note: "", ...patch
});
const complete = (entry, patch = {}) => seed(entry, {
  subject: "飲み薬についての確認", mood: "stable", outcome: "confirmed", ...patch
});
const source = fixture("opaque-source-id", "opaque-case-id");
assert.equal(hasUnsavedDiaryFollowUp(), false);
assert.equal(hasUnsavedDiaryFollowUp(seed(source)), false);
assert.equal(hasUnsavedDiaryFollowUp(seed(source, { date: "2026-09-18" })), false);
assert.equal(hasUnsavedDiaryFollowUp(seed(source, { note: " " })), true);
assert.equal(hasUnsavedDiaryFollowUp(seed(source, { subject: " " })), true);
assert.equal(hasUnsavedDiaryFollowUp(seed(source, { mood: "stable" })), true);
for (const outcome of DIARY_FOLLOW_UP_OUTCOMES) {
  const draft = complete(source, { subject: "  飲み薬についての確認  ", outcome: outcome.value, note: "  本人に確認したことだけ記入。  " });
  const before = clone({ source, draft });
  const body = buildDiaryFollowUpBody(source, draft);
  assert.equal(body, `【記録のその後】\n気がかり：飲み薬についての確認\n対象：2026年9月1日の記録\n確認状況：${outcome.label}\n自分の追記：本人に確認したことだけ記入。`);
  assert.doesNotMatch(body, /opaque-|合成の元本文|synthetic-attachment|AI|改善|解決|診断|安全|異常/,
    "generated body must not copy the original, IDs, attachments, or infer an outcome");
  assert.deepEqual(clone({ source, draft }), before, "body builder is pure");
  assert.equal(hasUnsavedDiaryFollowUp(draft), true);
}
assert.equal(buildDiaryFollowUpBody(source, complete(source, { outcome: "pending" })).split("\n").length, 4);
for (const patch of [{ outcome: null }, { outcome: "resolved" }, { date: "2026-02-30" },
  { date: "" }, { entryId: "different-id" }, { sourceVersion: "stale" }, { subject: "" },
  { subject: " \n " }, { subject: "あ".repeat(81) }, { mood: null }, { mood: "resolved" }]) {
  assert.throws(() => buildDiaryFollowUpBody(source, complete(source, patch)));
}
assert.ok(buildDiaryFollowUpBody(source, complete(source, { subject: "𠮷".repeat(80) })).includes("𠮷".repeat(80)),
  "subject limit counts Unicode characters, not UTF-16 units");
assert.throws(() => buildDiaryFollowUpBody(source, complete(source, { subject: "𠮷".repeat(81) })));
const invalidSource = { ...source, date: "2026-13-01" };
assert.throws(() => buildDiaryFollowUpBody(invalidSource, complete(invalidSource)));
assert.throws(() => buildDiaryFollowUpBody({ ...source, caseId: "other-case" }, complete(source)),
  "same ID in another notebook is a different source");
assert.doesNotMatch(helper, /localStorage|sessionStorage|fetch\(|sendBeacon|supabase|https?:\/\//);

// Execute the real controlled component with a minimal JSX runtime. Inspect its
// rendered props/callbacks; browser layout and native events remain separate QA.
const { DiaryFollowUpPanel } = evaluate(read("apps/web/components/DiaryFollowUpPanel.tsx"), {
  require(name) {
    if (name === "@/lib/diaryFollowUp") return {
      buildDiaryFollowUpBody, diaryFollowUpSourceVersion, DIARY_FOLLOW_UP_OUTCOMES
    };
    if (name === "react/jsx-runtime") return {
      jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props })
    };
    assert.fail(`unexpected component import: ${name}`);
  }
});
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object") return [];
  return [node, ...flatten(node.props?.children)];
}
{
  const changes = [];
  let saved = 0;
  let skipped = 0;
  let refreshed = 0;
  const draft = complete(source, { note: "合成の追記" });
  const render = (patch = {}) => flatten(DiaryFollowUpPanel({
    draft, source, disabled: false, onChange: (value) => changes.push(clone(value)),
    onSave: () => saved++, onSkip: () => skipped++, onRefreshSource: () => refreshed++, ...patch
  }));
  const element = (elements, id) => elements.find((node) => node.props.id === id);
  const button = (elements, label) => elements.find((node) => node.type === "button" && node.props.children === label);
  const ready = render();
  assert.equal(button(ready, "その後を記録する").props.disabled, false);
  for (const [id, field, value] of [
    ["diary-follow-up-subject", "subject", "杖の高さ"], ["diary-follow-up-date", "date", "2026-09-18"],
    ["diary-follow-up-note", "note", "本人からの合成メモ"]
  ]) {
    const control = element(ready, id);
    assert.equal(control.props.value, draft[field]);
    control.props.onChange({ target: { value } });
    assert.deepEqual(changes.at(-1), { [field]: value });
  }
  for (const outcome of DIARY_FOLLOW_UP_OUTCOMES) {
    const choice = button(ready, outcome.label);
    assert.equal(choice.props["aria-pressed"], outcome.value === draft.outcome);
    choice.props.onClick();
    assert.deepEqual(changes.at(-1), { outcome: outcome.value }, "outcome clicks do not choose a classification");
  }
  const classification = element(ready, "diary-follow-up-mood");
  assert.equal(classification.props.value, "stable");
  classification.props.onChange({ target: { value: "urgent" } });
  assert.deepEqual(changes.at(-1), { mood: "urgent" }, "classification does not change outcome");
  classification.props.onChange({ target: { value: "" } });
  assert.deepEqual(changes.at(-1), { mood: null });
  button(ready, "その後を記録する").props.onClick();
  button(ready, "今は答えない").props.onClick();
  assert.equal(saved, 1);
  assert.equal(skipped, 1);
  for (const patch of [{ draft: seed(source) }, { draft: { ...draft, subject: "" } },
    { draft: { ...draft, mood: null } }, { draft: { ...draft, outcome: null } },
    { disabled: true }, { source: undefined }]) {
    assert.equal(button(render(patch), "その後を記録する").props.disabled, true);
  }
  const blank = render({ draft: seed(source) });
  assert.equal(element(blank, "diary-follow-up-subject").props.value, "");
  assert.equal(element(blank, "diary-follow-up-mood").props.value, "");
  const stale = render({ source: { ...source, body: "元の記録の合成更新" } });
  assert.equal(stale.find((node) => node.type === "details").props.open, true);
  assert.equal(button(stale, "その後を記録する").props.disabled, true);
  button(stale, "最新の記録を確認した").props.onClick();
  assert.equal(refreshed, 1);
  assert.equal(render({ disabled: true }).find((node) => node.type === "fieldset").props.disabled, true);
  assert.equal(render({ source: undefined }).find((node) => node.type === "fieldset").props.disabled, true);
}

const ast = ts.createSourceFile("home.tsx", home, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
visit(ast);
function actualFunction(name) {
  const found = nodes.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(found.length, 1, `extract actual ${name}`);
  return found[0].getText(ast);
}
function actualInitializer(name) {
  const found = nodes.filter((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === name);
  assert.equal(found.length, 1, `extract actual ${name}`);
  return found[0].initializer.getText(ast);
}
const handlerNames = ["canUseDiaryContinuity", "currentContinuityEntries", "openRelatedDiary",
  "openDiaryFollowUp", "updateDiaryFollowUp", "refreshDiaryFollowUpSource", "skipDiaryFollowUp", "saveDiaryFollowUp"];
const handlerSource = handlerNames.map(actualFunction).join("\n");
assert.doesNotMatch(handlerSource, /fetch\(|sendBeacon|localStorage|sessionStorage|updateDiaryEntry\(|removeDiaryEntry\(/,
  "follow-up handlers use the existing add path and never edit or remove the source");

function harness(initial = {}) {
  const sourceA = fixture("source-a");
  const sourceB = fixture("source-b", "case-a", { body: "散歩の記録", date: "2026-09-02" });
  const state = {
    activeCase: { id: "case-a" }, cloudUserId: null, cloudFamilyId: null,
    cloudIdentityStatus: "checking", cloudMemberRole: null, reconciliationBusy: false,
    binding: null, blockedCases: new Set(), blockedEntries: new Set(),
    diaryEntries: { "case-a": [clone(sourceA), clone(sourceB)] },
    storedEntries: { "case-a": [clone(sourceA), clone(sourceB)] }, followUpDrafts: {},
    forms: { "case-a": { date: "2026-09-18", body: "通常フォームの未保存入力", mood: "urgent", files: [{ id: "normal-photo" }] } },
    diaryEditForms: { "source-b": { body: "通常編集の未保存入力" } },
    diarySavedId: null, diaryUpdatedId: null, followUpError: undefined,
    persistenceSucceeds: true, warning: null, confirmAnswer: true,
    persistenceCalls: [], listingCalls: [], shown: [], confirmations: [], activities: [],
    buildDiaryFollowUpBody, diaryFollowUpSourceVersion, hasUnsavedDiaryFollowUp, findRelatedDiaryEntry,
    todayInputValue: () => "2026-09-19", monthInputValue: (value) => value.slice(0, 7),
    ...initial
  };
  state.readNotebookCloudBinding = () => state.binding;
  state.isPersonNotebookCloudSyncBlocked = (id) => state.blockedCases.has(id);
  state.isDiaryEntryCloudSyncBlocked = (caseId, id) => state.blockedEntries.has(`${caseId}:${id}`);
  state.listDiaryEntries = (caseId) => {
    state.listingCalls.push(caseId);
    return clone(state.storedEntries[caseId] ?? []);
  };
  state.addDiaryEntryWithStatus = (input) => {
    state.persistenceCalls.push(clone(input));
    const entry = { ...input, id: `new-${state.persistenceCalls.length}`, createdAt: "2026-09-19T09:00:00.000Z" };
    if (state.persistenceSucceeds) state.storedEntries[input.caseId] = [clone(entry), ...(state.storedEntries[input.caseId] ?? [])];
    return { entry, persisted: state.persistenceSucceeds };
  };
  state.consumeNotebookStorageWarning = () => state.warning;
  state.markMonitorActivity = (event) => state.activities.push(event);
  state.showDiaryEntry = (entry) => state.shown.push(clone(entry));
  state.scrollToDiaryEntry = () => {};
  state.window = {
    setTimeout() {},
    confirm(message) { state.confirmations.push(message); return state.confirmAnswer; }
  };
  state.document = { getElementById: () => null };
  const pending = [];
  for (const field of ["diaryEntries", "followUpDrafts", "followUpError", "activeNotebookTab",
    "diarySavedId", "diaryUpdatedId", "diaryCalendarMonth", "selectedDiaryDate", "recordFilter",
    "recordStorageTone", "recordStorageMessage"]) {
    state[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value) => pending.push(() => {
      state[field] = typeof value === "function" ? value(state[field]) : value;
    });
  }
  const runtime = vm.createContext(state);
  vm.runInContext(ts.transpileModule(handlerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, runtime);
  const run = (expression) => {
    state.continuityScopeKey = vm.runInContext(actualInitializer("continuityScopeKey"), runtime);
    const result = vm.runInContext(expression, runtime);
    while (pending.length) pending.shift()();
    return result;
  };
  const open = (index = 0) => run(`openDiaryFollowUp(diaryEntries[activeCase.id][${index}])`);
  const choose = () => run("updateDiaryFollowUp({ subject: '飲み薬についての確認', mood: 'stable', outcome: 'confirmed', note: '合成の追記' })");
  return { state, run, open, choose };
}

// The source comes from the current store, and saving adds one independent entry.
{
  const { state, run, open, choose } = harness();
  state.storedEntries["case-a"][0].body = "最新の合成本文。服薬について。";
  const originals = clone(state.storedEntries["case-a"]);
  const normalInputs = clone({ forms: state.forms, edits: state.diaryEditForms });
  assert.equal(run("canUseDiaryContinuity('case-a')"), true, "unbound local notebooks remain usable");
  open();
  assert.equal(state.followUpDrafts["case-a"].sourceVersion, diaryFollowUpSourceVersion(originals[0]));
  assert.equal(state.diaryEntries["case-a"][0].body, originals[0].body);
  assert.equal(state.followUpDrafts["case-a"].subject, "", "concern label is user-authored, never prefilled from source");
  assert.equal(state.followUpDrafts["case-a"].mood, null, "classification starts unselected");
  assert.equal(hasUnsavedDiaryFollowUp(state.followUpDrafts["case-a"]), false);
  choose();
  run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 1);
  assert.equal(state.persistenceCalls[0].mood, "stable", "save respects the explicitly selected classification");
  assert.deepEqual(state.persistenceCalls[0].attachments, []);
  assert.deepEqual(state.storedEntries["case-a"].slice(1), originals, "both original records remain intact");
  assert.deepEqual(clone({ forms: state.forms, edits: state.diaryEditForms }), normalInputs);
  assert.equal(state.followUpDrafts["case-a"], undefined);
  assert.equal(state.diarySavedId, "new-1");
  assert.equal(state.diaryUpdatedId, null);
  assert.equal(state.selectedDiaryDate, "2026-09-19");
  assert.deepEqual(state.activities, ["dailyRecordSaved"]);
  assert.equal(state.listingCalls.length, 2, "both open and save query current entries");
}

// Failed local persistence keeps the draft, and creates no success state.
{
  const { state, run, open, choose } = harness({ persistenceSucceeds: false, warning: "合成の保存失敗", diarySavedId: "prior-success" });
  open(); choose();
  const draft = clone(state.followUpDrafts["case-a"]);
  const originals = clone(state.storedEntries);
  run("saveDiaryFollowUp()");
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draft);
  assert.deepEqual(state.storedEntries, originals);
  assert.equal(state.diarySavedId, null);
  assert.equal(state.followUpError, "合成の保存失敗");
  assert.deepEqual(state.activities, []);
}

// Outcome and diary classification are independent choices, including confirmed
// + urgent and pending + changed; no favorable/clinical result is inferred.
for (const outcome of ["confirmed", "pending", "changed"]) {
  for (const mood of ["stable", "changed", "urgent"]) {
    const { state, run, open, choose } = harness();
    open(); choose();
    run(`updateDiaryFollowUp({ outcome: '${outcome}', mood: '${mood}' })`);
    run("saveDiaryFollowUp()");
    assert.equal(state.persistenceCalls.length, 1);
    assert.equal(state.persistenceCalls[0].mood, mood);
    assert.ok(state.persistenceCalls[0].body.includes(`確認状況：${DIARY_FOLLOW_UP_OUTCOMES.find((item) => item.value === outcome).label}`));
  }
}
for (const patch of ["{ subject: '' }", "{ mood: null }", "{ outcome: null }"]) {
  const { state, run, open, choose } = harness();
  open(); choose(); run(`updateDiaryFollowUp(${patch})`);
  run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 0, "required fields are also enforced in the actual save handler");
  assert.ok(state.followUpDrafts["case-a"]);
  assert.ok(state.followUpError);
}

// An unseen source edit must first render; only the next explicit confirmation
// can acknowledge that exact displayed version. Another edit invalidates it.
{
  const { state, run, open, choose } = harness();
  open(); choose();
  const oldVersion = state.followUpDrafts["case-a"].sourceVersion;
  state.storedEntries["case-a"][0].body = "合成の変更一";
  run("refreshDiaryFollowUpSource()");
  assert.equal(state.followUpDrafts["case-a"].sourceVersion, oldVersion);
  assert.match(state.followUpError, /もう一度/);
  assert.equal(state.diaryEntries["case-a"][0].body, "合成の変更一");
  run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 0, "refresh cannot silently accept unseen text");
  run("refreshDiaryFollowUpSource()");
  assert.equal(state.followUpDrafts["case-a"].sourceVersion, diaryFollowUpSourceVersion(state.storedEntries["case-a"][0]));
  assert.equal(state.followUpDrafts["case-a"].note, "合成の追記");
  state.storedEntries["case-a"][0].body = "合成の変更二";
  run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 0, "a post-confirmation edit blocks saving again");
  run("refreshDiaryFollowUpSource()");
  run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 1);
}

for (const mode of ["deleted", "tombstoned"]) {
  const { state, run, open, choose } = harness();
  open(); choose();
  if (mode === "deleted") state.storedEntries["case-a"] = [];
  else state.blockedEntries.add("case-a:source-a");
  run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 0, `${mode} source cannot be followed up`);
  assert.match(state.followUpError, /見つかりません/);
  assert.equal(state.followUpDrafts["case-a"].note, "合成の追記");
  assert.equal(state.diaryEntries["case-a"].some((entry) => entry.id === "source-a"), false);
}
{
  const { state, open } = harness({ storedEntries: {} });
  open();
  assert.deepEqual(state.followUpDrafts, {}, "opening a source that no longer exists creates no draft");
}

// All new entry points re-check notebook identity, current role and reconciliation.
const bound = { binding: { authUserId: "user-a", familyId: "family-a" }, cloudUserId: "user-a",
  cloudFamilyId: "family-a", cloudIdentityStatus: "ready", cloudMemberRole: "owner" };
for (const [label, patch] of [
  ["bound signed out", { cloudUserId: null }], ["account mismatch", { cloudUserId: "user-b" }],
  ["family mismatch", { cloudFamilyId: "family-b" }], ["viewer", { cloudMemberRole: "viewer" }],
  ["checking identity", { cloudIdentityStatus: "checking" }], ["missing role", { cloudMemberRole: null }],
  ["reconciliation", { reconciliationBusy: true }], ["missing binding", { binding: null }],
  ["removed notebook", { blockedCases: new Set(["case-a"]) }]
]) {
  const { state, run, open, choose } = harness(bound);
  open(); choose();
  const draft = clone(state.followUpDrafts["case-a"]);
  Object.assign(state, patch);
  const reads = state.listingCalls.length;
  assert.equal(run("canUseDiaryContinuity('case-a')"), false, label);
  run("openRelatedDiary('source-a')");
  run("openDiaryFollowUp(diaryEntries['case-a'][1])");
  run("updateDiaryFollowUp({ note: '権限喪失後の変更' })");
  run("refreshDiaryFollowUpSource()");
  run("saveDiaryFollowUp()");
  assert.equal(state.listingCalls.length, reads, `${label}: no new source read`);
  assert.equal(state.persistenceCalls.length, 0, `${label}: no persistence`);
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draft, `${label}: draft retained`);
  assert.deepEqual(state.shown, []);
}
for (const role of ["owner", "editor"]) {
  const { state, run, open, choose } = harness({ ...bound, cloudMemberRole: role });
  open(); choose(); run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 1, `${role} in the matching family may save`);
}

// Reopening the same source preserves input. Choosing another source or skipping
// an entered draft requires an explicit confirm; normal diary inputs are untouched.
{
  const { state, run, open, choose } = harness();
  open(); choose();
  run("updateDiaryFollowUp({ date: '2026-09-17' })");
  const draft = clone(state.followUpDrafts["case-a"]);
  const normal = clone(state.forms);
  open();
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draft);
  assert.equal(state.confirmations.length, 0);
  state.confirmAnswer = false;
  open(1);
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draft);
  run("skipDiaryFollowUp()");
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draft);
  state.confirmAnswer = true;
  open(1);
  assert.equal(state.followUpDrafts["case-a"].entryId, "source-b");
  assert.equal(state.followUpDrafts["case-a"].outcome, null);
  assert.equal(state.followUpDrafts["case-a"].note, "");
  choose(); run("skipDiaryFollowUp()");
  assert.equal(state.followUpDrafts["case-a"], undefined);
  assert.deepEqual(clone(state.forms), normal);
  assert.equal(state.persistenceCalls.length, 0);
}

// Identical record IDs in distinct notebooks cannot cross-contaminate drafts.
{
  const { state, run, open, choose } = harness();
  open(); choose();
  const draftA = clone(state.followUpDrafts["case-a"]);
  const sourceB = fixture("source-a", "case-b", { body: "別の手帳の合成本文" });
  state.storedEntries["case-b"] = [clone(sourceB)];
  state.diaryEntries["case-b"] = [clone(sourceB)];
  state.activeCase = { id: "case-b" };
  run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls.length, 0, "switching cases does not save the old case draft");
  run("openDiaryFollowUp(diaryEntries['case-a'][0])");
  assert.equal(state.followUpDrafts["case-b"], undefined, "stale cross-case click is ignored");
  open(); choose(); run("saveDiaryFollowUp()");
  assert.equal(state.persistenceCalls[0].caseId, "case-b");
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draftA);
  state.activeCase = { id: "case-a" };
  open();
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draftA);
}

// Even when a new matching binding is ready, old account/family drafts stay inert.
{
  const { state, run, open, choose } = harness(bound);
  open(); choose();
  const draft = clone(state.followUpDrafts["case-a"]);
  Object.assign(state, { binding: { authUserId: "user-b", familyId: "family-b" }, cloudUserId: "user-b", cloudFamilyId: "family-b" });
  assert.equal(run("canUseDiaryContinuity('case-a')"), true);
  run("updateDiaryFollowUp({ note: '別の範囲からの変更' })");
  run("refreshDiaryFollowUpSource()");
  run("saveDiaryFollowUp()");
  assert.deepEqual(clone(state.followUpDrafts["case-a"]), draft);
  assert.equal(state.persistenceCalls.length, 0);
  open();
  assert.equal(state.followUpDrafts["case-a"].scopeKey, "user-b:family-b");
  assert.equal(state.followUpDrafts["case-a"].note, "");
}

// The related link must re-resolve candidates at click time, including changed
// bodies, deletions and tombstones; the rendered snapshot is never the authority.
{
  const saved = fixture("saved", "case-a", { date: "2026-09-19", body: "服薬を確認した", createdAt: "2026-09-19T09:00:00.000Z" });
  const stale = fixture("old-match");
  const latest = fixture("new-match", "case-a", { body: "服薬の新しい合成記録", date: "2026-09-03" });
  const { state, run } = harness({
    diaryEntries: { "case-a": [saved, stale] },
    storedEntries: { "case-a": [saved, { ...stale, body: "散歩の話に変更" }, latest] }
  });
  run("openRelatedDiary('saved')");
  assert.equal(state.shown[0].id, "new-match");
  state.blockedEntries.add("case-a:new-match");
  run("openRelatedDiary('saved')");
  assert.equal(state.shown.length, 1, "tombstoned related candidate is not opened");
  assert.match(state.recordStorageMessage, /取り消しました/);
  state.storedEntries["case-a"] = [latest];
  run("openRelatedDiary('saved')");
  assert.equal(state.shown.length, 1, "deleted saved source cannot open a historical candidate");
}

console.log("diary follow-up: ok (actual helpers/panel/handlers; required subject/classification, fresh sources, separate add, failure retention, stale confirmation, permissions and draft isolation; synthetic only)");
