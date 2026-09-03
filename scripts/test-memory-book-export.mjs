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

console.log("memory book export safety checks: ok");
