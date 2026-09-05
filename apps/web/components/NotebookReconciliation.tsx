"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import {
  archiveNotebookForReconciliation, exportNotebookData, installReconciledNotebook,
  isDiaryEntryCloudSyncBlocked, isPersonNotebookCloudSyncBlocked,
  readNotebookCloudBinding, readNotebookReconciliationArchive,
  type NotebookExport
} from "@/lib/store";
import { notebookReconciliationFingerprint, planNotebookReconciliation, type NotebookSnapshot } from "@/lib/notebookReconciliation";
import { readReconciliationCloudNotebook } from "@/lib/notebookReconciliationClient";

type CloudNotebook = Awaited<ReturnType<typeof readReconciliationCloudNotebook>>;
type Preview = {
  local: NotebookExport;
  remote: CloudNotebook;
  plan: Awaited<ReturnType<typeof planNotebookReconciliation>>;
};
type Props = {
  userId: string | null;
  email: string | null;
  familyId: string | null;
  eligible: boolean;
  unavailable: boolean;
  onBusy: (busy: boolean) => void;
  onOpenLocal?: () => void;
  onComplete: (notebook: CloudNotebook) => void;
};

function assertNoDeletion(snapshot: NotebookSnapshot) {
  if (snapshot.cases.some((item) => isPersonNotebookCloudSyncBlocked(item.id))
      || snapshot.diaryEntries.some((item) => isDiaryEntryCloudSyncBlocked(item.caseId, item.id))) {
    throw new Error("削除確認中の記録があるため、まとめずに止めました。");
  }
}

