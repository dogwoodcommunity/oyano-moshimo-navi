"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listLocalCases } from "@/lib/store";
import { statusLabel } from "@oyano/shared";
import type { AdminCaseRow } from "@/app/api/admin/cases/route";
import { adminHeaders } from "@/lib/adminClientAuth";

export function AdminCases() {
  const [remoteCases, setRemoteCases] = useState<AdminCaseRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/cases", { headers: adminHeaders() })
      .then((response) => response.ok ? response.json() : null)
      .then((body: { cases?: AdminCaseRow[] } | null) => {
        setRemoteCases(body?.cases ?? []);
      });
  }, []);

  const cases = remoteCases && remoteCases.length > 0 ? remoteCases : listLocalCases();
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>case</th>
            <th>status</th>
            <th>support pack</th>
            <th>created</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.id}>
              <td><Link className="admin-link" href={`/admin/cases/${item.id}`}>{item.id.slice(0, 8)}</Link></td>
              <td>{statusLabel(item.selectedStatus)} <span className="admin-chip">{item.status}</span></td>
              <td><span className={`admin-chip ${item.supportPackStatus && item.supportPackStatus !== "none" ? "success" : ""}`}>{item.supportPackStatus ?? "none"}</span></td>
              <td>{new Date(item.createdAt).toLocaleString("ja-JP")}</td>
            </tr>
          ))}
          {cases.length === 0 && (
            <tr>
              <td colSpan={4}>まだWeb診断caseがありません。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
