"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listLocalCases } from "@/lib/store";
import type { AdminSupportPackRow } from "@/app/api/admin/support-packs/route";

function adminHeaders(): HeadersInit {
  const token = window.localStorage.getItem("oyano_admin_token");
  return token ? { "x-admin-token": token } : {};
}

export function AdminSupportPacks() {
  const [supportPacks, setSupportPacks] = useState<AdminSupportPackRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/support-packs", { headers: adminHeaders() })
      .then((response) => response.ok ? response.json() : null)
      .then((body: { supportPacks?: AdminSupportPackRow[] } | null) => {
        if (body?.supportPacks && body.supportPacks.length > 0) {
          setSupportPacks(body.supportPacks);
          return;
        }

        const fallback = listLocalCases()
          .filter((item) => item.supportPackStatus && item.supportPackStatus !== "none")
          .map((item) => ({
            id: `local-${item.id}`,
            caseId: item.id,
            status: item.supportPackStatus ?? "requested",
            contactName: item.contactName,
            contactEmail: item.contactEmail,
            createdAt: item.createdAt
          }));
        setSupportPacks(fallback);
      });
  }, []);

  const rows = supportPacks ?? [];

  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>case</th>
          <th>status</th>
          <th>contact</th>
          <th>created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.id}>
            <td>{item.caseId ? <Link href={`/admin/cases/${item.caseId}`}>{item.caseId.slice(0, 8)}</Link> : "-"}</td>
            <td>{item.status}</td>
            <td>{item.contactName || "-"} {item.contactEmail || ""}</td>
            <td>{new Date(item.createdAt).toLocaleString("ja-JP")}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={4}>発動サポート依頼はまだありません。</td></tr>}
      </tbody>
    </table>
  );
}
