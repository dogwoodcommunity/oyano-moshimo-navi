import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const source = fs.readFileSync(path.join(repoRoot, "apps/web/lib/memoryBookExport.ts"), "utf8");
const page = fs.readFileSync(path.join(repoRoot, "apps/web/app/memory-book/[caseId]/page.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const module = { exports: {} };
const browserWindow = { setTimeout, clearTimeout };
vm.runInNewContext(`(function(module,exports){${compiled}\n})(module,exports);`, {
  module,
  exports: module.exports,
  window: browserWindow,
  Date,
  Promise,
  setTimeout,
  clearTimeout
});

const { entryIdsInDateRange, waitForPrintableImage, withDeadline } = module.exports;

assert.deepEqual(
  Array.from(entryIdsInDateRange([
    { id: "before", date: "2026-08-31" },
    { id: "start", date: "2026-09-01" },
    { id: "end", date: "2026-09-03" },
    { id: "after", date: "2026-09-04" }
  ], "2026-09-01", "2026-09-03")),
  ["start", "end"],
  "the selected date range must include both boundary dates and exclude outside records"
);

// Exercise the real page's initial case selection and range handler through
// the real local-store visibility rules. The range helper alone deliberately
// does not own case identity or tombstones; do not reproduce those rules here.
{
  const storageData = new Map();
  const fixtureWindow = {
    localStorage: {
      getItem(key) { return storageData.get(key) ?? null; },
      setItem(key, value) { storageData.set(key, String(value)); },
      removeItem(key) { storageData.delete(key); }
    }
  };
  const storeModule = { exports: {} };
  const storeCode = ts.transpileModule(fs.readFileSync(path.join(repoRoot, "apps/web/lib/store.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(`(function(module,exports,require){${storeCode}\n})(module,module.exports,require);`, {
    module: storeModule, window: fixtureWindow,
    require(specifier) {
      if (specifier === "@/lib/funnel") return { trackFunnel() { assert.fail("PDF selection must not emit analytics"); } };
      if (specifier === "@/lib/date") return { japanDateInputValue: () => "2026-09-06" };
      if (specifier === "@/lib/caseOwnership") return { ANONYMOUS_CASE_TOKEN_PATTERN: /^[a-z0-9_-]+$/i };
      if (specifier === "@oyano/shared") return {};
      throw new Error(`Unexpected PDF store import: ${specifier}`);
    }
  });
  const store = storeModule.exports;
  const entry = (id, date, caseId = "pdf-case-a", body = `原文 ${id}\r\n🙂\n`) => ({
    id, caseId, date, body, mood: "stable", attachments: [], createdAt: `${date}T09:00:00.000Z`
  });
  const rows = [
    entry("before", "2026-08-31"), entry("start", "2026-09-01"),
    entry("deleted", "2026-09-02"), entry("pending", "2026-09-02"),
    entry("end", "2026-09-03"), entry("after", "2026-09-04"),
    entry("ai-memo", "2026-09-02", "pdf-case-a", "相談メモ: AI提案は既定の期間選択に含めない"),
    entry("other-case", "2026-09-02", "pdf-case-b", "別対象者の本文"),
    entry("start", "2026-09-02", "pdf-case-b", "同じ日記IDでも別対象者"),
    entry("deleted", "2026-09-02", "pdf-case-b", "別対象者の同名IDは削除していない"),
    entry("deleted-person-entry", "2026-09-02", "pdf-case-deleted")
  ];
  storageData.set("oyano_cases_v03", JSON.stringify(["pdf-case-a", "pdf-case-b", "pdf-case-deleted"].map((id) => ({
    id, createdAt: "2026-09-01T00:00:00.000Z", personProfile: { displayName: id }
  }))));
  storageData.set("oyano_diary_entries_v01", JSON.stringify(rows));
  const identity = {
    familyId: "pdf-family", personId: "pdf-person-a", localCaseId: "pdf-case-a",
    localDiaryId: "deleted", cloudRevision: null, cloudHash: null
  };
  assert.equal(store.prepareDiaryEntryLocalDeletion(identity), true);
  assert.equal(store.completeDiaryEntryLocalDeletion(identity).deleted, true);
  assert.equal(store.prepareDiaryEntryLocalDeletion({ ...identity, localDiaryId: "pending" }), true);
  // A stale raw row can survive/reappear after a local-write failure. The
  // terminal receipt, not physical row removal, must exclude it from the PDF.
  storageData.set("oyano_diary_entries_v01", JSON.stringify(rows));
  storageData.set("oyano_person_notebook_deletions_v01", JSON.stringify([{
    version: 1, familyId: "pdf-family", personId: "pdf-person-deleted", localCaseId: "pdf-case-deleted",
    cloudRevision: 1, cloudHash: "a".repeat(64), status: "deleted", preparedAt: "2026-09-03T00:00:00.000Z"
  }]));
  const immutableStorage = JSON.stringify([...storageData]);
  const ast = ts.createSourceFile("memory-book-page.tsx", page, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const nodes = [];
  function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
  visit(ast);
  function declaration(name, predicate) {
    const matches = nodes.filter((node) => predicate(node) && node.name?.getText(ast) === name);
    assert.equal(matches.length, 1, `the actual PDF page must have one ${name}`);
    return matches[0];
  }
  const nextCase = declaration("nextCase", ts.isVariableDeclaration).getText(ast);
  const nextEntries = declaration("nextEntries", ts.isVariableDeclaration).getText(ast);
  const rangeHandler = declaration("applyDateRange", ts.isFunctionDeclaration).getText(ast);
  const memoPredicate = declaration("isConsultMemo", ts.isFunctionDeclaration).getText(ast);
  const selectedMemo = declaration("selectedEntries", ts.isVariableDeclaration).initializer;
  assert.ok(ts.isCallExpression(selectedMemo), "selected entries must come from the page's useMemo callback");
  const selectionCode = ts.transpileModule(`
    const ${nextCase}; const ${nextEntries};
    const entries = nextEntries;
    ${memoPredicate}
    ${rangeHandler}
    applyDateRange();
    result = { entries, selected: (${selectedMemo.arguments[0].getText(ast)})() };
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  function select(caseId) {
    const context = {
      params: { caseId }, ...store, entryIdsInDateRange,
      dateRangeStart: "2026-09-01", dateRangeEnd: "2026-09-03", selectedEntryIds: new Set(),
      setSelectedEntryIds(ids) { context.selectedEntryIds = ids; },
      invalidatePreparedPrint() {}, setPreparedPrintIntent() {}, setPrintError(message) { context.error = message; }
    };
    vm.runInNewContext(selectionCode, context);
    return context;
  }
  const chosen = select("pdf-case-a");
  assert.equal(chosen.error, "");
  assert.deepEqual(Array.from(chosen.result.selected, (row) => row.id), ["start", "pending", "end"]);
  assert.ok(chosen.result.entries.every((row) => row.caseId === "pdf-case-a"));
  assert.equal(chosen.result.entries.some((row) => row.id === "deleted"), false);
  assert.equal(chosen.result.selected[0].body, rows.find((row) => row.id === "start").body,
    "selection must preserve the raw CRLF, emoji and trailing newline");
  assert.equal(select("pdf-case-b").result.selected.length, 3,
    "a receipt in case A must not hide another person's similarly identified diary");
  const deletedPerson = select("pdf-case-deleted");
  assert.equal(deletedPerson.result.entries.length, 0);
  assert.equal(deletedPerson.result.selected.length, 0);
  assert.match(deletedPerson.error, /記録がありません/);
  assert.equal(JSON.stringify([...storageData]), immutableStorage, "PDF reads/range selection must not write original records or receipts");
}

class FakeImage extends EventTarget {
  constructor({ complete, naturalWidth, decode }) {
    super();
    this.complete = complete;
    this.naturalWidth = naturalWidth;
    this.decode = decode;
  }
}

{
  const image = new FakeImage({ complete: true, naturalWidth: 640, decode: () => Promise.resolve() });
  assert.equal(await waitForPrintableImage(image, 50), true, "a decoded visible image must be printable");
}

{
  const image = new FakeImage({ complete: false, naturalWidth: 0, decode: () => Promise.resolve() });
  setTimeout(() => {
    image.complete = true;
    image.naturalWidth = 640;
    image.dispatchEvent(new Event("load"));
  }, 5);
  assert.equal(await waitForPrintableImage(image, 60), true, "a later load event must unblock preparation");
}

{
  const image = new FakeImage({ complete: false, naturalWidth: 0, decode: () => Promise.resolve() });
  assert.equal(await waitForPrintableImage(image, 20), false, "a missing load event must time out");
}

{
  const image = new FakeImage({ complete: true, naturalWidth: 640, decode: () => new Promise(() => {}) });
  assert.equal(await waitForPrintableImage(image, 20), false, "an unresolved decode must time out");
}

{
  let timeoutCallbackCalled = false;
  await assert.rejects(
    withDeadline(new Promise(() => {}), 20, () => {
      timeoutCallbackCalled = true;
    }),
    (error) => error?.name === "TimeoutError",
    "an unresolved cloud auth operation must hit the total deadline"
  );
  assert.equal(timeoutCallbackCalled, true, "the total deadline must abort the outstanding request");
}

assert.match(page, /const controller = new AbortController\(\)/, "cloud photo restore must be abortable");
assert.match(page, /CLOUD_PHOTO_LOAD_TIMEOUT_MS/, "cloud photo restore must have a total deadline");
assert.match(page, /\(includePhotos && photoLoadState === "loading"\) \|\| printPreparing/, "text-only export must stay available while cloud photos load");
assert.match(page, /PDF保存の準備をする/);
assert.match(page, /紙に印刷する準備をする/);
assert.match(page, /PDF保存画面を開く/);
assert.match(page, /まとめる期間を選ぶ/);
assert.match(page, /写真を大きく見る/);
assert.ok((page.match(/disabled=\{printPreparing\}/g) ?? []).length >= 5, "selection controls must be locked while print preparation runs");
assert.match(page, /disabled=\{photosOverLimit \|\| printPreparing\}/, "the photo option must be locked while print preparation runs");

await import("./test-memory-book-freshness.mjs");
console.log("memory book export safety checks: ok");
