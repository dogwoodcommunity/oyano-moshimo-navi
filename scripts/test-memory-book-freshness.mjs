import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Runs the actual page with a deterministic hook/event harness and real store.
// Synthetic data only; no browser, HTTP, credentials or PDF/OS print operation.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const ts = require("typescript");
const compile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const snapshot = (data) => JSON.stringify([...data]);
function emitter(extra = {}) {
  const handlers = new Map();
  return { ...extra, handlers,
    addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); },
    removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
    dispatch(name, event = {}) { for (const fn of [...(handlers.get(name) ?? [])]) fn(event); }
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function fixture() {
  const cases = [{ id: "fresh-case", personProfile: { displayName: "架空の手帳" }, createdAt: "2026-09-01" }];
  const row = (id, body = `仮本文 ${id}`) => ({ id, caseId: "fresh-case", date: "2026-09-01", body,
    createdAt: "2026-09-01T00:00:00Z", mood: "stable", attachments: [] });
  const data = new Map([
    ["oyano_cases_v03", JSON.stringify(cases)],
    ["oyano_diary_entries_v01", JSON.stringify([row("a"), row("b")])]
  ]);
  let printCalls = 0;
  let imageWait = null;
  let authWait = null;
  let fetchCalls = 0;
  let remoteResponse = null;
  const window = emitter({ setTimeout, clearTimeout,
    requestAnimationFrame(fn) { fn(); return 1; }, cancelAnimationFrame() {},
    print() { printCalls += 1; },
    localStorage: { getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }
  });
  const document = emitter({ title: "fixture", visibilityState: "visible", body: { style: { overflow: "" } },
    getElementById: () => null, querySelectorAll: () => imageWait ? [{}] : [] });
  let cursor = 0;
  let pending = true;
  let tree;
  const slots = [];
  const effects = [];
  let holdFunctionalUpdates = false;
  const heldUpdates = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => {
        const apply = () => {
          const next = typeof value === "function" ? value(slots[index]) : value;
          if (!Object.is(next, slots[index])) { slots[index] = next; pending = true; }
        };
        if (holdFunctionalUpdates && typeof value === "function") heldUpdates.push(apply);
        else apply();
      }];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useMemo(fn, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: fn() }; return slots[index].value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (same(slots[index]?.deps, deps)) return;
      effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    }
  };
  const exports = {};
  function load(file, imports) {
    const module = { exports: {} };
    vm.runInNewContext(`(function(module,exports,require){${compile(read(file))}\n})(module,module.exports,require);`, {
      module, require: imports, window, document, AbortController, Date, Promise, setTimeout, clearTimeout,
      fetch: async () => {
        fetchCalls += 1;
        assert.ok(remoteResponse, "refresh must not fetch new remote data");
        return { ok: true, json: async () => remoteResponse };
      }
    });
    return module.exports;
  }
  const store = load("apps/web/lib/store.ts", (name) => {
    if (name === "@/lib/funnel") return { trackFunnel() { assert.fail("no analytics during print safety checks"); } };
    if (name === "@/lib/date") return { japanDateInputValue: () => "2026-09-07" };
    if (name === "@/lib/caseOwnership") return { ANONYMOUS_CASE_TOKEN_PATTERN: /^[a-z0-9_-]+$/i };
    if (name === "@oyano/shared") return {};
    throw new Error(`Unexpected store import ${name}`);
  });
  const helpers = load("apps/web/lib/memoryBookExport.ts", () => { throw new Error("Unexpected helper import"); });
  const Page = load("apps/web/app/memory-book/[caseId]/page.tsx", (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === "next/link") return { default: "a" };
    if (name === "next/navigation") return { useParams: () => ({ caseId: "fresh-case" }) };
    if (name === "@/lib/store") return store;
    if (name === "@/lib/memoryBookExport") return { ...helpers, waitForPrintableImage: () => imageWait?.promise ?? Promise.resolve(true) };
    if (name === "@/lib/browserSupabase") return { getBrowserSupabase: () => authWait ? { auth: { getSession: () => authWait.promise } } : null };
    throw new Error(`Unexpected page import ${name}`);
  }).default;
  function flush() {
    for (let turn = 0; pending || effects.length; turn += 1) {
      assert.ok(turn < 30, "no render/effect loop");
      if (pending) { pending = false; cursor = 0; tree = Page(); }
      for (const effect of effects.splice(0)) effect();
    }
  }
  const descendants = (node) => !node || typeof node !== "object" ? []
    : Array.isArray(node) ? node.flatMap(descendants) : [node, ...descendants(node.props?.children)];
  const nodes = () => descendants(tree);
  const textOf = (node) => node == null || typeof node === "boolean" ? ""
    : typeof node !== "object" ? String(node)
      : Array.isArray(node) ? node.map(textOf).join("") : textOf(node.props?.children);
  const button = (label) => {
    const candidates = nodes().filter((node) => node.type === "button" && textOf(node) === label);
    assert.equal(candidates.length, 1, `exact button: ${label}`);
    return candidates[0];
  };
  function click(label) { const target = button(label); assert.ok(!target.props.disabled, `${label} enabled`); const result = target.props.onClick(); flush(); return result; }
  function changeRows(rows) { data.set("oyano_diary_entries_v01", JSON.stringify(rows)); }
  function selectedIds() { return nodes().filter((node) => node.type === "article" && node.props.className?.includes("is-included")).map((node) => textOf(node)); }
  function cleanup() { for (const slot of slots) slot?.cleanup?.(); }
  Object.assign(exports, { data, cases, row, store, flush, click, nodes, button, text: () => textOf(tree), window, document, changeRows, selectedIds, cleanup,
    printCalls: () => printCalls, fetchCalls: () => fetchCalls,
    setImageWait: (value) => { imageWait = value; }, setAuthWait: (value) => { authWait = value; },
    setRemoteResponse: (value) => { remoteResponse = value; },
    holdUpdaters: () => { holdFunctionalUpdates = true; }, heldCount: () => heldUpdates.length,
    releaseUpdaters: () => { holdFunctionalUpdates = false; for (const apply of heldUpdates.splice(0)) apply(); } });
  return exports;
}

