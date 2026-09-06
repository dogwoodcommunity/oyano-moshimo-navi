export const UNSAVED_DIARY_WARNING = "まだ保存されていません。保存する前に画面を閉じたり再読み込みすると、入力内容が消えることがあります。";

type NewDiaryInput = { body: string; files: readonly unknown[] };
type DiaryEditValues = { date: string; mood: string; body: string };

export function hasUnsavedNewDiaryInput(form?: NewDiaryInput): boolean {
  return Boolean(form && (form.body.length > 0 || form.files.length > 0));
}

export function hasUnsavedDiaryEdit(form?: DiaryEditValues, original?: DiaryEditValues): boolean {
  return Boolean(form && original && (
    form.date !== original.date || form.mood !== original.mood || form.body !== original.body
  ));
}
