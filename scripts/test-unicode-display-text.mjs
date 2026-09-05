import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Run the real excerpt helper and home consumers in memory. No app render,
// storage, Auth, network, database or notebook mutation is performed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const helperSource = read("apps/web/lib/displayText.ts");
const home = read("apps/web/app/home/page.tsx");
const tree = ts.createSourceFile("home.tsx", home, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
visit(tree);
function realFunction(name) {
  const matches = nodes.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, `one real ${name} function is required`);
  return matches[0].getText(tree);
}
const latest = nodes.filter((node) => ts.isVariableDeclaration(node) && node.name.getText(tree) === "latestEntrySummary");
assert.equal(latest.length, 1);

function compile(source, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) { throw new Error(`Unexpected dependency: ${name}`); }, ...globals
  });
  return module.exports;
}

assert.match(home, /import \{ truncateDisplayText \} from "@\/lib\/displayText"/);
assert.doesNotMatch(home, /(?:entry|latestEntry)\.body\.slice\(/, "diary excerpts must not split UTF-16 code units");
assert.doesNotMatch(realFunction("clipText"), /\.slice\(/);
assert.doesNotMatch(helperSource, /localStorage|fetch\(|supabase|\/store/, "display helper must not write or sync notebook data");
for (const name of ["saveDiary", "saveDiaryEdit", "syncNotebookToCloud", "restoreNotebookFromCloud"]) {
  assert.doesNotMatch(realFunction(name), /truncateDisplayText|clipText\(/, `${name} must keep full original content`);
}

let checks = 0;
for (const [mode, intl] of [["Intl.Segmenter", Intl], ["fallback", {}], ["no Intl", undefined]]) {
  const { truncateDisplayText } = compile(helperSource, { Intl: intl });
  const taskWrites = [];
  const consumers = compile([
    ...["clipText", "buildEntryConsultQuestion", "buildDigestConsultQuestion", "consultHref", "addDiaryTask"].map(realFunction),
    `export function latestExcerpt(latestEntry: any) { return ${latest[0].initializer.getText(tree)}; }`,
    "export { clipText, buildEntryConsultQuestion, buildDigestConsultQuestion, consultHref, addDiaryTask };"
  ].join("\n"), {
    truncateDisplayText,
    formatLongDate: () => "9月6日",
    cloudContentReadOnly: false,
    showCloudRoleReadOnlyMessage() { throw Error("Unexpected role mutation"); },
    diaryTaskTitle: () => "確認すること",
    dateInputAfterDays: () => "2026-09-13",
    addCaseTask(caseId, task) { taskWrites.push({ caseId, task }); return { id: caseId }; },
    replaceCaseInState() {}, setTaskAddedEntryId() {}
  });
  assert.equal(truncateDisplayText("", 0), "");
  assert.equal(truncateDisplayText("あ", 0), "…");
  assert.equal(truncateDisplayText("あ", 0, ""), "");
  for (const invalid of [-1, 0.5, NaN, Infinity]) assert.throws(() => truncateDisplayText("text", invalid), /limit/);
  checks += 7;
  for (const unchanged of ["普通の記録", "  \n前後の空白も残す🙂\r\n", "か\u3099", "👩‍👩‍👧‍👦", "🇯🇵🇬🇧"]) {
    assert.equal(truncateDisplayText(unchanged, 100), unchanged, `${mode}: short raw excerpts preserve whitespace`);
    checks++;
  }
  for (const group of ["🙂", "か\u3099", "👩‍👩‍👧‍👦", "👩🏽‍⚕️", "🇯🇵", "1️⃣"]) {
    for (const limit of [54, 58, 90, 92, 96]) {
      const prefix = "あ".repeat(limit - 1);
      const body = prefix + group + "余り";
      assert.equal(truncateDisplayText(body, limit), prefix + group + "…", `${mode}: preserve ${group} at ${limit}`);
      assert.equal(truncateDisplayText(body, limit, ""), prefix + group);
      assert.equal(consumers.clipText(body, limit), prefix + group + "…");
      assert.doesNotThrow(() => encodeURIComponent(truncateDisplayText(body, limit)));
      checks += 4;
    }
  }
  assert.equal(truncateDisplayText("前\r\n後", 2), "前\r\n…", `${mode}: keep CRLF together`);
  assert.equal(truncateDisplayText("🇯🇵🇬🇧🇨🇦", 2), "🇯🇵🇬🇧…", `${mode}: keep flag pairs together`);
  assert.equal(consumers.clipText("  記録\r\n次の行  ", 100), "記録 次の行", "one-line summary normalization stays intentional");
  checks += 3;

  // Previously clipText sliced into the emoji, and encodeURIComponent threw URIError.
  const original = Object.freeze({
    id: "fixture-entry", caseId: "fixture-case", date: "2026-09-06", mood: "stable",
    body: "あ".repeat(95) + "🙂", attachments: []
  });
  const before = JSON.stringify(original);
  const question = consumers.buildEntryConsultQuestion(original, { displayName: "仮の人" });
  const url = consumers.consultHref(original.caseId, question);
  const query = new URL(url, "https://fixture.invalid").searchParams;
  assert.equal(query.get("q"), question);
  assert.equal(query.get("caseId"), original.caseId);
  assert.ok(question.includes(original.body), `${mode}: boundary emoji survives into AI navigation`);
  assert.equal(JSON.stringify(original), before, "AI preview must not edit the source record");
  checks += 4;

  const latestBody = "あ".repeat(91) + "👩‍👩‍👧‍👦" + "余り";
  assert.equal(consumers.latestExcerpt({ ...original, body: latestBody }), "あ".repeat(91) + "👩‍👩‍👧‍👦…");
  const digestEntry = { ...original, body: "あ".repeat(89) + "🙂" + "余り" };
  const digest = consumers.buildDigestConsultQuestion([digestEntry], undefined, undefined);
  assert.equal(new URL(consumers.consultHref(original.caseId, digest), "https://fixture.invalid").searchParams.get("q"), digest);
  assert.ok(digest.includes("🙂…"));
  consumers.addDiaryTask(original.caseId, digestEntry);
  assert.equal(taskWrites.length, 1);
  assert.equal(taskWrites[0].task.description, "9月6日の記録から追加: " + "あ".repeat(89) + "🙂");
  assert.doesNotThrow(() => encodeURIComponent(taskWrites[0].task.description), "stored task excerpts must not contain orphan surrogates");
  assert.equal(digestEntry.body, "あ".repeat(89) + "🙂余り");
  checks += 7;

  const longBody = "記".repeat(10_001) + "🙂\n終わり\r\n";
  assert.equal(truncateDisplayText(longBody, 92), "記".repeat(92) + "…");
  assert.ok(longBody.endsWith("🙂\n終わり\r\n"));
  assert.equal(longBody.length, 10_009);
  checks += 3;
}

console.log(`Unicode-safe diary excerpts and real home consumer checks: ${checks} passed (no notebook data modified)`);
