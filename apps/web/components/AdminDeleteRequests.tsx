"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminDeleteRequestRow } from "@/app/api/admin/delete-requests/route";
import { adminBearerHeaders } from "@/lib/adminClientAuth";

function hasPendingAuthCallback() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  return Boolean(
    url.searchParams.get("code")
    || url.searchParams.get("error")
    || url.searchParams.get("error_code")
    || url.searchParams.get("error_description")
    || hashParams.get("access_token")
    || hashParams.get("refresh_token")
    || hashParams.get("error")
    || hashParams.get("error_code")
    || hashParams.get("error_description")
  );
}

function isLivePreparedJob(job: AdminDeleteRequestRow["erasureJob"]) {
  return Boolean(
    job?.status === "prepared"
    && job.preparedExpiresAt
    && new Date(job.preparedExpiresAt).getTime() > Date.now()
  );
}

export function AdminDeleteRequests() {
  const loadRequestId = useRef(0);
  const [deleteRequests, setDeleteRequests] = useState<AdminDeleteRequestRow[] | null>(null);
  const [operatorMethod, setOperatorMethod] = useState<
    "supabase_app_admin" | "supabase_account_delete_executor" | null
  >(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [erasureUserIds, setErasureUserIds] = useState<Record<string, string>>({});
  const [erasurePreparePhrases, setErasurePreparePhrases] = useState<Record<string, string>>({});
  const [erasurePhrases, setErasurePhrases] = useState<Record<string, string>>({});
  const [approvalJobIds, setApprovalJobIds] = useState<Record<string, string>>({});
  const [approvalManifestHashes, setApprovalManifestHashes] = useState<Record<string, string>>({});
  const [approvalPhrases, setApprovalPhrases] = useState<Record<string, string>>({});
  const [erasureChecks, setErasureChecks] = useState<Record<string, {
    ready: boolean;
    prepared: boolean;
    executionEnabled: boolean;
    grantReady: boolean;
    requiresAal2: boolean;
    message: string;
    jobId?: string;
    manifestHash?: string;
    preparedExpiresAt?: string;
    grantExpiresAt?: string;
    storageObjectCount?: number;
    storagePrefixCount?: number;
  }>>({});

  function loadDeleteRequests() {
    const requestId = ++loadRequestId.current;
    fetch("/api/admin/delete-requests", { headers: adminBearerHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "削除担当者としてログインしてください。" : "削除依頼を取得できませんでした。");
        return response.json();
      })
      .then((body: {
        deleteRequests?: AdminDeleteRequestRow[];
        operatorMethod?: "supabase_app_admin" | "supabase_account_delete_executor";
      }) => {
        if (requestId !== loadRequestId.current) return;
        setError("");
        setDeleteRequests(body.deleteRequests ?? []);
        setOperatorMethod(body.operatorMethod ?? null);
      })
      .catch((err: Error) => {
        if (requestId !== loadRequestId.current) return;
        setError(err.message);
        setDeleteRequests([]);
        setOperatorMethod(null);
      });
  }

  useEffect(() => {
    // Do not render data from a previous operator while a new or failed
    // Supabase callback is still being validated by AdminTokenControl.
    if (!hasPendingAuthCallback()) loadDeleteRequests();
    const reloadAfterAuthChange = () => {
      // Authentication changes invalidate PII, preflight decisions, and exact
      // confirmations from the previous operator/session immediately.
      loadRequestId.current += 1;
      setDeleteRequests(null);
      setOperatorMethod(null);
      setError("");
      setNotes({});
      setErasureUserIds({});
      setErasurePreparePhrases({});
      setErasurePhrases({});
      setApprovalJobIds({});
      setApprovalManifestHashes({});
      setApprovalPhrases({});
      setErasureChecks({});
      setUpdatingId(null);
      loadDeleteRequests();
    };
    window.addEventListener("admin-auth-changed", reloadAfterAuthChange);
    return () => {
      loadRequestId.current += 1;
      window.removeEventListener("admin-auth-changed", reloadAfterAuthChange);
    };
  }, []);

  const rows = deleteRequests ?? [];

  async function updateStatus(id: string, status: AdminDeleteRequestRow["status"]) {
    const note = notes[id]?.trim() ?? "";

    setUpdatingId(id);
    setError("");
    const response = await fetch("/api/admin/delete-requests", {
      method: "PATCH",
      headers: {
        ...adminBearerHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, note, status })
    });
    setUpdatingId(null);

    if (!response.ok) {
      setError(response.status === 401 || response.status === 403 ? "削除担当者としてログインしてください。" : "削除依頼の状態を更新できませんでした。");
      return;
    }

    loadDeleteRequests();
  }

  async function runErasure(
    item: AdminDeleteRequestRow,
    action: "preflight" | "prepare" | "approve" | "grant-status" | "execute"
  ) {
    const targetUserId = erasureUserIds[item.id]?.trim() ?? "";
    if (!item.userId || targetUserId !== item.userId) {
      setError("対象利用者の完全なIDを、表示どおり入力してください。");
      return;
    }

    const currentCheck = erasureChecks[item.id];
    const persistedJob = item.erasureJob;
    const expectedJobId = action === "approve"
      ? approvalJobIds[item.id]?.trim() ?? ""
      : currentCheck?.jobId ?? persistedJob?.id ?? "";
    const expectedManifestHash = action === "approve"
      ? approvalManifestHashes[item.id]?.trim() ?? ""
      : currentCheck?.manifestHash ?? persistedJob?.manifestHash ?? "";
    if (action === "approve" && (
      expectedJobId !== persistedJob?.id
      || expectedManifestHash !== persistedJob?.manifestHash
    )) {
      setError("別担当者は、画面のjob IDとmanifest hashを省略せず入力してください。");
      return;
    }
    if (
      (action === "grant-status" || action === "execute")
      && (!expectedJobId || !expectedManifestHash)
    ) {
      setError("先に削除対象を確定し、job IDとmanifest hashを確認してください。");
      return;
    }

    const confirmation = action === "prepare"
      ? erasurePreparePhrases[item.id]?.trim() ?? ""
      : action === "approve"
        ? approvalPhrases[item.id]?.trim() ?? ""
        : erasurePhrases[item.id]?.trim() ?? "";

    setUpdatingId(item.id);
    setError("");
    const response = await fetch("/api/admin/delete-requests/execute", {
      method: "POST",
      headers: {
        ...adminBearerHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action,
        requestId: item.id,
        targetUserId,
        confirmation,
        expectedJobId,
        expectedManifestHash
      })
    });
    const body = await response.json().catch(() => ({})) as {
      approved?: boolean;
      completed?: boolean;
      executionEnabled?: boolean;
      grantReady?: boolean;
      prepared?: boolean;
      requiresAal2?: boolean;
      assuranceLevel?: "aal1" | "aal2";
      authState?: string;
      message?: string;
      job?: {
        id?: string;
        manifestHash?: string;
        preparedExpiresAt?: string;
        status?: string;
      };
      result?: {
        result?: string;
        ownedFamilyCount?: number;
        storageObjectCount?: number;
        storagePrefixCount?: number;
        expiresAt?: string;
      };
    };
    setUpdatingId(null);

    if (!response.ok) {
      setError(body.message ?? "検証済み削除処理を続行できませんでした。");
      setErasureChecks((current) => ({
        ...current,
        [item.id]: {
          ...(current[item.id] ?? {
            ready: false,
            prepared: Boolean(persistedJob),
            requiresAal2: false,
            jobId: persistedJob?.id,
            manifestHash: persistedJob?.manifestHash
          }),
          executionEnabled: false,
          grantReady: false,
          message: body.message ?? "安全に停止しました。"
        }
      }));
      return;
    }

    if (action === "preflight") {
      const ready = body.result?.result === "ready" || body.result?.result === "database_erased";
      const executionEnabled = body.executionEnabled === true;
      const jobId = body.job?.id;
      const manifestHash = body.job?.manifestHash;
      const detail = ready
        ? `削除前確認OK：単独利用の家族${body.result?.ownedFamilyCount ?? 0}件、写真${body.result?.storageObjectCount ?? 0}件、Auth=${body.authState ?? "未確認"}`
        : "すでに検証済みで完了しています。";
      const executionBlocker = body.requiresAal2
        ? "／完全削除には多要素認証（AAL2）が必要です。"
        : executionEnabled
          ? ""
          : "／実行スイッチはOFFです。";
      setErasureChecks((current) => ({
        ...current,
        [item.id]: {
          ready,
          prepared: Boolean(jobId && manifestHash),
          executionEnabled,
          grantReady: false,
          requiresAal2: body.requiresAal2 === true,
          jobId,
          manifestHash,
          preparedExpiresAt: body.job?.preparedExpiresAt,
          storageObjectCount: body.result?.storageObjectCount,
          storagePrefixCount: body.result?.storagePrefixCount,
          message: `${detail}${executionBlocker}`
        }
      }));
      return;
    }

    if (action === "prepare" && body.prepared && body.job?.id && body.job.manifestHash) {
      setErasureChecks((current) => ({
        ...current,
        [item.id]: {
          ready: true,
          prepared: true,
          executionEnabled: body.executionEnabled === true,
          grantReady: false,
          requiresAal2: false,
          jobId: body.job?.id,
          manifestHash: body.job?.manifestHash,
          preparedExpiresAt: body.job?.preparedExpiresAt,
          storageObjectCount: body.result?.storageObjectCount,
          storagePrefixCount: body.result?.storagePrefixCount,
          message: "削除対象を確定しました。まだ削除していません。別担当者がjob IDとmanifest hashを確認し、実行を許可してください。"
        }
      }));
      setErasurePhrases((current) => ({ ...current, [item.id]: "" }));
      loadDeleteRequests();
      return;
    }

    if (action === "approve" && body.approved) {
      setErasureChecks((current) => ({
        ...current,
        [item.id]: {
          ...(current[item.id] ?? {
            ready: true,
            prepared: true,
            executionEnabled: false,
            grantReady: false,
            requiresAal2: false,
            jobId: persistedJob?.id,
            manifestHash: persistedJob?.manifestHash
          }),
          message: `別担当者の実行許可を記録しました。実行担当者へ戻ってください。有効期限：${body.result?.expiresAt ? new Date(body.result.expiresAt).toLocaleTimeString("ja-JP") : "10分以内"}`
        }
      }));
      setApprovalJobIds((current) => ({ ...current, [item.id]: "" }));
      setApprovalManifestHashes((current) => ({ ...current, [item.id]: "" }));
      setApprovalPhrases((current) => ({ ...current, [item.id]: "" }));
      return;
    }

    if (action === "grant-status") {
      const grantReady = body.grantReady === true;
      setErasureChecks((current) => ({
        ...current,
        [item.id]: {
          ...(current[item.id] ?? {
            ready: true,
            prepared: true,
            requiresAal2: false,
            jobId: persistedJob?.id,
            manifestHash: persistedJob?.manifestHash
          }),
          executionEnabled: body.executionEnabled === true,
          grantReady,
          grantExpiresAt: body.result?.expiresAt,
          message: grantReady
            ? `別担当者の実行許可を確認しました。${body.result?.expiresAt ? `有効期限：${new Date(body.result.expiresAt).toLocaleTimeString("ja-JP")}` : "途中処理を安全に再開できます。"}`
            : "実行許可はまだありません。別担当者の承認後に、もう一度確認してください。"
        }
      }));
      return;
    }

    if (body.completed) {
      setErasureChecks((current) => ({
        ...current,
        [item.id]: {
          ready: false,
          prepared: false,
          executionEnabled: false,
          grantReady: false,
          requiresAal2: false,
          message: "Auth・DB・写真を確認し、削除を完了しました。"
        }
      }));
      setErasureUserIds((current) => ({ ...current, [item.id]: "" }));
      setErasurePreparePhrases((current) => ({ ...current, [item.id]: "" }));
      setErasurePhrases((current) => ({ ...current, [item.id]: "" }));
      loadDeleteRequests();
    }
  }

  return (
    <div className="admin-table-wrap">
      {error ? <p className="hint">{error}</p> : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>requested</th>
            {operatorMethod === "supabase_app_admin" ? <th>contact</th> : null}
            <th>user</th>
            {operatorMethod === "supabase_app_admin" ? <th>reason</th> : null}
            <th>status</th>
            <th>SLA</th>
            {operatorMethod === "supabase_app_admin" ? <th>handled by</th> : null}
            <th>ops</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.createdAt).toLocaleString("ja-JP")}</td>
              {operatorMethod === "supabase_app_admin" ? <td>{item.contactEmail || "-"}</td> : null}
              <td><span className="hint" style={{ wordBreak: "break-all" }}>{item.userId || "削除済み"}</span></td>
              {operatorMethod === "supabase_app_admin" ? <td>{item.reason || "-"}</td> : null}
              <td>
                <span className={`admin-chip ${item.status === "completed" ? "success" : item.isOverdue ? "warning" : ""}`}>
                  {item.status}
                </span>
                {item.erasureStatus && item.erasureStatus !== "completed" ? (
                  <p className="hint">完全削除: {item.erasureStatus}</p>
                ) : null}
                {item.handledAt ? <p className="hint">{new Date(item.handledAt).toLocaleString("ja-JP")}</p> : null}
              </td>
              <td>
                <span className={`admin-chip ${item.status === "completed" ? "success" : item.isOverdue ? "warning" : ""}`}>
                  {item.status === "completed" ? "完了" : item.isOverdue ? "期限超過" : `残り${item.daysRemaining}日`}
                </span>
                <p className="hint">{new Date(item.dueAt).toLocaleDateString("ja-JP")}まで</p>
              </td>
              {operatorMethod === "supabase_app_admin" ? <td>{item.handledBy || "-"}</td> : null}
              <td>
                <div className="admin-row-actions">
                  {operatorMethod === "supabase_app_admin" ? (
                    <>
                      <textarea
                        aria-label="処理メモ"
                        className="admin-note-input"
                        onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="本人確認や所有権移管などの処理メモ"
                        rows={2}
                        value={notes[item.id] ?? item.handledNote ?? ""}
                      />
                      <button className="secondary compact" disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "reviewing")} type="button">
                        確認中
                      </button>
                      <button className="secondary compact" disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "needs_followup")} type="button">
                        要確認
                      </button>
                      <p className="hint">完了は、実データ・認証・写真の削除確認を残す専用処理からのみ記録します。</p>
                    </>
                  ) : null}
                  {item.status !== "completed" && item.userId ? (
                    <details className="admin-erasure-control">
                      <summary>検証済みの完全削除</summary>
                      <p className="hint">
                        共有家族の所有者、または本人が保存した写真が共有家族に残る場合は停止します。所有権・写真を家族側へ引き継いだ後に再確認してください。単独家族、本人の相談履歴、端末登録をDBから削除し、Authと写真が消えたことを再確認してからだけ完了にします。
                      </p>
                      <label>
                        <span className="hint">対象利用者IDを確認入力</span>
                        <input
                          className="input"
                          onChange={(event) => {
                            setErasureUserIds((current) => ({ ...current, [item.id]: event.target.value }));
                            setErasureChecks((current) => {
                              const next = { ...current };
                              delete next[item.id];
                              return next;
                            });
                            setErasurePreparePhrases((current) => ({ ...current, [item.id]: "" }));
                            setErasurePhrases((current) => ({ ...current, [item.id]: "" }));
                            setApprovalJobIds((current) => ({ ...current, [item.id]: "" }));
                            setApprovalManifestHashes((current) => ({ ...current, [item.id]: "" }));
                            setApprovalPhrases((current) => ({ ...current, [item.id]: "" }));
                          }}
                          placeholder={item.userId}
                          type="text"
                          value={erasureUserIds[item.id] ?? ""}
                        />
                      </label>
                      <button
                        className="secondary compact"
                        disabled={updatingId === item.id}
                        onClick={() => void runErasure(item, "preflight")}
                        type="button"
                      >
                        1. 削除前の安全確認（読み取りのみ）
                      </button>
                      {erasureChecks[item.id] ? <p className="hint" role="status">{erasureChecks[item.id].message}</p> : null}
                      {erasureChecks[item.id]?.ready
                        && operatorMethod === "supabase_account_delete_executor"
                        && !erasureChecks[item.id]?.prepared
                        && !isLivePreparedJob(item.erasureJob)
                        && item.erasureJob?.status !== "database_erased"
                        && !erasureChecks[item.id]?.requiresAal2 ? (
                        <>
                          <label>
                            <span className="hint">次の確認文を入力：<code>削除対象を確定 {item.id}</code></span>
                            <input
                              className="input"
                              onChange={(event) => setErasurePreparePhrases((current) => ({ ...current, [item.id]: event.target.value }))}
                              type="text"
                              value={erasurePreparePhrases[item.id] ?? ""}
                            />
                          </label>
                          <button
                            className="secondary compact"
                            disabled={
                              updatingId === item.id
                              || erasurePreparePhrases[item.id]?.trim() !== `削除対象を確定 ${item.id}`
                            }
                            onClick={() => void runErasure(item, "prepare")}
                            type="button"
                          >
                            2. 削除対象を確定する（まだ削除しない）
                          </button>
                        </>
                      ) : null}
                      {item.erasureJob || erasureChecks[item.id]?.prepared ? (
                        <div className="admin-erasure-evidence">
                          <strong>確定済みの削除対象</strong>
                          <p className="hint">job ID</p>
                          <code>{erasureChecks[item.id]?.jobId ?? item.erasureJob?.id}</code>
                          <p className="hint">manifest hash</p>
                          <code>{erasureChecks[item.id]?.manifestHash ?? item.erasureJob?.manifestHash}</code>
                          <p className="hint">
                            写真 {erasureChecks[item.id]?.storageObjectCount ?? item.erasureJob?.storageObjectCount ?? 0}件
                            ／旧保存場所 {erasureChecks[item.id]?.storagePrefixCount ?? item.erasureJob?.storagePrefixCount ?? 0}件
                            {erasureChecks[item.id]?.preparedExpiresAt || item.erasureJob?.preparedExpiresAt
                              ? `／対象確定の期限 ${new Date(erasureChecks[item.id]?.preparedExpiresAt ?? item.erasureJob?.preparedExpiresAt ?? "").toLocaleString("ja-JP")}`
                              : ""}
                          </p>
                          <p className="hint">写真の保存先そのものは画面に表示しません。</p>
                        </div>
                      ) : null}
                      {operatorMethod === "supabase_app_admin" && isLivePreparedJob(item.erasureJob) ? (
                        <div className="admin-erasure-approval">
                          <strong>3. 別担当者が実行を許可</strong>
                          <p className="hint">この前に、DB管理者が今回の1件だけの実行時間帯（最大15分）を開く必要があります。通常は閉じたままです。</p>
                          <p className="hint">実行担当者とは別のAAL2確認済み管理者でログインし、上の2つを見ながら省略せず入力します。</p>
                          <label>
                            <span className="hint">job IDを再入力</span>
                            <input
                              className="input"
                              onChange={(event) => setApprovalJobIds((current) => ({ ...current, [item.id]: event.target.value }))}
                              type="text"
                              value={approvalJobIds[item.id] ?? ""}
                            />
                          </label>
                          <label>
                            <span className="hint">manifest hashを再入力</span>
                            <input
                              className="input"
                              onChange={(event) => setApprovalManifestHashes((current) => ({ ...current, [item.id]: event.target.value }))}
                              type="text"
                              value={approvalManifestHashes[item.id] ?? ""}
                            />
                          </label>
                          <label>
                            <span className="hint">次の確認文を入力：<code>実行許可 {item.erasureJob!.id}</code></span>
                            <input
                              className="input"
                              onChange={(event) => setApprovalPhrases((current) => ({ ...current, [item.id]: event.target.value }))}
                              type="text"
                              value={approvalPhrases[item.id] ?? ""}
                            />
                          </label>
                          <button
                            className="secondary compact"
                            disabled={
                              updatingId === item.id
                              || approvalJobIds[item.id]?.trim() !== item.erasureJob!.id
                              || approvalManifestHashes[item.id]?.trim() !== item.erasureJob!.manifestHash
                              || approvalPhrases[item.id]?.trim() !== `実行許可 ${item.erasureJob!.id}`
                            }
                            onClick={() => void runErasure(item, "approve")}
                            type="button"
                          >
                            別担当者として10分間だけ実行を許可
                          </button>
                        </div>
                      ) : null}
                      {operatorMethod === "supabase_account_delete_executor" && (
                        isLivePreparedJob(item.erasureJob)
                        || item.erasureJob?.status === "database_erased"
                        || erasureChecks[item.id]?.prepared
                      ) ? (
                        <button
                          className="secondary compact"
                          disabled={updatingId === item.id}
                          onClick={() => void runErasure(item, "grant-status")}
                          type="button"
                        >
                          実行担当者として許可を再確認
                        </button>
                      ) : null}
                      {operatorMethod === "supabase_account_delete_executor" && erasureChecks[item.id]?.grantReady ? (
                        <div className="admin-erasure-final">
                          <label>
                            <span className="hint">最後に入力：<code>完全削除 {item.id}</code></span>
                            <input
                              className="input"
                              onChange={(event) => setErasurePhrases((current) => ({ ...current, [item.id]: event.target.value }))}
                              type="text"
                              value={erasurePhrases[item.id] ?? ""}
                            />
                          </label>
                          <button
                            className="admin-erasure-danger compact"
                            disabled={
                              updatingId === item.id
                              || !erasureChecks[item.id]?.executionEnabled
                              || erasurePhrases[item.id]?.trim() !== `完全削除 ${item.id}`
                            }
                            onClick={() => void runErasure(item, "execute")}
                            type="button"
                          >
                            4. Auth・DB・写真を検証して完全削除
                          </button>
                          {!erasureChecks[item.id]?.executionEnabled ? (
                            <p className="hint">本番の実行スイッチはOFFです。許可があっても削除は始まりません。</p>
                          ) : null}
                        </div>
                      ) : null}
                    </details>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !error ? (
            <tr><td colSpan={operatorMethod === "supabase_app_admin" ? 8 : 5}>削除依頼はまだありません。</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
