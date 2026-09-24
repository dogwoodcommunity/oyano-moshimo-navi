import { getBrowserSupabase } from "./browserSupabase";
import {
  applyNotebookCloudRevisions, createLocalId, isDiaryEntryCloudSyncBlocked,
  isPersonNotebookCloudSyncBlocked, listDiaryEntries, listLocalCases,
  readNotebookCloudBinding, writeNotebookCloudBinding, type CaseRecord
} from "./store";

const identityError = "保存先を安全に確認できませんでした。元のログイン状態で手帳を開いてください。別の保存先には送信しません。";

/** Called only from an explicit consent/send action, never on mount. */
export async function prepareConsultNotebook(input: {
  caseId: string;
  allowCreate: boolean;
  captchaToken?: string;
  assertCurrent: () => void;
}): Promise<{ caseRecord: CaseRecord; guest: boolean; authUserId: string; assertIdentity: () => Promise<void> }> {
  const client = getBrowserSupabase();
  if (!client) throw new Error("相談の保存先に接続できません。時間をおいてお試しください。");
  input.assertCurrent();
  const initialBinding = readNotebookCloudBinding();
  let session = (await client.auth.getSession()).data.session;
  input.assertCurrent();
  if (!session) {
    // Never turn an expired existing account into a new guest notebook.
    if (initialBinding || listLocalCases().some((item) => item.cloudPersonId)) throw new Error(identityError);
    if (!input.allowCreate || !input.captchaToken) throw new Error("安全確認が終わってから、もう一度相談してください。");
    const response = await fetch("/api/consult/guest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captchaToken: input.captchaToken })
    });
    const result = await response.json();
    input.assertCurrent();
    // Another tab may have signed in while the guest request was in flight.
    if ((await client.auth.getSession()).data.session || readNotebookCloudBinding()) throw new Error(identityError);
    if (!response.ok || typeof result.access_token !== "string" || typeof result.refresh_token !== "string") {
      throw new Error(typeof result.message === "string" ? result.message : "相談の準備ができませんでした。少し待ってからお試しください。");
    }
    const installed = await client.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
    if (installed.error || !installed.data.session) throw new Error("このブラウザに保存先を保持できませんでした。");
    session = installed.data.session;
  }
  const userId = session.user.id;
  let expectedBinding = initialBinding;
  const assertIdentity = async () => {
    input.assertCurrent();
    const current = (await client.auth.getSession()).data.session;
    input.assertCurrent();
    if (current?.user.id !== userId || JSON.stringify(readNotebookCloudBinding()) !== JSON.stringify(expectedBinding)) throw new Error(identityError);
  };
  await assertIdentity();
  if (initialBinding && initialBinding.authUserId !== userId) throw new Error(identityError);
  const readSnapshot = () => {
    const caseRecord = listLocalCases().find((item) => item.id === input.caseId);
    if (!caseRecord || isPersonNotebookCloudSyncBlocked(input.caseId)) throw new Error("この手帳は削除中、または見つかりません。別の人には送信しません。");
    const entries = listDiaryEntries(input.caseId);
    if (entries.some((entry) => isDiaryEntryCloudSyncBlocked(input.caseId, entry.id))) throw new Error("記録の削除が完了してから、もう一度相談してください。");
    return { cases: [caseRecord], diaryEntries: entries };
  };
  const fingerprint = (snapshot: ReturnType<typeof readSnapshot>) => JSON.stringify(snapshot, (key, value) =>
    ["cloudRevision", "cloudHash", "cloudSyncedUpdatedAt", "cloudPersonId"].includes(key) ? undefined : value);
  const original = fingerprint(readSnapshot());
  let expectedPersonId = readSnapshot().cases[0].cloudPersonId;
  const assertNotebook = () => {
    input.assertCurrent();
    const current = readSnapshot();
    if (current.cases[0].cloudPersonId !== expectedPersonId || fingerprint(current) !== original) throw new Error("準備中に記録が変わりました。最新の内容で、もう一度相談してください。");
  };
  const headers = { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
  const params = new URLSearchParams({ diaryLimit: "1" });
  if (initialBinding?.familyId) params.set("familyId", initialBinding.familyId);
  const check = await fetch(`/api/notebook/sync?${params}`, { headers, cache: "no-store" });
  const remote = await check.json();
  await assertIdentity();
  assertNotebook();
  if (!check.ok || remote.authUserId !== userId || !Array.isArray(remote.cases)) throw new Error(identityError);
  let familyId: string | null = typeof remote.familyId === "string" ? remote.familyId : null;
  if (initialBinding?.familyId && initialBinding.familyId !== familyId) throw new Error(identityError);
  if (familyId && !["owner", "admin", "member"].includes(remote.memberRole)) throw new Error("この手帳は閲覧専用です。編集できるご家族に相談してください。");
  if (!initialBinding) {
    // Do not silently combine an existing cloud notebook with unrelated local data.
    if (!input.allowCreate || remote.cases.length || remote.diaryEntriesTotal !== 0
      || listLocalCases().some((item) => item.cloudPersonId)) throw new Error(identityError);
  }
  if (initialBinding?.caseIds && !initialBinding.caseIds.includes(input.caseId) && !input.allowCreate) throw new Error("この人の手帳の保存に、先に同意してください。");
  const caseIds = !initialBinding ? [input.caseId] : initialBinding.caseIds
    ? [...new Set([...initialBinding.caseIds, input.caseId])] : undefined;
  expectedBinding = { version: 1, authUserId: userId, familyId, ...(caseIds ? { caseIds } : {}), ...(session.user.email ? { email: session.user.email } : {}) };
  if (!writeNotebookCloudBinding(expectedBinding)) throw new Error("保存先をこのブラウザに保持できませんでした。記録は送信していません。");
  const total = readSnapshot().diaryEntries.length;
  for (let offset = 0; offset < Math.max(total, 1); offset += 500) {
    await assertIdentity();
    assertNotebook();
    const snapshot = readSnapshot();
    const diaryEntries = snapshot.diaryEntries.slice(offset, offset + 500);
    const response = await fetch("/api/notebook/sync", {
      method: "POST", headers,
      body: JSON.stringify({
        familyId, createFamily: familyId === null, requestId: createLocalId("consult-sync"),
        cases: snapshot.cases,
        diaryEntries: diaryEntries.map((entry) => ({ ...entry, attachments: entry.attachments.map((attachment) => {
          // Keep photo bytes local. Only existing cloud references are synced here.
          const { previewUrl: _previewUrl, ...metadata } = attachment;
          return metadata;
        }) }))
      })
    });
    const result = await response.json();
    await assertIdentity();
    assertNotebook();
    if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "記録を保存できなかったため、AIへは送っていません。もう一度お試しください。");
    if (typeof result.familyId !== "string" || (familyId && familyId !== result.familyId)
      || !Array.isArray(result.caseRevisions) || !result.caseRevisions.some((item: { localCaseId?: string; personId?: string }) => item.localCaseId === input.caseId && item.personId)) throw new Error(identityError);
    const resolvedPersonId = result.caseRevisions.find((item: { localCaseId?: string }) => item.localCaseId === input.caseId).personId as string;
    if (expectedPersonId && expectedPersonId !== resolvedPersonId) throw new Error(identityError);
    familyId = result.familyId;
    expectedBinding = { ...expectedBinding, familyId };
    if (!writeNotebookCloudBinding(expectedBinding)) throw new Error("クラウドへの保存は済みましたが、このブラウザに保存先を保持できませんでした。相談は送信していません。");
    const applied = applyNotebookCloudRevisions({
      caseRevisions: result.caseRevisions, taskRevisions: result.taskRevisions ?? [], diaryRevisions: result.diaryRevisions ?? []
    }, { cases: snapshot.cases, diaryEntries });
    if (!applied.persisted || applied.rejectedProfileCaseIds.includes(input.caseId)) throw new Error("保存内容を最後まで確認できませんでした。手帳を開いて保存状態を確認してください。");
    expectedPersonId = resolvedPersonId;
  }
  await assertIdentity();
  assertNotebook();
  return {
    caseRecord: readSnapshot().cases[0], guest: session.user.is_anonymous === true, authUserId: userId,
    assertIdentity: async () => { await assertIdentity(); assertNotebook(); }
  };
}
