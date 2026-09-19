import type { DiaryEntry } from "./store";

export type DiaryFollowUpOutcome = "confirmed" | "pending" | "changed";

export type DiaryFollowUpDraft = {
  entryId: string;
  sourceVersion: string;
  scopeKey: string;
  date: string;
  subject: string;
  mood: DiaryEntry["mood"] | null;
  outcome: DiaryFollowUpOutcome | null;
  note: string;
};

export const DIARY_FOLLOW_UP_OUTCOMES: ReadonlyArray<{
  value: DiaryFollowUpOutcome;
  label: string;
}> = [
  { value: "confirmed", label: "確認できた" },
  { value: "pending", label: "まだ" },
  { value: "changed", label: "状況が変わった" }
];

export function diaryFollowUpSourceVersion(entry: DiaryEntry): string {
  return JSON.stringify({
    id: entry.id,
    caseId: entry.caseId,
    date: entry.date,
    body: entry.body,
    updatedAt: entry.updatedAt ?? null,
    createdAt: entry.createdAt
  });
}

export function hasUnsavedDiaryFollowUp(draft?: DiaryFollowUpDraft | null): boolean {
  return Boolean(draft && (
    draft.subject.length > 0 || draft.note.length > 0 || draft.outcome !== null || draft.mood !== null
  ));
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function buildDiaryFollowUpBody(source: DiaryEntry, draft: DiaryFollowUpDraft): string {
  if (source.id !== draft.entryId || diaryFollowUpSourceVersion(source) !== draft.sourceVersion) {
    throw new Error("元の記録が変わりました。最新の内容を確認してから保存してください。");
  }
  const outcome = DIARY_FOLLOW_UP_OUTCOMES.find((item) => item.value === draft.outcome);
  if (!outcome) throw new Error("その後の確認状況を選んでください。");
  const subject = draft.subject.trim();
  if (!subject || Array.from(subject).length > 80) {
    throw new Error("何についての確認か、80文字以内で入力してください。");
  }
  if (draft.mood !== "stable" && draft.mood !== "changed" && draft.mood !== "urgent") {
    throw new Error("記録の種類を選んでください。");
  }
  if (!isValidDate(draft.date) || !isValidDate(source.date)) {
    throw new Error("記録の日付を確認してください。");
  }

  const [year, month, day] = source.date.split("-").map(Number);
  const lines = [
    "【記録のその後】",
    `気がかり：${subject}`,
    `対象：${year}年${month}月${day}日の記録`,
    `確認状況：${outcome.label}`
  ];
  const note = draft.note.trim();
  if (note) lines.push(`自分の追記：${note}`);
  return lines.join("\n");
}
