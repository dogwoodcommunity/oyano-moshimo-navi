"use client";

import Link from "next/link";
import { listLocalCases } from "@/lib/store";

export default function AdminSupportPacksPage() {
  const supportCases = listLocalCases().filter((item) => item.supportPackStatus && item.supportPackStatus !== "none");
  return (
    <main className="container">
      <h1 className="page-title">support pack確認</h1>
      <section className="panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>case</th>
              <th>status</th>
              <th>contact</th>
            </tr>
          </thead>
          <tbody>
            {supportCases.map((item) => (
              <tr key={item.id}>
                <td><Link href={`/admin/cases/${item.id}`}>{item.id.slice(0, 8)}</Link></td>
                <td>{item.supportPackStatus}</td>
                <td>{item.contactName || "-"} {item.contactEmail || ""}</td>
              </tr>
            ))}
            {supportCases.length === 0 && <tr><td colSpan={3}>発動サポート依頼はまだありません。</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
