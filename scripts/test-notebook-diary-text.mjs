import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function load(source, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, crypto: webcrypto, TextEncoder, Date, ...globals });
  return module.exports;
}
const helper = load(read("apps/web/lib/notebookReconciliation.ts"));
const route = read("apps/web/app/api/notebook/sync/route.ts");
const ast = ts.createSourceFile("route.ts", route, ts.ScriptTarget.ES2022, true);
const names = ["safeText", "safeDate", "diaryMood", "optionalCloudRevision", "normalizedIso", "normalizedNotebookDiary"];
const functions = names.map((name) => {
  const node = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(node, `real sync function ${name} must exist`);
  return node.getText(ast);
}).join("\n");
// Only photo conversion is stubbed: this test exercises the real diary text
// normalizer, not photo permissions, HTTP authentication or a real database.
const { normalizedNotebookDiary } = load(`${functions}\nexport { normalizedNotebookDiary };`, {
  attachmentSnapshot: () => [], japanDateInputValue: () => "2026-09-05"
});
const localCase = { id: "source" };
const targetCase = { id: "target", cloudPersonId: "person-test" };
const original = { id: "diary-test", caseId: "source", date: "2026-09-05", mood: "stable", attachments: [], createdAt: "2026-09-05T00:00:00.000Z" };
let checks = 0;
for (const body of [
  "あ".repeat(9999), "あ".repeat(10000), "あ".repeat(10001),
  "🙂".repeat(5000), "🙂".repeat(5001), "🙂".repeat(10000), "🙂".repeat(10001),
  "  行頭の空白\n二行目🙂\n\n", "\r\n  記録\r\n末尾の改行\r\n", "か\u3099👨‍👩‍👧‍👦"
]) {
  const entry = { ...original, body };
  const before = JSON.stringify(entry);
  const synced = normalizedNotebookDiary(entry, new Set(), original.createdAt);
  assert.equal(synced.body, body, "normal cloud transfer must preserve every stored code unit, including final newlines");
  assert.equal(JSON.stringify(entry), before, "normalization must not mutate local data");
  assert.equal(JSON.parse(JSON.stringify(synced)).body, body, "JSON transport preserves text");
  const input = { local: { cases: [localCase], diaryEntries: [entry] }, remote: { cases: [targetCase], diaryEntries: [] }, userId: "user-test", familyId: "family-test", memberRole: "owner", binding: null };
  if (Array.from(body).length > 10000) {
    await assert.rejects(helper.planNotebookReconciliation(input), { message: helper.RECONCILIATION_BODY_LIMIT_MESSAGE });
    assert.equal(entry.body, body, "rejected merge leaves the normal long diary intact");
  } else {
    const plan = await helper.planNotebookReconciliation(input);
    const copy = plan.copies[0];
    const transferred = normalizedNotebookDiary(copy, new Set(), original.createdAt);
    const restored = { ...copy, body: transferred.body };
    assert.equal(helper.reconciliationDiaryMatches(copy, restored), true);
    const retry = await helper.planNotebookReconciliation({ ...input, remote: { cases: [targetCase], diaryEntries: [restored] } });
    assert.equal(retry.alreadyPresentCount, 1, "merge → normal sync → restore → retry remains idempotent");
    assert.equal(helper.reconciliationDiaryMatches(copy, { ...copy, body: `${body} ` }), false, "whitespace edits still trigger conflict protection");
  }
  checks++;
}
assert.equal(normalizedNotebookDiary({ ...original, body: " \r\n " }, new Set(), original.createdAt).body, "記録", "legacy empty-body fallback remains unchanged");
const sql = read("supabase/notebook_diary_reconciliation.sql");
assert.match(sql, /length\(v_entry->>'body'\) > 10000/, "client count matches the existing SQL code-point cap; no migration was claimed");
const home = read("apps/web/app/home/page.tsx");
const shortcut = home.indexOf('className="history-export-shortcut"');
assert.ok(shortcut > home.indexOf('id="diary-history"') && shortcut < home.indexOf("<DiaryCalendar"), "PDF shortcut is before the calendar and all long history");
assert.match(home.slice(shortcut, shortcut + 420), /href=\{`\/memory-book\/\$\{activeCase\.id\}`\}/, "export is bound to the selected person's notebook");
console.log(`Diary text integrity: ok (${checks} synthetic round trips; long merge limit remains explicit; no database/network calls)`);
