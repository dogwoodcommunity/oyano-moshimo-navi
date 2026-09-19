import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Real pure helper; synthetic entries only. No storage, account, network or model calls.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const source = fs.readFileSync(path.join(root, "apps/web/lib/diaryContinuity.ts"), "utf8");
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { module, exports: module.exports });
const { findRelatedDiaryEntry: related } = module.exports;
const entry = (id, body, patch = {}) => ({
  id, caseId: "synthetic-case-a", date: "2026-09-18", mood: "stable", body, attachments: [],
  createdAt: "2026-09-18T09:00:00.000Z", ...patch
});
const saved = entry("saved", "午後は公園で散歩をした。", {
  date: "2026-09-19", createdAt: "2026-09-19T09:00:00.000Z"
});
const older = entry("older", "公園で散歩をした。風が涼しかった。");
assert.equal(related(saved, [saved, older]), older, "same notebook literal subject is eligible");
assert.equal(related(saved, [saved]), undefined, "first record/self never links");
assert.equal(related(saved, [older]), undefined, "missing/deleted source must not use retained saved body");
assert.equal(related(saved, [saved, { ...older, caseId: "synthetic-case-b" }]), undefined,
  "another person's notebook is excluded");
assert.equal(related(saved, [saved, entry("unrelated", "通帳を金庫に戻した。")]), undefined,
  "a missing/deleted former match cannot be recovered from previous calls");
const edited = { ...older, body: "通帳を金庫に戻した。", updatedAt: "2026-09-19T11:00:00.000Z" };
for (const candidates of [[older, edited], [edited, older]]) {
  assert.equal(related(saved, [saved, ...candidates]), undefined, "edited duplicate's removed terms never match");
}
const editedSource = { ...saved, body: "通帳を金庫に戻した。", updatedAt: "2026-09-19T12:00:00.000Z" };
assert.equal(related(saved, [saved, editedSource, older]), undefined, "current source body replaces stale saved argument");
const revised = { ...older, body: edited.body, cloudRevision: 2 };
assert.equal(related(saved, [saved, { ...older, cloudRevision: 1 }, revised]), undefined,
  "same timestamp newer revision replaces stale content");
for (const duplicates of [[older, { ...older, body: edited.body }], [{ ...older, body: edited.body }, older]]) {
  assert.equal(related(saved, [saved, ...duplicates]), undefined, "conflicting equal versions are hidden in either order");
}
assert.equal(related(saved, [saved, older, { ...older, updatedAt: "not-a-date", body: edited.body }]), undefined,
  "unorderable edited duplicate cannot revive old text");
assert.equal(related(saved, [saved, older, { ...older }]), older, "identical duplicates are harmless");
assert.equal(related(saved, [saved, older, { ...older, caseId: "synthetic-case-b", updatedAt: "2026-09-20T09:00:00.000Z" }]), older,
  "cross-notebook duplicate ID cannot replace this notebook's record");

for (const body of ["今日も母は元気でした。", "家族と病院の先生に相談して様子を確認しました。", "体調に変化なし。", "家族共有。状態安定。特記事項なし。", "月曜日。今日も元気。", "写真を追加しました。", "写真を追加しました", "  写真を追加しました！  ", "庭で話した。", ""]) {
  const generic = entry("generic-source", body, { date: saved.date, createdAt: saved.createdAt });
  assert.equal(related(generic, [generic, entry("generic-old", body)]), undefined,
    `generic/weak/photo-only body must hide: ${body}`);
}
const photo = entry("photo-source", "写真を追加しました。", {
  date: saved.date, createdAt: saved.createdAt, attachments: [{ id: "photo", name: "散歩.jpg" }]
});
assert.equal(related(photo, [photo, older]), undefined, "attachment names do not become matching text");
const specific = entry("specific-source", "デイサービスのお迎えの時間を相談した。", {
  date: saved.date, createdAt: saved.createdAt
});
assert.equal(related(specific, [specific, entry("specific-old", "デイサービスで工作をした。")])?.id,
  "specific-old", "a distinctive literal topic can connect different wording");

const followUpBody = (subject, note = "", outcome = "確認できた") => [
  "【記録のその後】", "対象：2026年9月17日の記録",
  ...(subject ? [`気がかり：${subject}`] : []), `確認状況：${outcome}`,
  ...(note ? [`自分の追記：${note}`] : [])
].join("\n");
const followUp = entry("follow-up", followUpBody("通帳の保管場所"), {
  date: saved.date, createdAt: saved.createdAt
});
assert.equal(related(followUp, [followUp, entry("different-follow-up", followUpBody("散歩の行き先"))]), undefined,
  "shared follow-up metadata/outcome never relates different concerns");
const genericFollowUp = { ...followUp, body: followUpBody("今日の様子", "家族に連絡しました。") };
assert.equal(related(genericFollowUp, [genericFollowUp, entry("generic-follow-up", genericFollowUp.body)]), undefined,
  "subject/note labels must not turn generic authored words into a match");
