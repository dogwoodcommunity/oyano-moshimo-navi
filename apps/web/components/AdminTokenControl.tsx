"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ADMIN_BEARER_TOKEN_STORAGE_KEY,
  ADMIN_STATIC_TOKEN_STORAGE_KEY,
  adminBearerHeaders,
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
  method?: "supabase_app_admin" | "supabase_account_delete_executor" | "static_token";
  aal?: "aal1" | "aal2";
};

type AdminTokenControlProps = {
  authEndpoint?: string;
  enableMfaStepUp?: boolean;
  redirectPath?: string;
  roleLabel?: string;
  showEmergencyToken?: boolean;
};

type TotpFactor = {
  id: string;
  label: string;
};

function hasSupabaseAuthCallbackInLocation() {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  return Boolean(
    url.searchParams.get("code")
    || url.searchParams.get("error")
    || url.searchParams.get("error_code")
    || url.searchParams.get("error_description")
    || hashParams.get("access_token")
    || hashParams.get("refresh_token")
    || hashParams.get("error")
    || hashParams.get("error_code")
    || hashParams.get("error_description")
  );
}

export function AdminTokenControl({
  authEndpoint = "/api/admin/auth-status",
  enableMfaStepUp = false,
  redirectPath = "/admin/monitor-feedback",
  roleLabel = "管理者",
  showEmergencyToken = true
}: AdminTokenControlProps = {}) {
  const verifyRequestId = useRef(0);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const mfaCodeInputRef = useRef<HTMLInputElement | null>(null);
  const authInitializationPending = useRef(true);
  const mfaChallengePending = useRef(false);
  const signOutAttempted = useRef(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authStatus, setAuthStatus] = useState<AuthStatus>({});
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [staticToken, setStaticToken] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [totpFactors, setTotpFactors] = useState<TotpFactor[] | null>(null);
  const [selectedFactorId, setSelectedFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  function showEmailError(nextMessage: string) {
    setEmailError(nextMessage);
    setMessage(nextMessage);
    window.setTimeout(() => {
      emailInputRef.current?.focus({ preventScroll: true });
      emailInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  }

  function showMfaError(nextMessage: string) {
    setMfaMessage(nextMessage);
    window.setTimeout(() => {
      mfaCodeInputRef.current?.focus({ preventScroll: true });
      mfaCodeInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  }

  const loadVerifiedTotpFactors = useCallback(async (requestId: number) => {
    const client = getBrowserSupabase();
    if (!client) {
      if (requestId !== verifyRequestId.current) return;
      setTotpFactors([]);
      setMfaMessage("多要素認証の設定を確認できませんでした。");
      return;
    }

    const { data, error } = await client.auth.mfa.listFactors();
    if (requestId !== verifyRequestId.current) return;
    if (error || !data) {
      setTotpFactors([]);
      setMfaMessage("登録済みの多要素認証を確認できませんでした。");
      return;
    }

    const factors = data.totp
      .filter((factor) => factor.status === "verified")
      .map((factor, index) => ({
        id: factor.id,
        label: factor.friendly_name?.trim() || `認証アプリ ${index + 1}`
      }));
    setTotpFactors(factors);
    setSelectedFactorId((current) => (
      factors.some((factor) => factor.id === current) ? current : factors[0]?.id ?? ""
    ));
    setMfaMessage("");
  }, []);

  const verifyStoredAccess = useCallback(async () => {
    const requestId = ++verifyRequestId.current;
    const requestHeaders = showEmergencyToken ? adminHeaders() : adminBearerHeaders();
    const hasStoredAccess = Object.keys(requestHeaders).length > 0;
    if (!hasStoredAccess) {
      setAuthStatus({});
      setTotpFactors(null);
      setSelectedFactorId("");
      setMfaCode("");
      setMfaMessage("");
      setAuthState("signed-out");
      window.dispatchEvent(new Event("admin-auth-changed"));
      return;
    }

    try {
      const response = await fetch(authEndpoint, { headers: requestHeaders });
      if (requestId !== verifyRequestId.current) return;
      if (!response.ok) {
        setAuthStatus({});
        setTotpFactors(null);
        setSelectedFactorId("");
        setMfaCode("");
        setMfaMessage("");
        setAuthState("denied");
        window.dispatchEvent(new Event("admin-auth-changed"));
        return;
      }
      const body = await response.json() as AuthStatus;
      if (requestId !== verifyRequestId.current) return;
      setEmailError("");
      setAuthStatus(body);
      setAuthState("authenticated");
      if (enableMfaStepUp && body.aal === "aal1") {
        setTotpFactors(null);
        await loadVerifiedTotpFactors(requestId);
      } else {
        setTotpFactors(null);
        setSelectedFactorId("");
        setMfaCode("");
        setMfaMessage("");
      }
      if (requestId !== verifyRequestId.current) return;
      window.dispatchEvent(new Event("admin-auth-changed"));
    } catch {
      if (requestId !== verifyRequestId.current) return;
      setAuthStatus({});
      setTotpFactors(null);
      setSelectedFactorId("");
      setMfaCode("");
      setMfaMessage("");
      setAuthState("denied");
      window.dispatchEvent(new Event("admin-auth-changed"));
    }
  }, [authEndpoint, enableMfaStepUp, loadVerifiedTotpFactors, showEmergencyToken]);

  useEffect(() => {
    let cancelled = false;

    const invalidateDisplayedAccess = (nextState: AuthState, removeStoredBearer = true) => {
      verifyRequestId.current += 1;
      if (removeStoredBearer) {
        window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
      }
      setAuthStatus({});
      setTotpFactors(null);
      setSelectedFactorId("");
      setMfaCode("");
      setMfaMessage("");
      setVerifyingMfa(false);
      setAuthState(nextState);
      window.dispatchEvent(new Event("admin-auth-changed"));
    };

    async function initialize() {
      if (hasSupabaseAuthCallbackInLocation()) {
        invalidateDisplayedAccess("checking");
      }
      const authResult = await completeBrowserSupabaseAuthFromUrl();
      if (cancelled) return;

      if (authResult.error) setMessage(authResult.error);
      if (authResult.handled && (!authResult.session || authResult.error)) {
        window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
      }
      if (authResult.session?.access_token) {
        window.localStorage.setItem(
          ADMIN_BEARER_TOKEN_STORAGE_KEY,
          authResult.session.access_token
        );
      }
      if (showEmergencyToken) {
        setStaticToken(window.localStorage.getItem(ADMIN_STATIC_TOKEN_STORAGE_KEY) ?? "");
      }
      authInitializationPending.current = false;
      await verifyStoredAccess();
    }

    void initialize();
    const client = getBrowserSupabase();
    const authListener = enableMfaStepUp ? client?.auth.onAuthStateChange((event, session) => {
      if (authInitializationPending.current) return;
      if (event === "SIGNED_OUT" || !session?.access_token) {
        invalidateDisplayedAccess("signed-out");
        return;
      }
      if (
        mfaChallengePending.current
        && (event === "MFA_CHALLENGE_VERIFIED" || event === "TOKEN_REFRESHED")
      ) {
        return;
      }
      if (signOutAttempted.current) {
        window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
        return;
      }
      invalidateDisplayedAccess("checking");
      window.localStorage.setItem(ADMIN_BEARER_TOKEN_STORAGE_KEY, session.access_token);
      void verifyStoredAccess();
    }) : undefined;

    const handleBearerStorageChange = (event: StorageEvent) => {
      if (!enableMfaStepUp || event.storageArea !== window.localStorage) return;
      if (event.key !== ADMIN_BEARER_TOKEN_STORAGE_KEY) return;
      invalidateDisplayedAccess(event.newValue ? "checking" : "signed-out", false);
      if (event.newValue && !signOutAttempted.current) void verifyStoredAccess();
    };
    window.addEventListener("storage", handleBearerStorageChange);
    return () => {
      cancelled = true;
      authInitializationPending.current = true;
      verifyRequestId.current += 1;
      authListener?.data.subscription.unsubscribe();
      window.removeEventListener("storage", handleBearerStorageChange);
    };
  }, [enableMfaStepUp, showEmergencyToken, verifyStoredAccess]);

  async function sendLink() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      showEmailError(`${roleLabel}として登録したメールアドレスを入力してください。`);
      return;
    }
    if (emailInputRef.current && !emailInputRef.current.validity.valid) {
      showEmailError("メールアドレスを正しい形式で入力してください。");
      return;
    }

    setSending(true);
    setEmailError("");
    setMessage("");
    const result = await sendAdminMagicLink(nextEmail, redirectPath);
    setSending(false);
    if (!result.ok) {
      showEmailError(result.error ?? "確認メールを送れませんでした。");
      return;
    }
    setMessage("確認メールを送りました。メール内のリンクを開くと管理画面へ戻ります。");
  }

  async function signOut() {
    signOutAttempted.current = true;
    setEmailError("");
    verifyRequestId.current += 1;
    window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
    if (showEmergencyToken) {
      window.localStorage.removeItem(ADMIN_STATIC_TOKEN_STORAGE_KEY);
    }
    setStaticToken("");
    setAuthStatus({});
    setTotpFactors(null);
    setSelectedFactorId("");
    setMfaCode("");
    setMfaMessage("");
    setVerifyingMfa(false);
    setAuthState("checking");
    window.dispatchEvent(new Event("admin-auth-changed"));

    const client = getBrowserSupabase();
    let signOutFailed = false;
    if (client) {
      try {
        const { error } = await client.auth.signOut({ scope: "local" });
        signOutFailed = Boolean(error);
      } catch {
        signOutFailed = true;
      }
    }
    if (signOutFailed) {
      setAuthState("denied");
      setMessage("ログアウト完了を確認できませんでした。削除依頼は非表示にしました。通信を確認してもう一度押すか、このブラウザを閉じてください。");
      return;
    }

    signOutAttempted.current = false;
    setAuthState("signed-out");
    setMessage(`${roleLabel}画面からログアウトしました。`);
    window.dispatchEvent(new Event("admin-auth-changed"));
  }

  async function verifyMfaCode() {
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code) || !selectedFactorId) {
      showMfaError("認証アプリに表示された6桁の数字を入力してください。");
      return;
    }

    const client = getBrowserSupabase();
    if (!client) {
      showMfaError("多要素認証の設定を確認できませんでした。");
      return;
    }

    const requestId = ++verifyRequestId.current;
    mfaChallengePending.current = true;
    setVerifyingMfa(true);
    setMfaMessage("");
    try {
      const { data, error } = await client.auth.mfa.challengeAndVerify({
        factorId: selectedFactorId,
        code
      });
      if (requestId !== verifyRequestId.current) return;
      setVerifyingMfa(false);
      if (error || !data?.access_token) {
        showMfaError("6桁の数字を確認できませんでした。認証アプリの新しい数字でやり直してください。");
        return;
      }

      window.localStorage.setItem(ADMIN_BEARER_TOKEN_STORAGE_KEY, data.access_token);
      setMfaCode("");
      setMessage("多要素認証を確認しました。");
      await verifyStoredAccess();
    } finally {
      mfaChallengePending.current = false;
    }
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
    const requestId = ++verifyRequestId.current;
    const response = await fetch(authEndpoint, { headers: adminHeaders() });
    if (requestId !== verifyRequestId.current) return;
    if (!response.ok) {
      setAuthState("denied");
      setMessage("管理キーを確認できませんでした。");
      return;
    }

    const body = await response.json() as AuthStatus;
    if (requestId !== verifyRequestId.current) return;
    setAuthStatus(body);
    setAuthState("authenticated");
    setMessage("緊急用管理キーで認証しました。");
    window.dispatchEvent(new Event("admin-auth-changed"));
  }

  if (authState === "checking") {
    return (
      <section className="admin-auth-card is-checking" aria-live="polite">
        <strong>{roleLabel}認証を確認しています</strong>
      </section>
    );
  }

  if (authState === "authenticated") {
    return (
      <section className="admin-auth-card is-authenticated" aria-live="polite">
        <div>
          <p className="admin-section-label">{roleLabel}認証</p>
          <h2>確認済みです</h2>
          <p>
            {authStatus.email ?? "緊急用管理キー"}で{roleLabel}用データを表示しています。
          </p>
          {enableMfaStepUp && authStatus.aal === "aal2" ? (
            <p className="admin-auth-message">多要素認証（AAL2）を確認済みです。</p>
          ) : null}
          {enableMfaStepUp && authStatus.aal === "aal1" ? (
            <div className="admin-auth-form">
              <p>完全削除を実行するには、登録済みの認証アプリで追加確認してください。削除前確認はこのまま利用できます。</p>
              {totpFactors === null ? <p>登録済みの認証アプリを確認しています。</p> : null}
              {totpFactors?.length === 0 ? (
                <div className="admin-auth-warning">
                  <p>認証アプリがまだ登録されていません。初回の本人確認設定を完了してください。</p>
                  <a className="admin-auth-setup-link" href="/admin/delete-requests/setup">
                    認証アプリを登録する
                  </a>
                </div>
              ) : null}
              {totpFactors && totpFactors.length > 0 ? (
                <form
                  className="admin-mfa-challenge-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void verifyMfaCode();
                  }}
                >
                  {totpFactors.length > 1 ? (
                    <label>
                      認証アプリ
                      <select
                        className="input"
                        onChange={(event) => setSelectedFactorId(event.target.value)}
                        value={selectedFactorId}
                      >
                        {totpFactors.map((factor) => (
                          <option key={factor.id} value={factor.id}>{factor.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : <p>{totpFactors[0].label}</p>}
                  <p className="admin-mfa-code-help" id="admin-mfa-code-help">
                    6桁の数字は約30秒ごとに変わります。現在表示されている数字を入力してください。
                  </p>
                  <label htmlFor="admin-mfa-code">6桁の確認コード</label>
                  <input
                    id="admin-mfa-code"
                    className="input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-describedby={mfaMessage
                      ? "admin-mfa-code-help admin-mfa-error"
                      : "admin-mfa-code-help"}
                    aria-invalid={Boolean(mfaMessage) || undefined}
                    maxLength={6}
                    onChange={(event) => {
                      setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      if (mfaMessage) setMfaMessage("");
                    }}
                    pattern="[0-9]{6}"
                    ref={mfaCodeInputRef}
                    required
                    type="text"
                    value={mfaCode}
                  />
                  <button
                    className="secondary"
                    disabled={verifyingMfa || mfaCode.length !== 6}
                    type="submit"
                  >
                    {verifyingMfa ? "確認しています" : "多要素認証を確認する"}
                  </button>
                </form>
              ) : null}
              {mfaMessage ? (
                <p className="admin-auth-message is-error" id="admin-mfa-error" role="alert">{mfaMessage}</p>
              ) : null}
            </div>
          ) : null}
          {message ? <p className="admin-auth-message">{message}</p> : null}
        </div>
        <button className="admin-text-button" disabled={verifyingMfa} type="button" onClick={signOut}>ログアウト</button>
      </section>
    );
  }

  return (
    <section className="admin-auth-card" aria-live="polite">
      <div className="admin-auth-intro">
        <p className="admin-section-label">最初に1回だけ</p>
        <h2>{roleLabel}メールを確認します</h2>
        <p>
          {roleLabel}として登録済みのメールアドレスへ確認メールを送ります。
          メール内のリンクを開くと、回答や利用状況が表示されます。
        </p>
      </div>
      {authState === "denied" && (
        <div className="admin-auth-warning">
          <p>現在のログインでは{roleLabel}権限を確認できませんでした。</p>
          {enableMfaStepUp && !showEmergencyToken ? (
            <p>
              招待を受け取った初回設定中の方は、先に
              <a className="admin-auth-inline-link" href="/admin/delete-requests/setup">本人確認設定</a>
              を完了してください。
            </p>
          ) : (
            <p>登録済みのメールで確認してください。</p>
          )}
        </div>
      )}
      <form
        className="admin-auth-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void sendLink();
        }}
      >
        <label htmlFor="admin-email">{roleLabel}メールアドレス</label>
        <input
          id="admin-email"
          className="input"
          type="email"
          autoComplete="email"
          enterKeyHint="send"
          aria-describedby={emailError ? "admin-email-error" : undefined}
          aria-invalid={Boolean(emailError) || undefined}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailError) {
              setEmailError("");
              setMessage("");
            }
          }}
          placeholder="name@example.com"
          ref={emailInputRef}
          required
        />
        <button className="button" type="submit" disabled={sending}>
          {sending ? "送信しています" : "確認メールを送る"}
        </button>
      </form>
      {message && (
        <p
          className={`admin-auth-message${emailError ? " is-error" : ""}`}
          id={emailError ? "admin-email-error" : undefined}
          role={emailError ? "alert" : undefined}
        >
          {message}
        </p>
      )}
      {showEmergencyToken ? (
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
      ) : null}
    </section>
  );
}
