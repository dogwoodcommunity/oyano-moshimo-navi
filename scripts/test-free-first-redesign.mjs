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
const family = read("apps/web/components/FamilyShare.tsx");
const familyPage = read("apps/web/app/family/page.tsx");
const consult = read("apps/web/components/ConsultPanel.tsx");
const plans = read("apps/web/app/plans/page.tsx");
const funnel = read("packages/shared/src/funnel.ts");
const privacy = read("apps/web/app/legal/privacy/page.tsx");
const start = read("apps/web/app/start/page.tsx");
const entry = read("apps/web/components/PwaInstallPanel.tsx");
const result = read("apps/web/app/result/[caseId]/page.tsx");

for (const label of ["記録を書く", "記録を見返す", "AIに相談する", "家族と使う", "書類・鍵の場所"]) {
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
assert.ok(styles.includes(".readable-entry-list"), "the three primary entry actions must be styled");
assert.ok(styles.includes(".readable-support-links"), "family and document actions must remain styled and reachable");
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
assert.ok(!home.includes('title: "家族共有と長期相談を検討する"'), "daily notebook support actions must not include an upgrade card");
assert.ok(!entry.includes("有料プランを見る"), "the first-run screen must focus on the free product while sales are closed");
assert.ok(!start.includes("Plusを見る"), "the free notebook limit must not push an unavailable checkout");
assert.ok(!result.includes("Plusで広げる"), "the post-diagnosis path must continue into the free notebook instead of an unavailable upsell");

assert.match(plans, /name: "無料"[\s\S]*?featured: true/, "free plan must be the featured plan");
assert.match(plans, /name: "Family Plus"[\s\S]*?featured: false/, "Plus must be visually secondary");

for (const event of ["history_viewed", "document_memo_saved", "family_invite_created", "family_invite_shared"]) {
  assert.ok(funnel.includes(`"${event}"`), `free growth event ${event} must be accepted`);
}
assert.ok(privacy.includes("履歴の表示、書類メモの保存、家族招待リンクの作成・共有"), "privacy notice must describe the free growth events");

// Exercise the actual profile helpers, using only synthetic local values.
const ts = createRequire(path.join(repoRoot, "apps/web/package.json"))("typescript");
function profileHelpers(source, names, dependencies = {}) {
  const file = ts.createSourceFile("profile.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statements = file.statements.filter((statement) =>
    (ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text))
    || (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => names.includes(declaration.name.getText(file)))));
  assert.equal(statements.length, names.length, "all actual helpers found");
  const code = statements.map((statement) => statement.getText(file)).join("\n")
    + "\nmodule.exports = {" + names.join(",") + "};";
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, ...dependencies });
  return module.exports;
}
const registration = profileHelpers(start, ["requiredProfileLabels", "missingRequiredProfileFields", "compactProfile"], {
  statusTitle: () => "準備中"
});
const profile = { displayName: "お母さん", relationship: "母", parentPrefecture: "兵庫県", parentCity: "神戸市" };
assert.equal(registration.missingRequiredProfileFields(profile).length, 0, "nickname is enough without full name");
assert.equal(registration.missingRequiredProfileFields({ ...profile, displayName: "" })[0], "displayName", "nickname stays required");
const initial = profileHelpers(read("apps/web/lib/store.ts"), ["textOrUndefined", "cleanInitialProfile"], {
  statusLabel: () => "準備中"
});
const editor = profileHelpers(home, ["profileSeed", "profileCompletion", "missingProfileItems"], {
  personName: (record) => record.personProfile?.displayName || record.answers.targetName,
  relationshipName: () => "母",
  statusLabel: () => "準備中"
});
for (const fullName of [undefined, "", "   "]) {
  const cleaned = initial.cleanInitialProfile(registration.compactProfile({ ...profile, fullName }, "preparing"), "preparing", "2026-09-19T00:00:00Z");
  assert.equal(cleaned.fullName, undefined, "blank name remains absent at creation");
  const restored = JSON.parse(JSON.stringify(cleaned));
  const seeded = editor.profileSeed({ personProfile: restored, answers: { targetName: "お母さん" }, selectedStatus: "preparing" });
  assert.equal(seeded.fullName, "", "reload never copies nickname to full name");
  assert.equal(seeded.displayName, "お母さん");
  assert.equal(editor.missingProfileItems(seeded).includes("フルネーム"), false);
  assert.equal(editor.profileCompletion(seeded).percent, editor.profileCompletion({ ...seeded, fullName: "架空の氏名" }).percent,
    "omitting an optional full name never reduces completeness");
}
assert.equal(editor.profileSeed({ answers: { targetName: "仮の呼び名" }, selectedStatus: "preparing" }).fullName, "",
  "legacy targetName is not proof of a legal full name");
assert.equal(editor.profileSeed({ personProfile: { ...profile, fullName: "入力済みの架空氏名" }, answers: {} }).fullName,
  "入力済みの架空氏名", "an existing explicitly recorded name is preserved");
for (const source of [start, home]) {
  assert.match(source, /フルネーム（任意）/);
  assert.match(source, /空欄で大丈夫です/);
  assert.doesNotMatch(source, /まずはフルネーム/);
}
console.log("free-first redesign and optional full-name tests passed");
