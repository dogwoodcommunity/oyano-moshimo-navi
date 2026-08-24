"use client";

import { useEffect, useState } from "react";
import {
  ADMIN_BEARER_TOKEN_STORAGE_KEY,
  ADMIN_STATIC_TOKEN_STORAGE_KEY,
  adminHeaders
} from "@/lib/adminClientAuth";
import {
  completeBrowserSupabaseAuthFromUrl,
  getBrowserSupabase,
  sendAdminMagicLink
} from "@/lib/browserSupabase";

type AuthState = "checking" | "authenticated" | "signed-out" | "denied";

type AuthStatus = {
  authenticated?: boolean;
  email?: string | null;
  method?: "supabase_app_admin" | "static_token";
};

export function AdminTokenControl() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authStatus, setAuthStatus] = useState<AuthStatus>({});
  const [email, setEmail] = useState("");
  const [staticToken, setStaticToken] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const authResult = await completeBrowserSupabaseAuthFromUrl();
      if (cancelled) return;

      if (authResult.error) setMessage(authResult.error);
      if (authResult.session?.access_token) {
        window.localStorage.setItem(
          ADMIN_BEARER_TOKEN_STORAGE_KEY,
          authResult.session.access_token
        );
      }
      setStaticToken(window.localStorage.getItem(ADMIN_STATIC_TOKEN_STORAGE_KEY) ?? "");
      await verifyStoredAccess();
    }

    async function verifyStoredAccess() {
      const hasStoredAccess = Object.keys(adminHeaders()).length > 0;
      if (!hasStoredAccess) {
        setAuthState("signed-out");
        return;
      }

      try {
        const response = await fetch("/api/admin/auth-status", { headers: adminHeaders() });
        if (!response.ok) {
          setAuthState("denied");
          return;
        }
        const body = await response.json() as AuthStatus;
        setAuthStatus(body);
        setAuthState("authenticated");
        window.dispatchEvent(new Event("admin-auth-changed"));
      } catch {
        setAuthState("denied");
      }
    }

    initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendLink() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setMessage("管理者として登録したメールアドレスを入力してください。");
      return;
    }

    setSending(true);
    setMessage("");
    const result = await sendAdminMagicLink(nextEmail);
    setSending(false);
    setMessage(result.ok
      ? "確認メールを送りました。メール内のリンクを開くと管理画面へ戻ります。"
      : result.error ?? "確認メールを送れませんでした。");
  }

  async function signOut() {
    await getBrowserSupabase()?.auth.signOut();
    window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_STATIC_TOKEN_STORAGE_KEY);
    setStaticToken("");
    setAuthStatus({});
    setAuthState("signed-out");
    setMessage("管理画面からログアウトしました。");
    window.dispatchEvent(new Event("admin-auth-changed"));
  }

  async function saveEmergencyToken() {
    const nextToken = staticToken.trim();
    if (!nextToken) {
      setMessage("緊急用管理キーを入力してください。");
      return;
    }

    window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
    window.localStorage.setItem(ADMIN_STATIC_TOKEN_STORAGE_KEY, nextToken);
    setAuthState("checking");
    const response = await fetch("/api/admin/auth-status", { headers: adminHeaders() });
    if (!response.ok) {
      setAuthState("denied");
      setMessage("管理キーを確認できませんでした。");
      return;
    }

    const body = await response.json() as AuthStatus;
    setAuthStatus(body);
    setAuthState("authenticated");
    setMessage("緊急用管理キーで認証しました。");
    window.dispatchEvent(new Event("admin-auth-changed"));
  }

  if (authState === "checking") {
    return (
      <section className="admin-auth-card is-checking" aria-live="polite">
        <strong>管理者認証を確認しています</strong>
      </section>
    );
  }

  if (authState === "authenticated") {
    return (
      <section className="admin-auth-card is-authenticated" aria-live="polite">
        <div>
          <p className="admin-section-label">管理者認証</p>
          <h2>確認済みです</h2>
          <p>
            {authStatus.email ?? "緊急用管理キー"}で管理データを表示しています。
          </p>
        </div>
        <button className="admin-text-button" type="button" onClick={signOut}>ログアウト</button>
      </section>
    );
  }

  return (
    <section className="admin-auth-card" aria-live="polite">
      <div className="admin-auth-intro">
        <p className="admin-section-label">最初に1回だけ</p>
        <h2>管理者メールを確認します</h2>
        <p>
          運営メンバーとして登録済みのメールアドレスへ確認メールを送ります。
          メール内のリンクを開くと、回答や利用状況が表示されます。
        </p>
      </div>
      {authState === "denied" && (
        <p className="admin-auth-warning">
          現在のログインでは管理権限を確認できませんでした。登録済みの管理者メールで確認してください。
        </p>
      )}
      <div className="admin-auth-form">
        <label htmlFor="admin-email">管理者メールアドレス</label>
        <input
          id="admin-email"
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
        <button className="button" type="button" disabled={sending} onClick={sendLink}>
          {sending ? "送信しています" : "確認メールを送る"}
        </button>
      </div>
      {message && <p className="admin-auth-message">{message}</p>}
      <details className="admin-emergency-access">
        <summary>メールで入れない場合</summary>
        <div>
          <p>システム担当者から緊急用管理キーを受け取った場合だけ使用します。</p>
          <label htmlFor="admin-emergency-token">緊急用管理キー</label>
          <input
            id="admin-emergency-token"
            className="input"
            type="password"
            autoComplete="off"
            value={staticToken}
            onChange={(event) => setStaticToken(event.target.value)}
          />
          <button className="secondary" type="button" onClick={saveEmergencyToken}>管理キーを確認する</button>
        </div>
      </details>
    </section>
  );
}
