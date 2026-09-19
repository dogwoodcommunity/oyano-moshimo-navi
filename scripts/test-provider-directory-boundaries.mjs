import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
let clock = Date.parse("2026-09-19T03:00:00Z");
class Clock extends Date { static now() { return clock; } }
const windowStub = { requestAnimationFrame: (callback) => callback() };
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, {
    module, exports: module.exports, URL, Date: Clock, window: windowStub,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), "unexpected import: " + name);
      return dependencies[name];
    }
  });
  return module.exports;
}
const prefs = load("apps/web/lib/prefectures.ts");
const core = load("apps/web/lib/providerDirectory.ts", { "./prefectures": prefs });
const fixture = (id, placement) => ({
  id, name: "架空テスト事業者" + id, description: "公開しない合成データ",
  website: "https://example.com/" + id, categoryIds: ["cleanup"],
  areas: [{ prefecture: "兵庫県", cities: ["神戸市"] }], placement,
  reviewStatus: "approved", reviewedAt: "2026-09-18T00:00:00Z",
  publishFrom: "2026-09-19T00:00:00Z", publishUntil: "2026-09-20T00:00:00Z"
});
const listings = core.getPublicProviderListings([fixture("paid", "sponsored"), fixture("organic", "general")], clock);
let states = [], cursor = 0;
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
    return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
  },
  useMemo: (callback) => callback(),
  useRef: () => ({ current: null }),
  useEffect: () => {}
};
const jsx = (type, props) => ({ type, props });
const { ProviderDirectory } = load("apps/web/components/ProviderDirectory.tsx", {
  react, "react/jsx-runtime": { jsx, jsxs: jsx },
  "@/lib/prefectures": prefs, "@/lib/providerDirectory": core,
  "./ProviderDirectory.module.css": { default: new Proxy({}, { get: (_, key) => key }) }
});
const render = () => { cursor = 0; return ProviderDirectory({ listings }); };
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const byId = (tree, id) => find(tree, (node) => node.props.id === id);
const text = (node) => Array.isArray(node) ? node.map(text).join("") : typeof node === "object" && node ? text(node.props?.children) : node == null || node === false ? "" : String(node);
const submit = (tree) => find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
const change = (tree, id, value) => byId(tree, id).props.onChange({ target: { value } });
let tree = render();
assert.equal(nodes(tree).filter((node) => node.type === "a").length, 0, "no business before explicit search");
assert.equal(find(tree, (node) => node.type === "form").props.noValidate, true);
submit(tree); tree = render();
assert.match(text(byId(tree, "provider-error")), /都道府県/);
change(tree, "provider-prefecture", "兵庫県"); tree = render(); submit(tree); tree = render();
assert.match(text(byId(tree, "provider-error")), /市区町村/);
change(tree, "provider-city", "神戸市"); tree = render(); submit(tree); tree = render();
assert.match(text(byId(tree, "provider-error")), /業種/);
change(tree, "provider-category", "cleanup"); tree = render();
assert.equal(byId(tree, "provider-results-title"), undefined, "setting all values still requires search");
submit(tree); tree = render();
assert.match(text(byId(tree, "provider-sponsored-title")), /^広告/);
assert.match(text(byId(tree, "provider-general-title")), /広告以外/);
let links = nodes(tree).filter((node) => node.type === "a");
assert.equal(links.length, 2);
for (const link of links) {
  assert.equal(link.props.target, "_blank");
  assert.equal(link.props.referrerPolicy, "no-referrer");
  assert.match(link.props.rel, /noopener noreferrer/);
  assert.equal(new URL(link.props.href).search, "");
}
assert.match(links[0].props.rel, /sponsored/);
assert.doesNotMatch(links[1].props.rel, /sponsored/);
assert.match(text(tree), /2026年9月18日/);
let prevented = false;
links[0].props.onClick({ preventDefault() { prevented = true; } });
assert.equal(prevented, false, "active website may open");
clock = Date.parse("2026-09-20T00:00:00Z");
links[0].props.onAuxClick({ preventDefault() { prevented = true; } });
assert.equal(prevented, true, "expired link cannot open even before timer refresh");
tree = render();
assert.equal(nodes(tree).filter((node) => node.type === "a").length, 0);
assert.match(text(tree), /掲載期間が終了/);
change(tree, "provider-city", "西宮市"); tree = render();
assert.equal(byId(tree, "provider-results-title"), undefined, "editing removes stale results");
submit(tree); tree = render();
assert.match(text(tree), /現在掲載中の協賛事業者はありません/);

const ui = read("apps/web/components/ProviderDirectory.tsx");
assert.doesNotMatch(ui, /fetch\s*\(|localStorage|sessionStorage|supabase|useNotebook|useSearchParams|sendBeacon|trackEvent|<img\b|<Image\b/);
assert.match(ui, /setTimeout/);
assert.match(ui, /visibilitychange/);
assert.match(ui, /onAuxClick/);
const page = read("apps/web/app/providers/page.tsx");
assert.match(page, /dynamic = "force-dynamic"/);
assert.match(page, /getPublicProviderListings\(providerDirectoryCatalog, Date.now\(\)\)/);
assert.match(page, /href="\/crisis"/);
assert.match(page, /www\.j-lis\.go\.jp/);
assert.doesNotMatch(page, /searchParams|cookies\(|sponsor_applications|supabase|useNotebook/);
const consult = read("apps/web/components/ConsultPanel.tsx");
assert.match(consult, /href="\/providers" prefetch=\{false\}/);
assert.doesNotMatch(consult, /href=.?[^\n]*\/providers\?/);
assert.match(read("apps/web/lib/consult.ts"), /特定の事業者名や商品名は出さない/);
const catalog = load("apps/web/lib/providerDirectoryCatalog.ts");
assert.equal(catalog.providerDirectoryCatalog.length, 0, "actual publication requires a separately reviewed catalog change");
assert.match(read("apps/web/app/sponsors/page.tsx"), /優先掲載は広告枠の中だけ/);
assert.match(read("apps/web/app/sponsors/page.tsx"), /成約も保証しません/);
assert.match(read("apps/web/app/legal/privacy/page.tsx"), /AIの助言や広告以外の掲載順には影響させません/);
console.log("PASS provider directory component flow and privacy boundaries (synthetic only)");
