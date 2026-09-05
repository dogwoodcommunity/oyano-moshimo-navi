import type { CaseRecord, DiaryEntry, NotebookCloudBinding } from "./store";

export type NotebookSnapshot = { cases: CaseRecord[]; diaryEntries: DiaryEntry[] };
export type NotebookReconciliationInput = {
  local: NotebookSnapshot;
  remote: NotebookSnapshot;
  userId: string;
  familyId: string;
  memberRole: string;
  binding: NotebookCloudBinding | null;
};

// Stable across retries, including a lost successful HTTP response. Never reuse
// a source ID on the destination: two independently created diaries may collide.
export async function reconciledDiaryId(sourceCaseId: string, sourceDiaryId: string) {
  const bytes = new TextEncoder().encode(JSON.stringify([sourceCaseId, sourceDiaryId]));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `reconciled_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function notebookReconciliationFingerprint(snapshot: NotebookSnapshot) {
  // Signed preview URLs can rotate without changing the actual notebook.
  return JSON.stringify({ cases: snapshot.cases, diaryEntries: snapshot.diaryEntries }, (key, value) => key === "previewUrl" ? undefined : value);
}

function hasCloudIdentity(value: { cloudRevision?: number; cloudHash?: string; cloudSyncedUpdatedAt?: string }) {
  return value.cloudRevision !== undefined || value.cloudHash !== undefined || value.cloudSyncedUpdatedAt !== undefined;
}

export function reconciliationDiaryMatches(left: DiaryEntry, right: DiaryEntry) {
  return left.id === right.id && left.caseId === right.caseId
    && left.date === right.date && left.body === right.body && left.mood === right.mood
    && left.attachments.length === 0 && right.attachments.length === 0
    && Date.parse(left.createdAt) === Date.parse(right.createdAt)
    && Date.parse(left.updatedAt ?? left.createdAt) === Date.parse(right.updatedAt ?? right.createdAt);
}

export async function planNotebookReconciliation(input: NotebookReconciliationInput) {
  const { local, remote, userId, familyId, memberRole, binding } = input;
  if (!userId || !familyId || !["owner", "admin", "member"].includes(memberRole)) {
    throw new Error("保存先を確認できる、編集権限のあるアカウントで開いてください。");
  }
  if (binding && (binding.authUserId !== userId || (binding.familyId && binding.familyId !== familyId))) {
    throw new Error("別のアカウント・家族に紐づいた手帳はまとめられません。");
  }
  if (local.cases.length !== 1 || remote.cases.length !== 1) {
    throw new Error("端末とクラウドにそれぞれ1人分の手帳がある場合だけ、記録をまとめられます。");
  }
  const sourceCase = local.cases[0];
  const targetCase = remote.cases[0];
  if (!sourceCase.id || !targetCase.id || sourceCase.id === targetCase.id || !targetCase.cloudPersonId) {
    throw new Error("まとめ先の手帳を確認できません。クラウドを読み直してください。");
  }
  if (sourceCase.cloudPersonId || hasCloudIdentity(sourceCase)) {
    throw new Error("すでにクラウドと紐づいた端末の手帳は、この操作ではまとめられません。");
  }
  if (local.diaryEntries.length === 0 || local.diaryEntries.length > 100) {
    throw new Error("まとめられる端末の日記は1〜100件です。端末の控えはそのまま残ります。");
  }
  if (new Set(local.diaryEntries.map((entry) => entry.id)).size !== local.diaryEntries.length
      || new Set(remote.diaryEntries.map((entry) => entry.id)).size !== remote.diaryEntries.length
      || remote.diaryEntries.some((entry) => entry.caseId !== targetCase.id)) {
    throw new Error("記録の所属・重複を確認できないため、まとめずに止めました。");
  }
  const remoteById = new Map(remote.diaryEntries.map((entry) => [entry.id, entry]));
  const copies: DiaryEntry[] = [];
  let alreadyPresentCount = 0;
  for (const entry of local.diaryEntries) {
    if (!entry.id || entry.id.length > 200 || sourceCase.id.length > 200 || entry.caseId !== sourceCase.id
        || hasCloudIdentity(entry) || !entry.body.trim() || entry.body.length > 10_000
        || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
        || !Number.isFinite(Date.parse(`${entry.date}T00:00:00.000Z`))
        || new Date(`${entry.date}T00:00:00.000Z`).toISOString().slice(0, 10) !== entry.date
        || !Number.isFinite(Date.parse(entry.createdAt))
        || !Number.isFinite(Date.parse(entry.updatedAt ?? entry.createdAt))) {
      throw new Error("端末の記録を安全に追加できないため、内容は変えずに止めました。");
    }
    if (!Array.isArray(entry.attachments) || entry.attachments.length > 0) {
      throw new Error("写真付きの日記はまだまとめられません。写真を消さず、端末の手帳を残してください。");
    }
    const copy: DiaryEntry = {
      id: await reconciledDiaryId(sourceCase.id, entry.id),
      caseId: targetCase.id,
      date: entry.date,
      body: entry.body,
      mood: entry.mood,
      attachments: [],
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt ?? entry.createdAt
    };
    const existing = remoteById.get(copy.id);
    if (existing) {
      if (!reconciliationDiaryMatches(copy, existing)) {
        throw new Error("以前まとめた記録が変更されています。上書きせずに止めました。");
      }
      alreadyPresentCount += 1;
    }
    copies.push(copy);
  }
  return { sourceCase, targetCase, copies, alreadyPresentCount, addedCount: copies.length - alreadyPresentCount };
}