// A missed storage event cannot allow stale content through the final button.
{
  const f = fixture(); f.flush();
  await f.click("PDF保存の準備をする"); f.flush();
  const prepared = f.button("PDF保存画面を開く");
  f.changeRows([f.row("a", "新しい仮本文"), f.row("b")]);
  const original = snapshot(f.data);
  prepared.props.onClick(); f.flush();
  assert.equal(f.printCalls(), 0, "stale print blocked even without a browser storage event");
  assert.ok(f.text().includes("新しい仮本文"));
  assert.ok(!f.text().includes("PDF保存の準備ができました。"));
  assert.equal(snapshot(f.data), original, "refresh never writes the notebook");
  await f.click("PDF保存の準備をする"); f.flush(); f.click("PDF保存画面を開く");
  assert.equal(f.printCalls(), 1, "unchanged re-prepared snapshot can print");
  f.window.dispatch("storage", { key: "unrelated-color-preference" }); f.flush();
  assert.ok(f.text().includes("PDF保存の準備ができました。"), "unrelated storage changes do not cancel a valid snapshot");
  f.cleanup();
}

// Keep exclusions, do not silently include new records, and honor real receipts.
{
  const f = fixture(); f.flush();
  const checkboxes = f.nodes().filter((node) => node.type === "input" && node.props.type === "checkbox");
  const recordChecks = checkboxes.slice(1); // first control toggles photos; following two select records.
  assert.equal(recordChecks.length, 2);
  recordChecks[1].props.onChange(); f.flush();
  const identity = { familyId: "fixture-family", personId: "fixture-person", localCaseId: "fresh-case", localDiaryId: "a", cloudRevision: null, cloudHash: null };
  f.store.prepareDiaryEntryLocalDeletion(identity); f.store.completeDiaryEntryLocalDeletion(identity);
  f.changeRows([f.row("a"), f.row("b"), f.row("new")]); // stale raw row remains; receipt must win.
  const original = snapshot(f.data);
  f.window.dispatch("storage", { key: "oyano_diary_entries_v01", storageArea: f.window.localStorage }); f.flush();
  assert.ok(!f.text().includes("仮本文 a"), "terminal deletion receipt removes stale visible body");
  assert.ok(f.text().includes("仮本文 b") && f.text().includes("仮本文 new"));
  assert.equal(f.selectedIds().length, 0, "deselections survive and new entries remain excluded");
  assert.equal(snapshot(f.data), original); f.cleanup();
}

// Deletion during async image preparation must not resurrect readiness or photos.
{
  const f = fixture(); const image = deferred(); f.setImageWait(image); f.flush();
  const preparing = f.click("PDF保存の準備をする");
  f.data.set("oyano_cases_v03", "[]");
  f.window.dispatch("focus"); f.flush();
  image.resolve(true); await preparing; f.flush();
  assert.ok(f.text().includes("手帳が見つかりませんでした。"));
  assert.ok(!f.text().includes("仮本文") && !f.text().includes("PDF保存画面を開く"));
  assert.equal(f.printCalls(), 0); f.cleanup();
}

