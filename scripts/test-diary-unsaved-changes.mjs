import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual helper, home handlers and effect; synthetic state/events only.
// No React rendering, browser prompts, local storage, network or real records.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("apps/web/app/home/page.tsx");
const helper = read("apps/web/lib/diaryUnsavedChanges.ts");
function evaluate(source, sandbox = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { ...sandbox, module, exports: module.exports });
  return module.exports;
}
const { hasUnsavedNewDiaryInput, hasUnsavedDiaryEdit, UNSAVED_DIARY_WARNING } = evaluate(helper);
const blank = () => ({ date: "2026-09-06", body: "", mood: "stable", files: [] });
const original = { date: "2026-09-01", body: "仮の記録\n二行目", mood: "stable" };
assert.equal(hasUnsavedNewDiaryInput(), false);
assert.equal(hasUnsavedNewDiaryInput(blank()), false);
assert.equal(hasUnsavedNewDiaryInput({ ...blank(), date: "2026-09-01", mood: "urgent" }), false,
  "initial/date/mood-only new forms are not savable body/photo drafts");
assert.equal(hasUnsavedNewDiaryInput({ ...blank(), body: "仮の未保存本文" }), true);
assert.equal(hasUnsavedNewDiaryInput({ ...blank(), body: " \n" }), true, "do not silently trim away typed input");
assert.equal(hasUnsavedNewDiaryInput({ ...blank(), files: [{ id: "synthetic-photo" }] }), true);
assert.equal(hasUnsavedDiaryEdit(undefined, original), false);
assert.equal(hasUnsavedDiaryEdit(original, undefined), false);
assert.equal(hasUnsavedDiaryEdit({ ...original }, original), false);
for (const patch of [{ body: `${original.body}\n` }, { date: "2026-09-02" }, { mood: "urgent" }]) {
  assert.equal(hasUnsavedDiaryEdit({ ...original, ...patch }, original), true);
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
const dirtyDeclaration = nodes.filter((node) => ts.isVariableDeclaration(node)
  && node.name.getText(ast) === "hasUnsavedDiaryChanges");
assert.equal(dirtyDeclaration.length, 1);
const unloadEffects = nodes.filter((node) => ts.isCallExpression(node)
  && node.expression.getText(ast) === "useEffect"
  && node.arguments[0]?.getText(ast).includes('window.addEventListener("beforeunload"'));
assert.equal(unloadEffects.length, 1, "exactly one dirty-only unload effect must exist");
assert.equal(unloadEffects[0].arguments[1].getText(ast), "[hasUnsavedDiaryChanges]");
assert.match(unloadEffects[0].arguments[0].getText(ast), /if \(!hasUnsavedDiaryChanges\) return;/);
assert.match(unloadEffects[0].arguments[0].getText(ast), /return \(\) => window\.removeEventListener\("beforeunload", warnBeforeUnload\)/);
assert.doesNotMatch(helper + unloadEffects[0].getText(ast), /localStorage|sessionStorage|fetch\(|sendBeacon|supabase/,
  "warning/guard must neither persist drafts nor send data");
assert.equal(UNSAVED_DIARY_WARNING,
  "まだ保存されていません。保存する前に画面を閉じたり再読み込みすると、入力内容が消えることがあります。");
assert.match(home, /hasUnsavedNewDiaryInput\(activeForm\) \? \([\s\S]*?role="status"[\s\S]*?\{UNSAVED_DIARY_WARNING\}/);
assert.match(home, /hasUnsavedDiaryEdit\(editForm, diaryEditOriginals\[entry\.id\]\) \? \([\s\S]*?role="status"[\s\S]*?\{UNSAVED_DIARY_WARNING\}/);
assert.ok(home.includes("端末やブラウザによっては、閉じる時の確認が出ない場合があります。"));

// Exercise the real effect's registration, native event request and cleanup.
const runUnloadEffect = evaluate(`export const run = ${unloadEffects[0].arguments[0].getText(ast)};`, {
  hasUnsavedDiaryChanges: false,
  window: { addEventListener() { assert.fail("clean input must not register beforeunload"); } }
}).run;
assert.equal(runUnloadEffect(), undefined);
const listeners = new Set();
const effect = evaluate(`export const run = ${unloadEffects[0].arguments[0].getText(ast)};`, {
  hasUnsavedDiaryChanges: true,
  window: {
    addEventListener(type, handler) { assert.equal(type, "beforeunload"); listeners.add(handler); },
    removeEventListener(type, handler) { assert.equal(type, "beforeunload"); assert.ok(listeners.delete(handler)); }
  }
}).run;
for (let cycle = 0; cycle < 2; cycle += 1) {
  const cleanup = effect();
  assert.equal(listeners.size, 1, "mount/remount must have only one live handler");
  const event = { defaultPrevented: false, returnValue: undefined,
    preventDefault() { this.defaultPrevented = true; } };
  [...listeners][0](event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.returnValue, "");
  cleanup();
  assert.equal(listeners.size, 0, "saved/cancelled/unmounted state must remove the exact handler");
}

// The real dirty expression must inspect all live notebooks and their drafts.
const fixture = (id, caseId = "case-a") => ({ ...original, id, caseId, attachments: [] });
const state = {
  cases: [{ id: "case-a" }, { id: "case-b" }],
  diaryEntries: { "case-a": [fixture("entry-a")], "case-b": [fixture("entry-b", "case-b")] },
  forms: {}, diaryEditForms: {}, diaryEditOriginals: {},
  hasUnsavedNewDiaryInput, hasUnsavedDiaryEdit,
  cloudContentReadOnly: false,
  todayInputValue: () => "2026-09-06", emptyDiaryForm: blank(),
  formatLongDate: (value) => value,
  consumeNotebookStorageWarning: () => null,
  markMonitorActivity() {}, scrollToDiaryEntry() {},
  window: { requestAnimationFrame: (run) => run(), setTimeout() {} },
  document: { getElementById: () => null }
};
let saveSucceeds = true;
let saveCounter = 0;
state.addDiaryEntryWithStatus = (input) => ({ entry: { ...input, id: `saved-${++saveCounter}` }, persisted: saveSucceeds });
state.updateDiaryEntry = (entryId, patch) => {
  const entry = Object.values(state.diaryEntries).flat().find((value) => value.id === entryId);
  const updated = { ...entry, ...patch };
  if (saveSucceeds) state.diaryEntries[entry.caseId] = state.diaryEntries[entry.caseId]
    .map((value) => value.id === entryId ? updated : value);
  return { entry: updated, persisted: saveSucceeds };
};
state.listDiaryEntries = (caseId) => state.diaryEntries[caseId];
for (const field of ["forms", "diaryEditForms", "diaryEditOriginals", "diaryEntries", "editingDiaryId",
  "diarySavedId", "diaryUpdatedId", "diaryValidationCaseId", "recordStorageTone", "recordStorageMessage",
  "diaryCalendarMonth", "selectedDiaryDate", "recordFilter", "taskAddedEntryId"]) {
  state[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value) => {
    state[field] = typeof value === "function" ? value(state[field]) : value;
  };
}
state.monthInputValue = (value) => value?.slice(0, 7) ?? "2026-09";
const runtime = vm.createContext(state);
const handlers = ["blankDiaryForm", "diaryEditSeed", "updateForm", "openDiaryEditor", "closeDiaryEditor",
  "updateDiaryEditForm", "saveDiary", "saveDiaryEdit"];
vm.runInContext(ts.transpileModule([
  ...handlers.map(actualFunction),
  `function isDirty() { return ${dirtyDeclaration[0].initializer.getText(ast)}; }`
].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, runtime);
const run = (expression) => vm.runInContext(expression, runtime);
assert.equal(run("isDirty()"), false, "registration and initial state must be clean");
run("openDiaryEditor(diaryEntries['case-a'][0])");
assert.equal(run("isDirty()"), false, "opening a seeded editor alone is clean");
run("updateDiaryEditForm('entry-a', { body: diaryEditOriginals['entry-a'].body })");
assert.equal(run("isDirty()"), false, "same-value edit is clean");
run("updateDiaryEditForm('entry-a', { body: '仮の変更' })");
assert.equal(run("isDirty()"), true);
run("openDiaryEditor(diaryEntries['case-b'][0])");
assert.equal(run("isDirty()"), true, "opening a different notebook must not hide an unsaved edit");
run("closeDiaryEditor(diaryEntries['case-b'][0])");
assert.equal(run("isDirty()"), true, "cancelling one editor must not clear another draft");
saveSucceeds = false;
run("saveDiaryEdit('case-a', 'entry-a')");
assert.equal(run("isDirty()"), true, "failed edit save must retain the guard");
saveSucceeds = true;
run("saveDiaryEdit('case-a', 'entry-a')");
assert.equal(run("isDirty()"), false, "successful edit save updates the baseline");
run("openDiaryEditor(diaryEntries['case-a'][0]); updateDiaryEditForm('entry-a', { body: '取消する変更' }); closeDiaryEditor(diaryEntries['case-a'][0])");
assert.equal(run("isDirty()"), false, "explicit cancel discards the change");
state.diaryEntries["case-a"][0] = { ...state.diaryEntries["case-a"][0], body: "合成クラウド更新" };
assert.equal(run("isDirty()"), false, "background source refresh is not a user edit");
run("openDiaryEditor(diaryEntries['case-a'][0])");
assert.equal(run("diaryEditForms['entry-a'].body"), "合成クラウド更新", "clean reopening uses the current saved record");
assert.equal(run("isDirty()"), false);
run("updateForm('case-a', { body: '仮の新規記録' })");
saveSucceeds = false;
run("saveDiary('case-a')");
assert.equal(run("isDirty()"), true, "failed new save must retain the guard");
saveSucceeds = true;
run("updateForm('case-b', { files: [{ id: 'fixture-photo' }] }); saveDiary('case-a')");
assert.equal(run("isDirty()"), true, "saving one notebook must retain another notebook's photo draft");
run("saveDiary('case-b')");
assert.equal(run("isDirty()"), false, "successful body/photo saves clear their drafts");
run("updateForm('removed-case', { body: '削除済み手帳の古い入力' })");
assert.equal(run("isDirty()"), false, "discarded notebooks must not create an unreachable warning");

console.log("diary unsaved changes: ok (new body/photo, edit baselines, save/cancel/failure, native event lifecycle; synthetic only)");
