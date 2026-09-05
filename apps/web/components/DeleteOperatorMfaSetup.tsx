"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_BEARER_TOKEN_STORAGE_KEY } from "@/lib/adminClientAuth";
import {
  beginTotpEnrollmentUsingAal1Token,
  completeBrowserSupabaseAuthFromUrl,
  getBrowserSupabase,
  removeUnverifiedTotpFactorUsingAal1Token,
  sendAdminMagicLink
} from "@/lib/browserSupabase";

type SetupState =
  | "checking"
  | "signed-out"
  | "ready"
  | "enrolling"
  | "challenging"
  | "verified"
  | "blocked"
  | "error";
type IdentityLoadResult = "loaded" | "signed-out" | "error";
type MessageTone = "info" | "success" | "error";
type MessageField = "email" | "verification" | "secret" | null;

type TotpFactor = {
  id: string;
  label: string;
};

type PendingEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type PendingEnrollmentContext = {
  accessToken: string;
  expectedUserId: string;
  factorId: string;
};

const setupRedirectPath = "/admin/delete-requests/setup";
const callbackFailureStorageKey = "oyano.admin.mfa_setup_callback_failed.v1";
const operatorFactorLabel = "親のもしもナビ 削除担当";
const setupOperationTimeoutMs = 12_000;

async function withSetupTimeout<T>(operation: Promise<T>): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("operator setup timed out"));
    }, setupOperationTimeoutMs);
    operation.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

type ListedMfaFactor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
};

function collectTotpFactors(allFactors: readonly ListedMfaFactor[]) {
  const verified = allFactors
    .filter((factor) => factor.factor_type === "totp" && factor.status === "verified")
    .map((factor, index) => ({
      id: factor.id,
      label: factor.friendly_name?.trim().startsWith(operatorFactorLabel)
        ? operatorFactorLabel
        : factor.friendly_name?.trim() || `認証アプリ ${index + 1}`
    }));
  const unverified = allFactors
    .filter((factor) => factor.factor_type === "totp" && factor.status === "unverified")
    .map((factor, index) => ({
      id: factor.id,
      label: factor.friendly_name?.trim().startsWith(operatorFactorLabel)
        ? `未完了の${operatorFactorLabel}`
        : factor.friendly_name?.trim() || `未完了の設定 ${index + 1}`
    }));
  return { verified, unverified };
}

