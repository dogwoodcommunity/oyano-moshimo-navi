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

  useEffect(() => {
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
  }, []);

  const rows = deleteRequests ?? [];

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
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.createdAt).toLocaleString("ja-JP")}</td>
              <td>{item.contactEmail || "-"}</td>
              <td>{item.userId ? item.userId.slice(0, 8) : "-"}</td>
              <td>{item.reason || "-"}</td>
            </tr>
          ))}
          {rows.length === 0 && !error ? <tr><td colSpan={4}>削除依頼はまだありません。</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
