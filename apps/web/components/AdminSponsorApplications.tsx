"use client";

import { useEffect, useState } from "react";
import type { AdminSponsorApplicationRow } from "@/app/api/admin/sponsor-applications/route";
import { adminHeaders } from "@/lib/adminClientAuth";

export function AdminSponsorApplications() {
  const [items, setItems] = useState<AdminSponsorApplicationRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/sponsor-applications", { headers: adminHeaders() })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(body)))
      .then((body: { sponsorApplications?: AdminSponsorApplicationRow[] }) => {
        setItems(body.sponsorApplications ?? []);
      })
      .catch((body: { error?: string }) => {
        setError(body?.error ?? "読み込みに失敗しました。");
        setItems([]);
      });
  }, []);

  const rows = items ?? [];

  if (error) {
    return <p className="admin-error">{error}</p>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>region</th>
            <th>category</th>
            <th>company</th>
            <th>contact</th>
            <th>slot</th>
            <th>created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>{item.prefecture}{item.city ? ` / ${item.city}` : ""}</td>
              <td><span className="admin-chip success">{item.category}</span></td>
              <td>
                <strong>{item.companyName}</strong>
                {item.website ? <><br /><a className="admin-link" href={item.website} rel="noreferrer" target="_blank">website</a></> : null}
              </td>
              <td>{item.contactName}<br />{item.contactEmail}{item.contactPhone ? <><br />{item.contactPhone}</> : null}</td>
              <td>{item.slotType}{item.budgetNote ? <><br /><small>{item.budgetNote}</small></> : null}</td>
              <td>{new Date(item.createdAt).toLocaleString("ja-JP")}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6}>スポンサー枠申請はまだありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
