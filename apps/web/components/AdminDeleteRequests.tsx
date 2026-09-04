"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminDeleteRequestRow } from "@/app/api/admin/delete-requests/route";
import { adminBearerHeaders } from "@/lib/adminClientAuth";

export function AdminDeleteRequests() {
  const loadRequestId = useRef(0);
  const [deleteRequests, setDeleteRequests] = useState<AdminDeleteRequestRow[] | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [erasureUserIds, setErasureUserIds] = useState<Record<string, string>>({});
  const [erasurePhrases, setErasurePhrases] = useState<Record<string, string>>({});
  const [erasureChecks, setErasureChecks] = useState<Record<string, {
    ready: boolean;
    executionEnabled: boolean;
    message: string;
  }>>({});

  function loadDeleteRequests() {
    const requestId = ++loadRequestId.current;
    fetch("/api/admin/delete-requests", { headers: adminBearerHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "削除担当者としてログインしてください。" : "削除依頼を取得できませんでした。");
        return response.json();
      })
      .then((body: { deleteRequests?: AdminDeleteRequestRow[] }) => {
        if (requestId !== loadRequestId.current) return;
        setError("");
        setDeleteRequests(body.deleteRequests ?? []);
      })
      .catch((err: Error) => {
        if (requestId !== loadRequestId.current) return;
        setError(err.message);
        setDeleteRequests([]);
      });
  }

  useEffect(() => {
    loadDeleteRequests();
    const reloadAfterAuthChange = () => {
      // Authentication changes invalidate PII, preflight decisions, and exact
      // confirmations from the previous operator/session immediately.
      loadRequestId.current += 1;
      setDeleteRequests(null);
      setError("");
      setNotes({});
      setErasureUserIds({});
      setErasurePhrases({});
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

  async function runErasure(item: AdminDeleteRequestRow, action: "preflight" | "execute") {
    const targetUserId = erasureUserIds[item.id]?.trim() ?? "";
    if (!item.userId || targetUserId !== item.userId) {
      setError("対象利用者の完全なIDを、表示どおり入力してください。");
      return;
    }

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
        confirmation: erasurePhrases[item.id]?.trim() ?? ""
      })
    });
    const body = await response.json().catch(() => ({})) as {
      completed?: boolean;
      executionEnabled?: boolean;
      requiresAal2?: boolean;
      assuranceLevel?: "aal1" | "aal2";
      authState?: string;
      message?: string;
      result?: { result?: string; ownedFamilyCount?: number; storageObjectCount?: number };
    };
    setUpdatingId(null);

    if (!response.ok) {
      setError(body.message ?? "検証済み削除処理を続行できませんでした。");
      setErasureChecks((current) => ({
        ...current,
        [item.id]: { ready: false, executionEnabled: false, message: body.message ?? "安全に停止しました。" }
      }));
      return;
    }

    if (action === "preflight") {
      const ready = body.result?.result === "ready" || body.result?.result === "database_erased";
      const executionEnabled = body.executionEnabled === true;
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
          executionEnabled,
          message: `${detail}${executionBlocker}`
        }
      }));
      return;
    }

    if (body.completed) {
      setErasureChecks((current) => ({
        ...current,
        [item.id]: { ready: false, executionEnabled: false, message: "Auth・DB・写真を確認し、削除を完了しました。" }
      }));
      setErasureUserIds((current) => ({ ...current, [item.id]: "" }));
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
            <th>contact</th>
            <th>user</th>
            <th>reason</th>
            <th>status</th>
            <th>SLA</th>
            <th>handled by</th>
            <th>ops</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.createdAt).toLocaleString("ja-JP")}</td>
              <td>{item.contactEmail || "-"}</td>
              <td><span className="hint" style={{ wordBreak: "break-all" }}>{item.userId || "削除済み"}</span></td>
              <td>{item.reason || "-"}</td>
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
              <td>{item.handledBy || "-"}</td>
              <td>
                <div className="admin-row-actions">
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
                          onChange={(event) => setErasureUserIds((current) => ({ ...current, [item.id]: event.target.value }))}
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
                        削除前の安全確認
                      </button>
                      {erasureChecks[item.id] ? <p className="hint" role="status">{erasureChecks[item.id].message}</p> : null}
                      {erasureChecks[item.id]?.ready ? (
                        <>
                          <label>
                            <span className="hint">次の確認文を入力：<code>完全削除 {item.id}</code></span>
                            <input
                              className="input"
                              onChange={(event) => setErasurePhrases((current) => ({ ...current, [item.id]: event.target.value }))}
                              type="text"
                              value={erasurePhrases[item.id] ?? ""}
                            />
                          </label>
                          <button
                            className="secondary compact"
                            disabled={
                              updatingId === item.id
                              || !erasureChecks[item.id]?.executionEnabled
                              || erasurePhrases[item.id]?.trim() !== `完全削除 ${item.id}`
                            }
                            onClick={() => void runErasure(item, "execute")}
                            type="button"
                          >
                            Auth・DB・写真を検証して完全削除
                          </button>
                        </>
                      ) : null}
                    </details>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !error ? <tr><td colSpan={8}>削除依頼はまだありません。</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
