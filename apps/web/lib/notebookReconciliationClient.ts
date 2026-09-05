import type { CaseRecord, DiaryEntry } from "./store";
import { notebookReconciliationFingerprint, type NotebookSnapshot } from "./notebookReconciliation";

export async function readReconciliationCloudNotebook(input: {
  token: string;
  familyId: string;
  assertCurrent: () => void;
  request?: typeof fetch;
}): Promise<NotebookSnapshot & { memberRole: string }> {
  const request = input.request ?? fetch;
  const entries = new Map<string, DiaryEntry>();
  let firstCases: CaseRecord[] | null = null;
  let total: number | null = null;
  let role = "";
  let offset = 0;
  do {
    input.assertCurrent();
    const params = new URLSearchParams({ familyId: input.familyId, diaryOffset: String(offset), diaryLimit: "500" });
    const response = await request(`/api/notebook/sync?${params}`, { headers: { Authorization: `Bearer ${input.token}` } });
    input.assertCurrent();
    const result = await response.json();
    input.assertCurrent();
    if (!response.ok || result.familyId !== input.familyId || !Array.isArray(result.cases)
        || !Array.isArray(result.diaryEntries) || !Number.isInteger(result.diaryEntriesTotal)
        || result.diaryEntriesTotal < 0 || result.diaryEntriesTotal > 20_000
        || result.diaryEntriesOffset !== offset || !["owner", "admin", "member"].includes(result.memberRole)) {
      throw new Error("保存先・編集権限・記録件数を確認できません。何も変更せずに止めました。");
    }
    if (firstCases && (total !== result.diaryEntriesTotal || role !== result.memberRole
        || notebookReconciliationFingerprint({ cases: firstCases, diaryEntries: [] })
          !== notebookReconciliationFingerprint({ cases: result.cases, diaryEntries: [] }))) {
      throw new Error("確認中にクラウドの手帳が変わりました。もう一度、両方の記録を確認してください。");
    }
    firstCases ??= result.cases;
    total = result.diaryEntriesTotal;
    role = result.memberRole;
    for (const entry of result.diaryEntries as DiaryEntry[]) {
      if (!entry.id || entries.has(entry.id)) throw new Error("クラウドの記録を重複なく読めませんでした。");
      entries.set(entry.id, entry);
    }
    if (result.diaryEntriesHasMore !== true) break;
    if (!result.diaryEntries.length || entries.size >= total!) throw new Error("クラウドの記録を最後まで読めませんでした。");
    offset += result.diaryEntries.length;
  } while (true);
  if (entries.size !== total) throw new Error("クラウドの記録件数が一致しません。端末の記録は変えていません。");
  return { cases: firstCases ?? [], diaryEntries: [...entries.values()], memberRole: role };
}
