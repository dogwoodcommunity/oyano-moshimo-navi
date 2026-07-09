"use client";

import { useEffect, useState } from "react";
import {
  ADMIN_BEARER_TOKEN_STORAGE_KEY,
  ADMIN_STATIC_TOKEN_STORAGE_KEY
} from "@/lib/adminClientAuth";

export function AdminTokenControl() {
  const [bearerToken, setBearerToken] = useState("");
  const [staticToken, setStaticToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBearerToken(window.localStorage.getItem(ADMIN_BEARER_TOKEN_STORAGE_KEY) ?? "");
    setStaticToken(window.localStorage.getItem(ADMIN_STATIC_TOKEN_STORAGE_KEY) ?? "");
  }, []);

  function saveToken() {
    const nextBearerToken = bearerToken.trim();
    const nextStaticToken = staticToken.trim();

    if (nextBearerToken) {
      window.localStorage.setItem(ADMIN_BEARER_TOKEN_STORAGE_KEY, nextBearerToken);
    } else {
      window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
    }

    if (nextStaticToken) {
      window.localStorage.setItem(ADMIN_STATIC_TOKEN_STORAGE_KEY, nextStaticToken);
    } else {
      window.localStorage.removeItem(ADMIN_STATIC_TOKEN_STORAGE_KEY);
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="panel admin-control-panel" style={{ marginTop: 18 }}>
      <div>
        <p className="eyebrow">Access</p>
        <h2>Admin access</h2>
      </div>
      <div className="field">
        <label htmlFor="admin-bearer-token">app_admin access token</label>
        <input
          id="admin-bearer-token"
          className="input"
          type="password"
          autoComplete="off"
          value={bearerToken}
          onChange={(event) => setBearerToken(event.target.value)}
          placeholder="Supabase Authの個別管理者token"
        />
        <p className="hint">本番運用はこちらを優先します。API側で `family_members.role=admin` / `relationship=app_admin` を確認します。</p>
      </div>
      <div className="field">
        <label htmlFor="admin-token">ADMIN_ACCESS_TOKEN fallback</label>
        <input
          id="admin-token"
          className="input"
          type="password"
          autoComplete="off"
          value={staticToken}
          onChange={(event) => setStaticToken(event.target.value)}
          placeholder="暫定運用の管理トークン"
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
            setBearerToken("");
            setStaticToken("");
            window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
            window.localStorage.removeItem(ADMIN_STATIC_TOKEN_STORAGE_KEY);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1800);
          }}
        >
          削除
        </button>
      </div>
      <p className="hint">
        Bearer tokenが保存されている場合はBearer認証を使い、未設定の場合だけ暫定fallbackを使います。
        保存後にAdmin一覧やenv確認を再読み込みすると、Supabase本番データを確認できます。
        {saved ? " 保存しました。" : ""}
      </p>
    </section>
  );
}