function downloadSource(source: NotebookExport) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(source, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "oyano-moshimo-before-reconciliation.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function NotebookReconciliation(props: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [choice, setChoice] = useState<"same" | "different" | "">("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [hasArchive, setHasArchive] = useState(false);
  const current = useRef(props);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  current.current = props;

  useEffect(() => {
    mounted.current = true;
    const subscription = getBrowserSupabase()?.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== current.current.userId) generation.current += 1;
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setPreview(null);
    setChoice("");
    setAcknowledged(false);
    setMessage("");
    setBlocked(false);
    const archive = readNotebookReconciliationArchive();
    setHasArchive(Boolean(archive && archive.destination.authUserId === props.userId
      && archive.destination.familyId === props.familyId));
  }, [props.userId, props.familyId]);

  async function act(submit: boolean) {
    if (inFlight.current || !props.userId || !props.familyId || !props.eligible || props.unavailable) return;
    if (submit && (!preview || choice !== "same" || !acknowledged)) return;
    inFlight.current = true;
    setBlocked(false);
    setBusy(true);
    props.onBusy(true);
    setMessage(submit ? "端末の控えを残し、記録を追加しています。" : "両方の手帳を確認しています。まだ変更しません。");
    const userId = props.userId;
    const familyId = props.familyId;
    const operationGeneration = generation.current;
    const assertCurrent = () => {
      if (!mounted.current || operationGeneration !== generation.current || current.current.unavailable
          || current.current.userId !== userId || current.current.familyId !== familyId || !current.current.eligible) {
        throw new Error("確認中に保存先が変わりました。元の記録はそのまま残しています。");
      }
    };
    try {
      const client = getBrowserSupabase();
      const verifySession = async () => {
        const session = client ? (await client.auth.getSession()).data.session : null;
        assertCurrent();
        if (!session || session.user.id !== userId) throw new Error("メールの本人確認をやり直してください。");
        return session;
      };
      const session = await verifySession();
      const local = exportNotebookData();
      assertNoDeletion(local);
      const remote = await readReconciliationCloudNotebook({ token: session.access_token, familyId, assertCurrent });
      assertNoDeletion(remote);
      const plan = await planNotebookReconciliation({ local, remote, userId, familyId, memberRole: remote.memberRole, binding: readNotebookCloudBinding() });
      assertCurrent();
      if (!submit) {
        setPreview({ local, remote, plan });
        setChoice("");
        setAcknowledged(false);
        setMessage("内容を確認し、同じ人の手帳かどうか選んでください。");
        return;
      }
      if (!preview || notebookReconciliationFingerprint(local) !== notebookReconciliationFingerprint(preview.local)
          || notebookReconciliationFingerprint(remote) !== notebookReconciliationFingerprint(preview.remote)) {
        setPreview(null);
        throw new Error("確認後に記録が変わりました。もう一度「両方の記録を確認する」から確認してください。");
      }
      const destination = { version: 1 as const, authUserId: userId, familyId, ...(props.email ? { email: props.email } : {}) };
      if (!archiveNotebookForReconciliation(local, destination)) {
        throw new Error("端末の控えを安全に保存できないため、クラウドへは送っていません。空き容量を確認してください。");
      }
      setHasArchive(true);
      assertCurrent();
      if (plan.addedCount > 0) {
        const sendingSession = await verifySession();
        if (notebookReconciliationFingerprint(exportNotebookData()) !== notebookReconciliationFingerprint(local)) {
          throw new Error("端末の記録が変わったため、追加せずに止めました。両方の記録を確認し直してください。");
        }
        const response = await fetch("/api/notebook/reconcile", {
          method: "POST",
          headers: { Authorization: `Bearer ${sendingSession.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            familyId, personId: plan.targetCase.cloudPersonId, targetCaseId: plan.targetCase.id,
            sourceCaseId: plan.sourceCase.id, samePersonConfirmed: true,
            diaryEntries: local.diaryEntries.map((entry) => ({
              id: entry.id, caseId: entry.caseId, date: entry.date, body: entry.body, mood: entry.mood,
              attachments: [], createdAt: entry.createdAt, updatedAt: entry.updatedAt ?? entry.createdAt
            }))
          })
        });
        const result = await response.json().catch(() => ({}));
        assertCurrent();
        if (!response.ok || result.ok !== true || result.familyId !== familyId
            || result.personId !== plan.targetCase.cloudPersonId || result.targetCaseId !== plan.targetCase.id) {
          throw new Error("追加の完了を確認できません。端末の原本と控えは残っています。再確認しても同じ記録は重複追加しません。");
        }
      }
      const saved = await readReconciliationCloudNotebook({ token: session.access_token, familyId, assertCurrent });
      const verified = await planNotebookReconciliation({ local, remote: saved, userId, familyId, memberRole: saved.memberRole, binding: readNotebookCloudBinding() });
      assertCurrent();
      assertNoDeletion(saved);
      if (verified.targetCase.id !== plan.targetCase.id || verified.targetCase.cloudPersonId !== plan.targetCase.cloudPersonId
          || verified.alreadyPresentCount !== local.diaryEntries.length
          || remote.diaryEntries.some((entry) => !saved.diaryEntries.some((item) => item.id === entry.id))) {
        throw new Error("両方の記録が残ったことを確認できません。端末の原本は切り替えていません。");
      }
      await verifySession();
      assertNoDeletion(local);
      if (!installReconciledNotebook({ source: local, destination, notebook: saved })) {
        throw new Error("クラウドへの追加は確認できましたが、端末の切り替えが止まりました。元の手帳は控えに残っています。もう一度確認してください。");
      }
      setPreview(null);
      setMessage(`両方の日記を残しました。クラウドの手帳に${saved.diaryEntries.length}件あります。まとめる前の基本情報・確認リストは端末の控えに残しています。`);
      props.onComplete(saved);
    } catch (error) {
      if (mounted.current && operationGeneration === generation.current) {
        setBlocked(true);
        setMessage(error instanceof Error ? error.message : "まとめる処理を停止しました。元の記録は控えに残しています。");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        current.current.onBusy(false);
      }
    }
  }

  async function downloadCheckedSource(fromArchive: boolean) {
    if (inFlight.current || !props.userId || !props.familyId) return;
    const userId = props.userId;
    const familyId = props.familyId;
    const operationGeneration = generation.current;
    try {
      const client = getBrowserSupabase();
      const session = client ? (await client.auth.getSession()).data.session : null;
      if (!mounted.current || operationGeneration !== generation.current
          || current.current.userId !== userId || current.current.familyId !== familyId
          || session?.user.id !== userId) throw new Error("保存先が変わったため、ダウンロードを止めました。");
      if (fromArchive) {
        const archive = readNotebookReconciliationArchive();
        if (!archive || archive.destination.authUserId !== userId || archive.destination.familyId !== familyId) {
          throw new Error("控えを確認できません。削除中・削除済みの内容はダウンロードしません。");
        }
        assertNoDeletion(archive.source);
        downloadSource(archive.source);
      } else {
        if (!preview || !current.current.eligible || current.current.unavailable
            || notebookReconciliationFingerprint(exportNotebookData()) !== notebookReconciliationFingerprint(preview.local)) {
          throw new Error("記録が変わりました。両方の記録を確認し直してください。");
        }
        assertNoDeletion(preview.local);
        assertNoDeletion(preview.remote);
        downloadSource(preview.local);
      }
    } catch (error) {
      if (mounted.current && operationGeneration === generation.current) {
        if (!fromArchive) setPreview(null);
        setMessage(error instanceof Error ? error.message : "控えを確認できないため、ダウンロードを止めました。");
      }
    }
  }

  return <section className="notebook-reconciliation" aria-label="別々の手帳の記録を確認する" hidden={!props.eligible && !hasArchive && !message}>
    {props.eligible ? <>
      <h3>同じ人の手帳を別々に作りましたか？</h3>
      <p>同じ人なら、端末の日記をクラウドの手帳へ追加できます。既存の日記は上書きしません。</p>
      <button type="button" disabled={busy || props.unavailable} onClick={() => void act(false)}>両方の記録を確認する</button>
      {props.unavailable && !busy ? <p>編集中・未保存の入力を先に保存するか閉じてから、確認してください。</p> : null}
    </> : null}
    {preview && props.eligible ? <>
      <div className="notebook-reconciliation-compare">
        {([{ label: "この端末", notebook: preview.local }, { label: "クラウド", notebook: preview.remote }] as const).map(({ label, notebook }) => <div key={label}>
          <h4>{label}：{notebook.cases[0].personProfile?.displayName || "呼び名未設定"}（日記{notebook.diaryEntries.length}件）</h4>
          <ul>{notebook.diaryEntries.map((entry) => <li key={entry.id}><strong>{entry.date}</strong><p>{entry.body}</p></li>)}</ul>
        </div>)}
      </div>
      <fieldset disabled={busy}>
        <legend>この2つは同じ人の手帳ですか？（1つ選択）</legend>
        <label><input type="radio" name="reconciliation-person" checked={choice === "same"} onChange={() => setChoice("same")} />同じ人の手帳です</label>
        <label><input type="radio" name="reconciliation-person" checked={choice === "different"} onChange={() => setChoice("different")} />別の人・わからない（まとめません）</label>
        {choice === "same" ? <label><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />日記だけを追加します。基本情報・確認リストはクラウド側を使い、端末側の内容は控えに残ることを確認しました。</label> : null}
      </fieldset>
      <p>追加予定：{preview.plan.addedCount}件{preview.plan.alreadyPresentCount ? `（追加済み${preview.plan.alreadyPresentCount}件は重複させません）` : ""}</p>
      <div className="cloud-action-row">
        <button type="button" disabled={busy || choice !== "same" || !acknowledged || props.unavailable} onClick={() => void act(true)}>日記を1冊にまとめる</button>
        <button type="button" disabled={busy} onClick={() => setPreview(null)}>変更せず閉じる</button>
        <button type="button" disabled={busy} onClick={() => void downloadCheckedSource(false)}>端末の控えをダウンロード</button>
      </div>
    </> : null}
    {message ? <p role="status">{message}</p> : null}
    {blocked && props.eligible ? <div className="cloud-action-row">
      {props.onOpenLocal ? <button type="button" disabled={busy || props.unavailable} onClick={props.onOpenLocal}>端末の記録を開く</button> : null}
      <a href="/legal/privacy#contact">お問い合わせ</a>
    </div> : null}
    {hasArchive ? <button type="button" disabled={busy} onClick={() => void downloadCheckedSource(true)}>まとめる前の端末手帳をダウンロード</button> : null}
  </section>;
}
