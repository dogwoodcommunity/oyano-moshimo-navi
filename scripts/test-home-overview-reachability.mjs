import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const home = read("apps/web/app/home/page.tsx");
const styles = read("apps/web/app/globals.css");

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

assert.match(styles, /\.notebook-tab-bar\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/, "the existing five task tabs must keep their columns");
assert.match(styles, /\.notebook-tab-bar button\.is-overview\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/, "summary must use its own full-width row");
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.notebook-tab-bar\s*\{\s*position:\s*static;/, "mobile notebook tabs must not overlap the fixed header");

console.log("home overview reachability tests passed");