// Visible-tab refresh catches missed events, including local clear/replacement.
{
  const f = fixture(); f.flush(); f.changeRows([f.row("a", "更新後の内容")]);
  f.document.dispatch("visibilitychange"); f.flush();
  assert.ok(f.text().includes("更新後の内容"));
  f.data.clear(); f.window.dispatch("storage", { key: null, storageArea: f.window.localStorage }); f.flush();
  assert.ok(f.text().includes("手帳が見つかりませんでした。"));
  f.cleanup();
  assert.equal(f.window.handlers.get("storage")?.size ?? 0, 0);
  assert.equal(f.window.handlers.get("focus")?.size ?? 0, 0);
  assert.equal(f.document.handlers.get("visibilitychange")?.size ?? 0, 0);
  assert.equal(f.fetchCalls(), 0);
}

// No event is necessary: preparing itself rereads changed data before waiting.
{
  const f = fixture(); f.flush(); f.changeRows([f.row("a", "準備直前の変更")]);
  await f.click("PDF保存の準備をする"); f.flush();
  assert.ok(f.text().includes("準備直前の変更"));
  assert.ok(!f.text().includes("PDF保存の準備ができました。")); f.cleanup();
}

// Late initial authentication must not start a photo fetch after local deletion.
{
  const f = fixture(); const auth = deferred(); f.setAuthWait(auth);
  const photoRow = { ...f.row("a"), attachments: [{ id: "photo-a", type: "image/png", name: "fixture", size: 1,
    storageBucket: "fixture-bucket", storagePath: "fixture/photo-a" }] };
  f.changeRows([photoRow]); f.flush();
  f.changeRows([]); f.window.dispatch("storage"); f.flush();
  auth.resolve({ data: { session: { access_token: "synthetic-not-a-credential" } } });
  for (let i = 0; i < 20; i += 1) { await Promise.resolve(); f.flush(); }
  assert.equal(f.fetchCalls(), 0, "invalidated photo request never starts HTTP after auth settles");
  assert.ok(!f.text().includes("仮本文 a")); f.cleanup();
}

// Signed URL hydration is not a raw notebook edit and must not invalidate print.
{
  const f = fixture(); const auth = deferred(); f.setAuthWait(auth);
  const attachment = { id: "photo-a", type: "image/png", name: "fixture", size: 1,
    storageBucket: "fixture-bucket", storagePath: "fixture/photo-a" };
  const photoRow = { ...f.row("a"), attachments: [attachment] };
  f.changeRows([photoRow]);
  f.setRemoteResponse({ diaryEntries: [{ ...photoRow, attachments: [{ ...attachment, previewUrl: "https://fixture.invalid/synthetic.png" }] }],
    diaryEntriesTotal: 1, diaryEntriesHasMore: false });
  const original = snapshot(f.data);
  f.flush(); auth.resolve({ data: { session: { access_token: "synthetic-not-a-credential" } } });
  for (let i = 0; i < 30; i += 1) { await Promise.resolve(); f.flush(); }
  assert.equal(f.fetchCalls(), 1, "only the initial mocked photo hydration executes");
  assert.ok(f.nodes().some((node) => node.type === "img" && node.props.src === "https://fixture.invalid/synthetic.png"));
  await f.click("PDF保存の準備をする"); f.flush();
  f.window.dispatch("focus"); f.flush(); f.click("PDF保存画面を開く");
  assert.equal(f.printCalls(), 1, "unchanged raw snapshot remains printable after URL hydration");
  assert.equal(snapshot(f.data), original, "hydration and print leave the original store byte-for-byte unchanged");
  f.click("写真を大きく見る");
  assert.ok(f.nodes().some((node) => node.props?.role === "dialog"));
  f.changeRows([]); f.window.dispatch("storage"); f.flush();
  assert.ok(!f.nodes().some((node) => node.props?.role === "dialog"), "a removed photo must not remain expanded");
  assert.equal(f.fetchCalls(), 1, "refresh must not start another cloud request"); f.cleanup();
}

// An obsolete image wait must not turn off a newer attempt's busy state.
{
  const f = fixture(); const first = deferred(); f.setImageWait(first); f.flush();
  const oldAttempt = f.click("PDF保存の準備をする");
  f.changeRows([f.row("a", "新しい試行用の本文")]); f.window.dispatch("focus"); f.flush();
  const second = deferred(); f.setImageWait(second);
  const newAttempt = f.click("PDF保存の準備をする");
  first.resolve(true); await oldAttempt; f.flush();
  assert.ok(f.button("写真を準備しています…").props.disabled, "stale completion cannot enable controls of a newer attempt");
  assert.ok(!f.text().includes("PDF保存の準備ができました。"));
  second.resolve(true); await newAttempt; f.flush();
  f.click("PDF保存画面を開く"); assert.equal(f.printCalls(), 1); f.cleanup();
}

