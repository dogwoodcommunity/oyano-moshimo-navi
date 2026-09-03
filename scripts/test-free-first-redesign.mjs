import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const home = read("apps/web/app/home/page.tsx");
const styles = read("apps/web/app/globals.css");
const family = read("apps/web/components/FamilyShare.tsx");
const familyPage = read("apps/web/app/family/page.tsx");
const consult = read("apps/web/components/ConsultPanel.tsx");
const plans = read("apps/web/app/plans/page.tsx");
const funnel = read("packages/shared/src/funnel.ts");
const privacy = read("apps/web/app/legal/privacy/page.tsx");
const start = read("apps/web/app/start/page.tsx");

for (const label of ["今日の様子を記録する", "AIに相談", "家族と使う", "過去の記録", "書類・鍵の場所"]) {
  assert.ok(home.includes(label), `home must expose ${label}`);
}

assert.ok(home.includes('id: "history", label: "履歴"'), "history must have its own visible tab");
assert.ok(home.includes('activeNotebookTab === "history"'), "history content must be isolated from the record form");
assert.ok(home.includes('id="document-location-note"'), "document location note must have a direct anchor");
assert.ok(home.includes('disabled={cell.count === 0}'), "calendar days without records must not look actionable");
assert.ok(home.includes("すべての記録に戻る"), "history clear action must use plain language");
assert.ok(home.includes("ナビからのヒントを見る"), "generated advice must be collapsed behind an explicit label");
assert.ok(home.includes("addDiaryEntryWithStatus"), "record save must distinguish persistent success from failure");
assert.ok(home.includes("updateCaseProfileWithStatus"), "document memo save must distinguish persistent success from failure");
assert.ok(home.includes('role="tablist"') && home.includes('role="tab"') && home.includes('role="tabpanel"'), "notebook navigation must expose its selected panels to assistive technology");
assert.doesNotMatch(start, /created=\$\{record\.id\}#person-profile/, "new notebook creation must open at the free home actions, not deep-link into a long profile form");

assert.doesNotMatch(styles, /\.notebook-tab-bar\s*\{\s*display:\s*none;/, "notebook navigation must stay visible");
assert.ok(styles.includes(".record-first-quick-grid"), "mobile quick actions must be styled");
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.notebook-tab-bar\s*\{\s*position:\s*static;/, "mobile notebook tabs must not overlap the stacked global header");
assert.match(styles, /\.cloud-backup-card p\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/, "cloud backup explanation must wrap instead of overflowing narrow screens");
assert.match(styles, /\.cloud-auto-line\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/, "cloud sync status must stay inside the card on narrow screens");
assert.match(styles, /\.cloud-form input\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?width:\s*100%;/, "cloud email input must shrink within the mobile card");

assert.ok(familyPage.includes("招待は3つの手順です"), "family steps must be visible before sign-in");
assert.ok(family.includes("まだ相手には届いていません"), "creating an invite must not be described as sending it");
assert.ok(family.includes("LINEやメールで送る"), "invite result must provide a clear send action");

assert.ok(consult.includes("明日0時から、また無料で1回相談できます"), "daily free limit must explain the next free use");
assert.ok(!consult.includes("Plusでこの相談を続ける"), "daily consultation flow must not push an upgrade");
assert.ok(!home.includes("Family Plus（月980円・年9,800円）"), "record save flow must not show price promotion");

assert.match(plans, /name: "無料"[\s\S]*?featured: true/, "free plan must be the featured plan");
assert.match(plans, /name: "Family Plus"[\s\S]*?featured: false/, "Plus must be visually secondary");

for (const event of ["history_viewed", "document_memo_saved", "family_invite_created", "family_invite_shared"]) {
  assert.ok(funnel.includes(`"${event}"`), `free growth event ${event} must be accepted`);
}
assert.ok(privacy.includes("履歴の表示、書類メモの保存、家族招待リンクの作成・共有"), "privacy notice must describe the free growth events");

console.log("free-first redesign tests passed");