export function DeleteOperatorMfaSetup() {
  const requestGeneration = useRef(0);
  const activeUserId = useRef("");
  const authInitializationPending = useRef(true);
  const enrollmentPendingRef = useRef(false);
  const pendingEnrollmentContextRef = useRef<PendingEnrollmentContext | null>(null);
  const mfaVerificationInFlight = useRef(false);
  const mfaAuthEventTokenDuringVerification = useRef("");
  const statusMessageRef = useRef<HTMLParagraphElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const existingCodeInputRef = useRef<HTMLInputElement | null>(null);
  const enrollmentCodeInputRef = useRef<HTMLInputElement | null>(null);
  const manualSecretInputRef = useRef<HTMLInputElement | null>(null);
  const [setupState, setSetupState] = useState<SetupState>("checking");
  const [accountEmail, setAccountEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [verifiedFactors, setVerifiedFactors] = useState<TotpFactor[]>([]);
  const [unverifiedFactors, setUnverifiedFactors] = useState<TotpFactor[]>([]);
  const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [messageField, setMessageField] = useState<MessageField>(null);
  const [working, setWorking] = useState(false);

  const showMessage = useCallback((
    nextMessage: string,
    tone: MessageTone = "info",
    field: MessageField = null
  ) => {
    setMessage(nextMessage);
    setMessageTone(tone);
    setMessageField(field);
    if (nextMessage && tone === "error" && typeof window !== "undefined") {
      window.setTimeout(() => {
        const fieldTarget = field === "email"
          ? emailInputRef.current
          : field === "verification"
            ? enrollmentCodeInputRef.current ?? existingCodeInputRef.current
            : field === "secret"
              ? manualSecretInputRef.current
              : null;
        const target = fieldTarget ?? statusMessageRef.current;
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 0);
    }
  }, []);

  const clearSensitiveState = useCallback(() => {
    enrollmentPendingRef.current = false;
    pendingEnrollmentContextRef.current = null;
    setPendingEnrollment(null);
    setVerificationCode("");
    setShowSecret(false);
  }, []);

  const showSignedOut = useCallback(() => {
    requestGeneration.current += 1;
    activeUserId.current = "";
    window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
    clearSensitiveState();
    setAccountEmail("");
    setLoginEmail("");
    setVerifiedFactors([]);
    setUnverifiedFactors([]);
    setWorking(false);
    setSetupState("signed-out");
  }, [clearSensitiveState]);

  const loadIdentityAndFactors = useCallback(async (
    initialMessage = ""
  ): Promise<IdentityLoadResult> => {
    const client = getBrowserSupabase();
    const requestId = ++requestGeneration.current;
    window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
    clearSensitiveState();
    showMessage(initialMessage);

    if (!client) {
      setSetupState("error");
      showMessage("本人確認の設定を読み込めませんでした。運営者へ連絡してください。", "error");
      return "error";
    }

    const { data: userData, error: userError } = await client.auth.getUser();
    if (requestId !== requestGeneration.current) return "error";
    if (userError || !userData.user) {
      showSignedOut();
      return "signed-out";
    }
    if (!userData.user.email_confirmed_at) {
      activeUserId.current = userData.user.id;
      setAccountEmail(userData.user.email ?? "");
      setSetupState("error");
      showMessage("メール確認がまだ完了していません。招待メール内のリンクを先に開いてください。", "error");
      return "error";
    }

    const { data: factorData, error: factorError } = await client.auth.mfa.listFactors();
    if (requestId !== requestGeneration.current) return "error";
    if (factorError || !factorData) {
      setSetupState("error");
      showMessage("認証アプリの登録状態を確認できませんでした。時間をおいてやり直してください。", "error");
      return "error";
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (requestId !== requestGeneration.current) return "error";
    if (sessionError || !sessionData.session || sessionData.session.user.id !== userData.user.id) {
      setSetupState("error");
      showMessage("現在のログイン情報を確認できませんでした。確認メールからもう一度開いてください。", "error");
      return "error";
    }
    const candidateAccessToken = sessionData.session.access_token;
    const { data: assuranceData, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(candidateAccessToken);
    if (requestId !== requestGeneration.current) return "error";
    if (assuranceError || !assuranceData) {
      setSetupState("error");
      showMessage("本人確認の強さを確認できませんでした。時間をおいてやり直してください。", "error");
      return "error";
    }

    const { verified, unverified } = collectTotpFactors(factorData.all);

    activeUserId.current = userData.user.id;
    setAccountEmail(userData.user.email ?? "");
    setVerifiedFactors(verified);
    setUnverifiedFactors(unverified);
    if (verified.length > 1) {
      setSetupState("blocked");
      showMessage("確認済みの認証アプリが複数あります。削除担当権限を付ける前に運営者へ連絡してください。", "error");
    } else if (verified.length === 1) {
      if (assuranceData.currentLevel === "aal2") {
        window.localStorage.setItem(ADMIN_BEARER_TOKEN_STORAGE_KEY, candidateAccessToken);
        setSetupState("verified");
      } else {
        setSetupState("challenging");
        showMessage("登録済みの認証アプリに表示される6桁の数字で、現在の本人確認を完了してください。");
      }
    } else {
      setSetupState("ready");
    }
    return "loaded";
  }, [clearSensitiveState, showMessage, showSignedOut]);

  const loadIdentityWithTimeout = useCallback(async (
    initialMessage = ""
  ): Promise<IdentityLoadResult> => {
    setSetupState("checking");
    try {
      return await withSetupTimeout(loadIdentityAndFactors(initialMessage));
    } catch {
      requestGeneration.current += 1;
      window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
      clearSensitiveState();
      setWorking(false);
      setSetupState("error");
      showMessage(
        "本人確認の状態確認に時間がかかっています。通信を確認し、「状態をもう一度確認する」を押してください。",
        "error"
      );
      return "error";
    }
  }, [clearSensitiveState, loadIdentityAndFactors, showMessage]);

  useEffect(() => {
    let cancelled = false;
    const client = getBrowserSupabase();

    async function initialize() {
      window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
      let result: Awaited<ReturnType<typeof completeBrowserSupabaseAuthFromUrl>>;
      try {
        result = await withSetupTimeout(completeBrowserSupabaseAuthFromUrl());
      } catch {
        if (cancelled) return;
        requestGeneration.current += 1;
        window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
        clearSensitiveState();
        authInitializationPending.current = false;
        setWorking(false);
        setSetupState("error");
        showMessage(
          "確認リンクの読み込みに時間がかかっています。通信を確認し、「状態をもう一度確認する」を押してください。",
          "error"
        );
        return;
      }
      if (cancelled) return;

      const callbackFailed = result.handled && (Boolean(result.error) || !result.session);
      const previousCallbackFailed = window.localStorage.getItem(callbackFailureStorageKey) === "1";
      if (callbackFailed || (!result.handled && previousCallbackFailed)) {
        requestGeneration.current += 1;
        activeUserId.current = "";
        window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
        window.localStorage.setItem(callbackFailureStorageKey, "1");
        clearSensitiveState();
        if (cancelled) return;
        authInitializationPending.current = false;
        showSignedOut();
        showMessage("確認リンクを使えませんでした。新しい確認メールを送り、この端末で最新のリンクを開いてください。", "error");
        return;
      }

      if (result.handled && result.session) {
        window.localStorage.removeItem(callbackFailureStorageKey);
      }
      authInitializationPending.current = false;
      await loadIdentityWithTimeout();
    }

    void initialize();
    const authListener = client?.auth.onAuthStateChange((event, session) => {
      if (authInitializationPending.current) return;
      if (window.localStorage.getItem(callbackFailureStorageKey) === "1") {
        window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
        return;
      }
      if (event === "SIGNED_OUT") {
        showSignedOut();
      } else if (session?.access_token) {
        const nextUserId = session.user.id;
        if (nextUserId !== activeUserId.current) {
          window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
          requestGeneration.current += 1;
          activeUserId.current = nextUserId;
          clearSensitiveState();
          setAccountEmail("");
          setVerifiedFactors([]);
          setUnverifiedFactors([]);
          setWorking(false);
          showMessage("ログイン中のアカウントが変わったため、本人確認状態を読み直しています。");
          setSetupState("checking");
          window.setTimeout(() => {
            if (!cancelled) void loadIdentityWithTimeout();
          }, 0);
        } else if (
          mfaVerificationInFlight.current
          && (event === "MFA_CHALLENGE_VERIFIED" || event === "TOKEN_REFRESHED")
        ) {
          mfaAuthEventTokenDuringVerification.current = session.access_token;
          // verifyFactor performs stricter factor-count and current-AAL checks
          // before publishing the shared bearer.
        } else if (event === "TOKEN_REFRESHED" && enrollmentPendingRef.current) {
          // Keep the one-time QR/manual secret visible while the same session
          // refreshes. No shared bearer exists during an unfinished enrollment.
        } else {
          window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
          requestGeneration.current += 1;
          clearSensitiveState();
          setVerifiedFactors([]);
          setUnverifiedFactors([]);
          setWorking(false);
          showMessage("本人確認の状態が変わったため、安全のため読み直しています。");
          setSetupState("checking");
          window.setTimeout(() => {
            if (!cancelled) void loadIdentityWithTimeout();
          }, 0);
        }
      }
    });

    return () => {
      cancelled = true;
      authInitializationPending.current = true;
      requestGeneration.current += 1;
      authListener?.data.subscription.unsubscribe();
    };
  }, [clearSensitiveState, loadIdentityWithTimeout, showMessage, showSignedOut]);

  async function sendLoginLink() {
    const nextEmail = loginEmail.trim();
    if (!nextEmail) {
      showMessage("招待を受け取った個別メールアドレスを入力してください。", "error", "email");
      return;
    }

    const requestId = ++requestGeneration.current;
    setWorking(true);
    showMessage("");
    const result = await sendAdminMagicLink(nextEmail, setupRedirectPath);
    if (requestId !== requestGeneration.current) return;
    setWorking(false);
    showMessage(
      result.ok
        ? "確認メールを送りました。この端末でメール内のリンクを開いてください。"
        : result.error ?? "確認メールを送れませんでした。",
      result.ok ? "success" : "error",
      result.ok ? null : "email"
    );
  }

  async function beginEnrollment() {
    if (verifiedFactors.length > 0) {
      await loadIdentityWithTimeout();
      return;
    }
    const client = getBrowserSupabase();
    if (!client) {
      showMessage("認証アプリの登録を開始できませんでした。", "error");
      return;
    }

    const requestId = ++requestGeneration.current;
    setWorking(true);
    showMessage("");
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (requestId !== requestGeneration.current) return;
    if (sessionError || !sessionData.session || sessionData.session.user.id !== activeUserId.current) {
      setWorking(false);
      showMessage("現在のログイン情報を確認できませんでした。状態をもう一度確認してください。", "error");
      return;
    }
    const enrollmentAccessToken = sessionData.session.access_token;
    const enrollmentUserId = sessionData.session.user.id;
    const enrollmentResult = await beginTotpEnrollmentUsingAal1Token({
      accessToken: enrollmentAccessToken,
      expectedUserId: enrollmentUserId,
      friendlyName: `${operatorFactorLabel} ${Date.now()}`
    });
    if (!enrollmentResult.ok) {
      if (requestId !== requestGeneration.current) return;
      setWorking(false);
      showMessage("認証アプリの登録を安全に開始できませんでした。状態をもう一度確認してください。", "error");
      return;
    }
    const cleanupContext = {
      accessToken: enrollmentAccessToken,
      expectedUserId: enrollmentUserId,
      factorId: enrollmentResult.enrollment.factorId
    };
    if (requestId !== requestGeneration.current) {
      void removeUnverifiedTotpFactorUsingAal1Token(cleanupContext);
      return;
    }
    setWorking(false);

    setPendingEnrollment({
      factorId: enrollmentResult.enrollment.factorId,
      qrCode: enrollmentResult.enrollment.qrCode,
      secret: enrollmentResult.enrollment.secret
    });
    pendingEnrollmentContextRef.current = cleanupContext;
    enrollmentPendingRef.current = true;
    setVerificationCode("");
    setShowSecret(false);
    setSetupState("enrolling");
  }

  async function cancelEnrollment() {
    const cleanupContext = pendingEnrollmentContextRef.current;
    const requestId = ++requestGeneration.current;
    clearSensitiveState();
    setSetupState("checking");
    setWorking(true);
    const cleanupResult = cleanupContext
      ? await removeUnverifiedTotpFactorUsingAal1Token(cleanupContext)
      : "absent";
    if (requestId !== requestGeneration.current) return;
    setWorking(false);
    const cleanupMessage = cleanupResult === "removed" || cleanupResult === "absent"
      ? "設定を中断し、この画面で始めた未完了の登録だけを取り消しました。"
      : cleanupResult === "protected"
        ? "別の画面で本人確認済みになった可能性があるため、登録を削除せず安全に停止しました。"
        : "未完了の登録を取り消せませんでした。新しい登録を試せますが、繰り返し失敗する場合は運営者へ連絡してください。";
    await loadIdentityWithTimeout(cleanupMessage);
  }

  async function verifyFactor(factorId: string, newlyEnrolled: boolean) {
    const code = verificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      showMessage("認証アプリに表示された6桁の数字を入力してください。", "error", "verification");
      return;
    }

    const client = getBrowserSupabase();
    if (!client) {
      showMessage("確認コードを検証できませんでした。", "error");
      return;
    }

    const requestId = ++requestGeneration.current;
    window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
    mfaVerificationInFlight.current = true;
    mfaAuthEventTokenDuringVerification.current = "";
    setWorking(true);
    showMessage("");
    try {
      const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (requestId !== requestGeneration.current) return;
      if (error || !data?.access_token) {
        setWorking(false);
        showMessage("6桁の数字を確認できませんでした。認証アプリの新しい数字でやり直してください。", "error", "verification");
        return;
      }

      clearSensitiveState();
      setSetupState("checking");
      const { data: factorData, error: factorError } = await client.auth.mfa.listFactors();
      if (requestId !== requestGeneration.current) return;
      const { data: assuranceData, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(data.access_token);
      if (requestId !== requestGeneration.current) return;
      if (factorError || assuranceError || !factorData || !assuranceData) {
        setWorking(false);
        setSetupState("error");
        showMessage("認証アプリの確認状態を確定できませんでした。画面を再読み込みして状態を確認してください。", "error");
        return;
      }

      const { verified, unverified } = collectTotpFactors(factorData.all);
      const sameVerifiedFactor = verified.some((factor) => factor.id === factorId);
      setVerifiedFactors(verified);
      setUnverifiedFactors(unverified);
      setWorking(false);
      if (verified.length > 1) {
        setSetupState("blocked");
        showMessage("確認済みの認証アプリが複数あります。削除担当権限を付ける前に運営者へ連絡してください。", "error");
        return;
      }
      if (!sameVerifiedFactor || verified.length !== 1) {
        setSetupState("error");
        showMessage("確認した認証アプリを特定できませんでした。状態をもう一度確認してください。", "error");
        return;
      }
      if (assuranceData.currentLevel !== "aal2") {
        setSetupState("challenging");
        showMessage("現在の本人確認を完了できませんでした。認証アプリの新しい6桁の数字でやり直してください。", "error", "verification");
        return;
      }
      if (
        mfaAuthEventTokenDuringVerification.current
        && mfaAuthEventTokenDuringVerification.current !== data.access_token
      ) {
        setSetupState("error");
        showMessage("確認中にログイン状態が変わりました。安全のため状態をもう一度確認してください。", "error");
        return;
      }

      window.localStorage.setItem(ADMIN_BEARER_TOKEN_STORAGE_KEY, data.access_token);
      setSetupState("verified");
      showMessage(
        newlyEnrolled
          ? "認証アプリの登録と6桁の数字の確認が完了しました。"
          : "登録済みの認証アプリで、現在の本人確認が完了しました。",
        "success"
      );
      window.dispatchEvent(new Event("admin-auth-changed"));
    } finally {
      mfaVerificationInFlight.current = false;
      mfaAuthEventTokenDuringVerification.current = "";
    }
  }

  async function verifyEnrollment() {
    if (!pendingEnrollment) {
      showMessage("認証アプリの設定状態をもう一度確認してください。", "error");
      return;
    }
    await verifyFactor(pendingEnrollment.factorId, true);
  }

  async function verifyExistingFactor() {
    if (verifiedFactors.length !== 1) {
      await loadIdentityWithTimeout();
      return;
    }
    await verifyFactor(verifiedFactors[0].id, false);
  }

  async function copyManualSecret() {
    if (!pendingEnrollment) return;
    const requestId = requestGeneration.current;
    const secret = pendingEnrollment.secret;
    setWorking(true);
    try {
      await navigator.clipboard.writeText(secret);
      if (requestId !== requestGeneration.current || !enrollmentPendingRef.current) {
        try {
          await navigator.clipboard.writeText("認証設定は取り消されました");
        } catch {
          // The secret is already removed from this page. Clipboard cleanup is best effort.
        }
        return;
      }
      setWorking(false);
      showMessage("手入力用コードをコピーしました。認証アプリへ貼り付け、登録後は別の文字をコピーして上書きしてください。", "success");
    } catch {
      if (requestId !== requestGeneration.current || !enrollmentPendingRef.current) return;
      setWorking(false);
      setShowSecret(true);
      showMessage("自動でコピーできませんでした。表示したコードを長押ししてコピーしてください。", "error", "secret");
    }
  }

  async function signOut() {
    const client = getBrowserSupabase();
    requestGeneration.current += 1;
    mfaVerificationInFlight.current = false;
    clearSensitiveState();
    setWorking(true);
    window.localStorage.removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);
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
      setWorking(false);
      setSetupState("error");
      showMessage("ログアウト完了を確認できませんでした。通信を確認してもう一度押すか、このブラウザを閉じてください。", "error");
    } else {
      showSignedOut();
      showMessage("本人確認設定からログアウトしました。未完了の設定がある場合は、次回ログイン後に明示的に取り消せます。", "success");
    }
  }
  const statusMessage = message ? (
    <p
      className={`admin-auth-message is-${messageTone}`}
      id="operator-setup-status"
      ref={statusMessageRef}
      role={messageTone === "error" ? "alert" : "status"}
      tabIndex={messageTone === "error" && messageField === null ? -1 : undefined}
    >
      {message}
    </p>
  ) : null;

  if (setupState === "checking") {
    return (
      <section className="admin-auth-card is-checking" aria-live="polite">
        <strong>本人確認の状態を確認しています</strong>
      </section>
    );
  }

  if (setupState === "signed-out") {
    return (
      <section className="admin-auth-card admin-mfa-setup">
        <div className="admin-auth-intro">
          <p className="admin-section-label">手順1</p>
          <h2>個別メールで本人確認します</h2>
          <p>招待を受け取った個別メールへ確認リンクを送ります。共有メールは使わないでください。</p>
        </div>
        <form
          className="admin-auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendLoginLink();
          }}
        >
          <label htmlFor="operator-setup-email">招待を受け取ったメールアドレス</label>
          <input
            id="operator-setup-email"
            className="input"
            type="email"
            autoComplete="email"
            aria-describedby={message ? "operator-setup-status" : undefined}
            aria-invalid={messageTone === "error" && messageField === "email" || undefined}
            ref={emailInputRef}
            required
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <button className="button" type="submit" disabled={working}>
            {working ? "送信しています" : "確認メールを送る"}
          </button>
        </form>
        {statusMessage}
      </section>
    );
  }

  return (
    <section className="admin-auth-card admin-mfa-setup">
      <div className="admin-mfa-setup-heading">
        <div>
          <p className="admin-section-label">本人確認中のアカウント</p>
          <h2>{accountEmail || "アカウントを確認できません"}</h2>
        </div>
        <button className="admin-mfa-signout" type="button" disabled={working} onClick={() => void signOut()}>
          ログアウト
        </button>
      </div>

      <div className="admin-auth-warning">
        この設定だけでは削除権限は付きません。認証アプリの確認後に、運営側で本人と権限を別々に確認します。
      </div>

      {statusMessage}

      {setupState === "error" ? (
        <div className="admin-mfa-actions">
          <button className="secondary" type="button" disabled={working} onClick={() => void loadIdentityWithTimeout()}>
            状態をもう一度確認する
          </button>
        </div>
      ) : null}

      {setupState === "blocked" ? (
        <div className="admin-mfa-incomplete">
          <h3>ここでは設定を進められません</h3>
          <p>確認済みの認証アプリが複数あるため、安全確認が必要です。どの認証アプリも削除せず、運営者へ連絡してください。</p>
        </div>
      ) : null}

      {setupState === "ready" ? (
        <div className="admin-mfa-step-card">
          <p className="admin-section-label">手順2</p>
          <h3>認証アプリを1台登録します</h3>
          <ol className="admin-mfa-steps">
            <li>Google AuthenticatorやMicrosoft Authenticatorなどの認証アプリを用意します。</li>
            <li>別の端末で開いている場合はQRコード、このスマホだけで設定する場合は手入力用コードを使えます。</li>
            <li>認証アプリに出た6桁の数字を、この画面へ入力します。</li>
          </ol>
          {unverifiedFactors.length > 0 ? (
            <div className="admin-mfa-incomplete">
              <p>
                前回途中で止まった設定が{unverifiedFactors.length}件あります。未完了なので本人確認には使われません。
                別タブで完了した設定を誤って消さないため、この画面では自動削除せず、新しい登録を始めます。
              </p>
            </div>
          ) : null}
          <button className="button" type="button" disabled={working} onClick={() => void beginEnrollment()}>
            {working ? "準備しています" : "認証アプリの登録を始める"}
          </button>
        </div>
      ) : null}

      {setupState === "challenging" && verifiedFactors.length === 1 ? (
        <form
          className="admin-mfa-step-card"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyExistingFactor();
          }}
        >
          <p className="admin-section-label">手順2</p>
          <h3>登録済みの認証アプリで本人確認</h3>
          <p id="operator-existing-mfa-help">
            認証アプリに表示される6桁の数字は約30秒ごとに変わります。現在表示されている数字を入力してください。
          </p>
          <label htmlFor="operator-existing-mfa-code">認証アプリに表示された6桁の数字</label>
          <input
            id="operator-existing-mfa-code"
            className="input admin-mfa-verification-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-describedby={message
              ? "operator-existing-mfa-help operator-setup-status"
              : "operator-existing-mfa-help"}
            aria-invalid={messageTone === "error" && messageField === "verification" || undefined}
            pattern="[0-9]{6}"
            maxLength={6}
            ref={existingCodeInputRef}
            required
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button
            className="button"
            type="submit"
            disabled={working || verificationCode.length !== 6}
          >
            {working ? "確認しています" : "6桁の数字で本人確認する"}
          </button>
        </form>
      ) : null}

      {setupState === "enrolling" && pendingEnrollment ? (
        <div className="admin-mfa-step-card">
          <p className="admin-section-label">手順3</p>
          <h3>認証アプリへ登録し、6桁の数字を入力</h3>
          <p>QRコードや手入力用コードは、ほかの人へ送ったりスクリーンショットで共有したりしないでください。</p>
          <p>登録を確定すると、このアカウントで開いているほかの端末やブラウザからログアウトされる場合があります。</p>
          <div className="admin-mfa-enrollment">
            <div className="admin-mfa-method-card">
              <h4>このスマホだけで設定する場合</h4>
              <ol className="admin-mfa-manual-steps">
                <li>下の「手入力用コードをコピー」を押します。</li>
                <li>認証アプリの「＋」から「セットアップキーを入力」を選び、貼り付けます。</li>
                <li>アカウント名は「親のもしもナビ 削除担当」、キーの種類は「時間ベース」を選びます。</li>
              </ol>
              <dl className="admin-mfa-manual-values">
                <div><dt>アカウント名</dt><dd>親のもしもナビ 削除担当</dd></div>
                <div><dt>キーの種類</dt><dd>時間ベース</dd></div>
              </dl>
              <label htmlFor="operator-mfa-secret">認証アプリへ手入力するコード</label>
              <input
                id="operator-mfa-secret"
                className="input admin-mfa-secret"
                type={showSecret ? "text" : "password"}
                readOnly
                autoComplete="off"
                aria-describedby={messageTone === "error" && messageField === "secret"
                  ? "operator-setup-status"
                  : undefined}
                ref={manualSecretInputRef}
                value={pendingEnrollment.secret}
              />
              <div className="admin-mfa-inline-actions">
                <button
                  className="admin-inline-button"
                  type="button"
                  disabled={working}
                  onClick={() => setShowSecret((value) => !value)}
                >
                  {showSecret ? "コードを隠す" : "コードを表示する"}
                </button>
                <button
                  className="admin-inline-button"
                  type="button"
                  disabled={working}
                  onClick={() => void copyManualSecret()}
                >
                  {working ? "コピーしています" : "手入力用コードをコピー"}
                </button>
              </div>
            </div>
            <div className="admin-mfa-method-card is-qr">
              <h4>別の端末でQRコードを読む場合</h4>
              <p>この画面とは別の端末の認証アプリで読み取ります。</p>
              <img
                className="admin-mfa-qr"
                src={pendingEnrollment.qrCode}
                alt="認証アプリ登録用QRコード"
              />
            </div>
          </div>
          <form
            className="admin-mfa-code-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyEnrollment();
            }}
          >
              <h4>認証アプリに表示された数字を確認</h4>
              <label htmlFor="operator-mfa-code">認証アプリに表示された6桁の数字</label>
              <p className="admin-mfa-code-help" id="operator-mfa-code-help">
                6桁の数字は約30秒ごとに変わります。現在表示されている数字を入力してください。
              </p>
              <input
                id="operator-mfa-code"
                className="input admin-mfa-verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-describedby={message
                  ? "operator-mfa-code-help operator-setup-status"
                  : "operator-mfa-code-help"}
                aria-invalid={messageTone === "error" && messageField === "verification" || undefined}
                pattern="[0-9]{6}"
                maxLength={6}
                ref={enrollmentCodeInputRef}
                required
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button
                className="button"
                type="submit"
                disabled={working || verificationCode.length !== 6}
              >
                {working ? "確認しています" : "6桁の数字を確認する"}
              </button>
          </form>
          <button className="secondary" type="button" disabled={working} onClick={() => void cancelEnrollment()}>
            この設定を中断して戻る
          </button>
        </div>
      ) : null}

      {setupState === "verified" ? (
        <div className="admin-mfa-complete">
          <p className="admin-section-label">認証アプリ</p>
          <h3>認証アプリの登録と本人確認が完了しました</h3>
          <p>登録済み：{verifiedFactors.map((factor) => factor.label).join("、")}</p>
          <p>まだ削除担当権限は付いていません。運営者へ「認証アプリの設定ができた」と伝えてください。</p>
          {unverifiedFactors.length > 0 ? (
            <p>未完了の登録が{unverifiedFactors.length}件残っていますが、本人確認には使われません。安全のため、この画面から自動削除はしません。</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
