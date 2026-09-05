import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

console.log("home overview reachability tests passed");