for (const outcome of ["確認できた", "まだ", "状況が変わった"]) {
  const legacy = { ...followUp, body: followUpBody("", "", outcome) };
  const oldLegacy = entry("legacy-follow-up", legacy.body);
  assert.equal(related(legacy, [legacy, oldLegacy]), undefined, "legacy status-only follow-up has no topic");
  assert.equal(related(followUp, [followUp, oldLegacy]), undefined, "legacy metadata is never a candidate topic");
}
const sameSubject = entry("same-subject", followUpBody("通帳の保管場所", "引き出しにあった。", "まだ"));
assert.equal(related(followUp, [followUp, sameSubject]), sameSubject,
  "a shared user-authored subject remains useful regardless of outcome");
const plainSubject = entry("plain-subject", "通帳を引き出しに保管した。");
assert.equal(related(followUp, [followUp, plainSubject]), plainSubject,
  "a follow-up subject can connect to an ordinary diary record");
const multilineNote = { ...followUp, body: followUpBody("今日の様子", "母と話した。\n通帳の保管場所を確かめた。") };
assert.equal(related(multilineNote, [multilineNote, plainSubject]), plainSubject,
  "all user-authored note lines survive boilerplate removal");
const legacyNote = { ...followUp, body: followUpBody("", "通帳の保管場所を確かめた。") };
assert.equal(related(legacyNote, [legacyNote, plainSubject]), plainSubject,
  "a legacy follow-up with a meaningful authored note can still match");

const earlierSameDay = entry("earlier-same-day", older.body, {
  date: saved.date, createdAt: "2026-09-19T08:00:00.000Z", updatedAt: "2026-09-20T12:00:00.000Z"
});
assert.equal(related(saved, [saved, earlierSameDay]), earlierSameDay, "same diary date uses creation, not update time");
for (const createdAt of [saved.createdAt, "2026-09-19T10:00:00.000Z"]) {
  assert.equal(related(saved, [saved, { ...earlierSameDay, createdAt }]), undefined,
    "same-day simultaneous/later creation must not count as older");
}
assert.equal(related(saved, [saved, { ...older, date: "2026-09-20", createdAt: "2026-09-17T09:00:00.000Z" }]), undefined,
  "future diary date is not older even when written earlier");
const backdated = { ...saved, date: "2026-09-10" };
assert.equal(related(backdated, [backdated, older]), undefined, "a backdated source excludes chronologically newer diary dates");
const lateWrittenOldDate = { ...older, date: "2026-09-09", createdAt: "2026-09-19T12:00:00.000Z" };
assert.equal(related(backdated, [backdated, lateWrittenOldDate]), lateWrittenOldDate,
  "an earlier diary date remains eligible when entered later");
for (const date of ["bad", "2026-02-30", "2026-9-18", "2026-13-01"]) {
  assert.equal(related(saved, [saved, { ...older, date }]), undefined, "invalid candidate diary dates hide");
  const invalidSource = { ...saved, date };
  assert.equal(related(invalidSource, [invalidSource, older]), undefined, "invalid source diary dates hide");
}
for (const createdAt of ["bad", "2026-02-30T09:00:00.000Z", "2026-09-19", "2026-09-19T25:00:00Z"]) {
  assert.equal(related(saved, [saved, { ...older, createdAt }]), undefined, "invalid candidate creation hides");
  const invalidSource = { ...saved, createdAt };
  assert.equal(related(invalidSource, [invalidSource, older]), undefined, "invalid source creation hides");
}

const weakerRecent = entry("weaker-recent", "散歩に出かけた。", { date: "2026-09-18" });
const strongerOld = entry("stronger-old", "公園で散歩をした。", { date: "2026-09-17" });
assert.equal(related(saved, [saved, weakerRecent, strongerOld]), strongerOld, "relevance precedes recency");
const equallyRelevantRecent = { ...strongerOld, id: "equally-relevant-recent", date: "2026-09-18" };
assert.equal(related(saved, [saved, strongerOld, equallyRelevantRecent]), equallyRelevantRecent,
  "equal relevance prefers most recent diary date");
const sameDateLater = { ...equallyRelevantRecent, id: "same-date-later", createdAt: "2026-09-18T10:00:00.000Z" };
assert.equal(related(saved, [saved, equallyRelevantRecent, sameDateLater]), sameDateLater,
  "equal relevance and date prefer latest creation");
const tiedA = { ...older, id: "a" };
const tiedB = { ...older, id: "b" };
assert.equal(related(saved, [saved, tiedB, tiedA]), tiedA, "final ID tie break is deterministic");
assert.equal(related(saved, [tiedA, saved, tiedB]), tiedA);
const snapshot = JSON.stringify([saved, older]);
related(Object.freeze(saved), Object.freeze([saved, Object.freeze(older)]));
assert.equal(JSON.stringify([saved, older]), snapshot, "matching never mutates records");
assert.doesNotMatch(source, /fetch\s*\(|localStorage|sessionStorage|supabase|anthropic|openai/i,
  "helper has no network/model/storage dependencies");
console.log("diary continuity: ok (current versions, same case, chronology, conservative matching; synthetic only)");
