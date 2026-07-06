"use client";

import { useEffect, useState } from "react";
import { AdminTokenControl } from "@/components/AdminTokenControl";

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
      <section className="admin-hero compact">
        <p className="pill">Environment</p>
        <h1 className="page-title">env確認</h1>
        <p className="lead">本番公開前に必要な環境変数が設定済みか確認します。未設定の項目はVercelとSupabase側で埋めます。</p>
      </section>
      <AdminTokenControl />
      <section className="panel">
        <div className="admin-table-wrap">
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
                  <td><span className={`admin-chip ${row.configured ? "success" : "warning"}`}>{row.configured ? "configured" : "missing"}</span></td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={2}>env情報を取得できません。</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
