"use client";

import { useEffect, useState } from "react";

type EnvRow = {
  key: string;
  configured: boolean;
};

function adminHeaders(): HeadersInit {
  const token = window.localStorage.getItem("oyano_admin_token");
  return token ? { "x-admin-token": token } : {};
}

export default function AdminEnvPage() {
  const [rows, setRows] = useState<EnvRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/env-check", { headers: adminHeaders() })
      .then((response) => response.ok ? response.json() : null)
      .then((body: { env?: EnvRow[] } | null) => setRows(body?.env ?? []));
  }, []);

  return (
    <main className="container">
      <h1 className="page-title">env確認</h1>
      <section className="panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>key</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>{row.configured ? "configured" : "missing"}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={2}>env情報を取得できません。</td></tr> : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
