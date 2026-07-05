"use client";

import Link from "next/link";
import { listLocalCases } from "@/lib/store";
import { statusLabel } from "@oyano/shared";

export function AdminCases() {
  const cases = listLocalCases();
  return (
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
            <td><Link href={`/admin/cases/${item.id}`}>{item.id.slice(0, 8)}</Link></td>
            <td>{statusLabel(item.selectedStatus)} / {item.status}</td>
            <td>{item.supportPackStatus ?? "none"}</td>
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
  );
}
