"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "oyano_admin_token";

export function AdminTokenControl() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(STORAGE_KEY) ?? "");
  }, []);

  function saveToken() {
    const nextToken = token.trim();
    if (nextToken) {
      window.localStorage.setItem(STORAGE_KEY, nextToken);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <h2>Admin token</h2>
      <div className="field">
        <label htmlFor="admin-token">ADMIN_ACCESS_TOKEN</label>
        <input
          id="admin-token"
          className="input"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Vercelに設定した管理トークン"
        />
      </div>
      <div className="actions">
        <button className="button" type="button" onClick={saveToken}>
          保存
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            setToken("");
            window.localStorage.removeItem(STORAGE_KEY);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1800);
          }}
        >
          削除
        </button>
      </div>
      <p className="hint">
        保存後にAdmin一覧やenv確認を再読み込みすると、Supabase本番データを確認できます。
        {saved ? " 保存しました。" : ""}
      </p>
    </section>
  );
}