for (const mismatch of ["case", "path", "bucket"]) {
  const f = fixture(); const auth = deferred(); f.setAuthWait(auth);
  const attachment = { id: "photo-a", type: "image/png", name: "fixture", size: 1,
    storageBucket: "fixture-bucket", storagePath: "fixture/photo-a" };
  const local = { ...f.row("a"), attachments: [attachment] };
  const remote = { ...local, ...(mismatch === "case" ? { caseId: "other-case" } : {}), attachments: [{
    ...attachment, ...(mismatch === "path" ? { storagePath: "other/path" } : {}),
    ...(mismatch === "bucket" ? { storageBucket: "other-bucket" } : {}),
    previewUrl: "https://fixture.invalid/should-not-display.png"
  }] };
  f.changeRows([local]); f.setRemoteResponse({ diaryEntries: [remote], diaryEntriesTotal: 1, diaryEntriesHasMore: false });
  const original = snapshot(f.data);
  f.flush(); auth.resolve({ data: { session: { access_token: "synthetic-not-a-credential" } } });
  for (let i = 0; i < 30; i += 1) { await Promise.resolve(); f.flush(); }
  assert.equal(f.fetchCalls(), 1);
  assert.ok(!f.nodes().some((node) => node.type === "img" && node.props.src?.includes("should-not-display")), `${mismatch} mismatch cannot hydrate a photo`);
  assert.equal(snapshot(f.data), original); f.cleanup();
}

// Ref invalidation precedes React's commit. Old rendered handlers must not
// certify their stale body/selection as a new preparation in that interval.
for (const change of ["notebook", "selection"]) {
  const f = fixture(); f.flush(); await f.click("PDF保存の準備をする"); f.flush();
  const oldPrepare = f.button("PDF保存の準備をする").props.onClick;
  const oldPrint = f.button("PDF保存画面を開く").props.onClick;
  if (change === "notebook") {
    f.changeRows([f.row("a", "commit後の新本文"), f.row("b")]);
    f.window.dispatch("focus");
  } else {
    const recordCheck = f.nodes().filter((node) => node.type === "input" && node.props.type === "checkbox")[2];
    recordCheck.props.onChange();
  }
  // Deliberately do not flush the render after the refresh/selection event.
  await oldPrepare(); oldPrint();
  assert.equal(f.printCalls(), 0, `${change}: pre-commit stale handlers cannot re-arm printing`);
  f.flush(); await f.click("PDF保存の準備をする"); f.flush(); f.click("PDF保存画面を開く");
  assert.equal(f.printCalls(), 1, `${change}: the committed view can be prepared and printed`); f.cleanup();
}

// Applying an already-queued photo updater after invalidation cannot revive it.
{
  const f = fixture(); const auth = deferred(); f.setAuthWait(auth);
  const attachment = { id: "photo-a", type: "image/png", name: "fixture", size: 1,
    storageBucket: "fixture-bucket", storagePath: "fixture/photo-a" };
  const local = { ...f.row("a"), attachments: [attachment] };
  f.changeRows([local]); f.setRemoteResponse({ diaryEntries: [{ ...local, attachments: [{ ...attachment,
    previewUrl: "https://fixture.invalid/obsolete-queued.png" }] }], diaryEntriesTotal: 1, diaryEntriesHasMore: false });
  f.flush(); f.holdUpdaters(); auth.resolve({ data: { session: { access_token: "synthetic-not-a-credential" } } });
  for (let i = 0; i < 30; i += 1) { await Promise.resolve(); f.flush(); }
  assert.ok(f.heldCount() > 0, "the actual async photo updater must be queued before invalidation");
  f.changeRows([{ ...f.row("a", "写真を外した更新"), attachments: [] }]); f.window.dispatch("focus");
  f.releaseUpdaters(); f.flush();
  assert.ok(f.text().includes("写真を外した更新"));
  assert.ok(!f.nodes().some((node) => node.type === "img" && node.props.src?.includes("obsolete-queued")));
  assert.equal(f.fetchCalls(), 1); f.cleanup();
}

console.log("memory book freshness: ok (actual page/store with synthetic hooks/events; no OS print or real data)");
