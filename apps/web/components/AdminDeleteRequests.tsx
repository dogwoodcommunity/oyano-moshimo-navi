"use client";

import { useEffect, useState } from "react";
import type { AdminDeleteRequestRow } from "@/app/api/admin/delete-requests/route";

function adminHeaders(): HeadersInit {
  const token = window.localStorage.getItem("oyano_admin_token");
  return token ? { "x-admin-token": token } : {};
}

export function AdminDeleteRequests() {
  const [deleteRequests, setDeleteRequests] = useState<AdminDeleteRequestRow[] | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function loadDeleteRequests() {
    fetch("/api/admin/delete-requests", { headers: adminHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Admin tokenを設定してください。" : "削除依頼を取得できませんでした。");
        return response.json();
      })
      .then((body: { deleteRequests?: AdminDeleteRequestRow[] }) => {
        setDeleteRequests(body.deleteRequests ?? []);
      })
      .catch((err: Error) => {
        setError(err.message);
        setDeleteRequests([]);
      });
  }

  useEffect(() => {
    loadDeleteRequests();
  }, []);

  const rows = deleteRequests ?? [];

  async function updateStatus(id: string, status: AdminDeleteRequestRow["status"]) {
    const note = notes[id]?.trim() ?? "";
    if (status === "completed" && note.length < 10) {
      setError("完了にする場合は、実施内容を10文字以上で記録してください。");
      return;
    }

    setUpdatingId(id);
    setError("");
    const response = await fetch("/api/admin/delete-requests", {
      method: "PATCH",
      headers: {
        ...adminHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, note, status })
    });
    setUpdatingId(null);

    if (!response.ok) {
      setError(response.status === 401 ? "Admin tokenを設定してください。" : "削除依頼の状態を更新できませんでした。");
      return;
    }

    loadDeleteRequests();
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
              <td>{item.userId ? item.userId.slice(0, 8) : "-"}</td>
              <td>{item.reason || "-"}</td>
              <td>
                <span className={`admin-chip ${item.status === "completed" ? "success" : item.isOverdue ? "warning" : ""}`}>
                  {item.status}
                </span>
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
                    placeholder="処理メモ。完了時は実施内容を必ず記録"
                    rows={2}
                    value={notes[item.id] ?? item.handledNote ?? ""}
                  />
                  <button className="secondary compact" disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "reviewing")} type="button">
                    確認中
                  </button>
                  <button className="secondary compact" disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "needs_followup")} type="button">
                    要確認
                  </button>
                  <button className="secondary compact" disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "completed")} type="button">
                    完了
                  </button>
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
