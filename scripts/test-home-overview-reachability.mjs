import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const home = read("apps/web/app/home/page.tsx");
const styles = ["apps/web/app/globals.css", "apps/web/app/readable-theme.css"].map(read).join("\n");

const tabList = home.match(/const notebookTabs:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";
const expectedTabs = ["overview", "record", "history", "profile", "tasks", "media"];

for (const tab of expectedTabs) {
  assert.ok(tabList.includes(`id: "${tab}"`), `notebook tabs must expose ${tab}`);
}

assert.ok(tabList.indexOf('id: "overview"') < tabList.indexOf('id: "record"'), "summary must be visible before the five task tabs");
assert.match(home, /if \(hash === "#notebook-overview"\) return "overview";/, "summary hash must select the overview panel");
assert.match(home, /if \(tab === "overview"\) return "#notebook-overview";/, "summary tab must point to its panel");
assert.match(home, /if \(tab === "overview"\) return "今日見る";/, "summary tab must explain its immediate value");
assert.match(home, /aria-labelledby="notebook-tab-overview"[\s\S]*?id="notebook-overview"[\s\S]*?role="tabpanel"/, "overview content must be controlled by the summary tab");

for (const section of ["今日見るところ", "今日の一手", "記録から見えること", "次に備えること"]) {
  assert.ok(home.includes(section), `overview must retain ${section}`);
}

// The B design may reflow tabs, but none of the six existing panels may disappear.
assert.doesNotMatch(styles, /\.notebook-tab-bar(?:\s+button(?:\.is-overview)?)?\s*\{[^}]*?(?:display:\s*none|visibility:\s*hidden)/, "summary and task navigation must remain visible in both stylesheets");
assert.match(home, /notebookTabs\.map\(\(tab\) => \([\s\S]*?aria-controls=\{hashForNotebookTab\(tab\.id\)\.slice\(1\)\}[\s\S]*?aria-selected=\{activeNotebookTab === tab\.id\}[\s\S]*?onClick=\{\(\) => openNotebookSection\(hashForNotebookTab\(tab\.id\)\)\}/, "every summary/task tab must retain its selected state, panel reference and existing navigation handler");
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.notebook-tab-bar\s*\{\s*position:\s*static;/, "mobile notebook tabs must not overlap the fixed header");

// Execute the real reconciliation inspection callback and navigation handlers.
// Synthetic DOM/timers only; no React rendering, stored records or network.
const ts = createRequire(path.join(repoRoot, "apps/web/package.json"))("typescript");
const ast = ts.createSourceFile("home.tsx", home, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
visit(ast);
const handlers = ["tabForHash", "openNotebookSection"].map((name) => {
  const found = nodes.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(found.length, 1);
  return found[0].getText(ast);
});
const component = nodes.filter((node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "NotebookReconciliation");
assert.equal(component.length, 1);
const callback = component[0].attributes.properties.find((node) => ts.isJsxAttribute(node) && node.name.text === "onOpenLocal");
assert.ok(callback?.initializer?.expression, "stopped reconciliation must have a local inspection callback");
const events = [];
vm.runInNewContext(ts.transpileModule(`${handlers.join("\n")}\n(${callback.initializer.expression.getText(ast)})();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText, {
  setActiveNotebookTab: (tab) => events.push(["tab", tab]),
  markMonitorActivity() {}, trackFunnel() {},
  setProfileEditorOpen() { assert.fail("inspection must not open the profile"); },
  window: { setTimeout: (run) => run(), requestAnimationFrame: (run) => run() },
  document: { querySelector(selector) {
    assert.equal(selector, "#diary-history", "inspection must target a real history panel, not a tab name");
    return { scrollIntoView: () => events.push(["scroll", selector]) };
  } }
});
assert.deepEqual(events, [["tab", "history"], ["scroll", "#diary-history"]]);

console.log("home overview reachability tests passed");
