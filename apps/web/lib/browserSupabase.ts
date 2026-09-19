"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { authErrorMessage } from "@oyano/shared";
import { AUTH_CAPTCHA_REQUIRED_MESSAGE, getAuthCaptchaConfig, validAuthCaptchaToken, type AuthCaptchaOptions } from "@/lib/authCaptcha";

let browserClient: SupabaseClient | null = null;

function clearBrowserSupabaseLocalSession() {
  if (typeof window === "undefined") return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;
  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(`${storageKey}-code-verifier`);
  } catch {
    // 設定URLが壊れていても、callback error自体の処理は止めない。
  }
}

async function clearSessionAfterAuthCallbackFailure(client: SupabaseClient) {
  clearBrowserSupabaseLocalSession();
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // localStorageは先に消してあるため、古いセッションへの復帰は防げている。
  }
}

export async function discardBrowserSupabaseAuthCallback(): Promise<void> {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  stripAuthParamsFromUrl(url);
  clearBrowserSupabaseLocalSession();
  let client: SupabaseClient | null;
  try {
    client = getBrowserSupabase();
  } catch {
    return;
  }
  if (!client) {
    return;
  }
  await clearSessionAfterAuthCallbackFailure(client);
}

export function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true
      }
    });
  }

  return browserClient;
}

export async function completeBrowserSupabaseAuthFromUrl(): Promise<{
  handled: boolean;
  session: Session | null;
  error?: string;
}> {
  const client = getBrowserSupabase();
  if (!client || typeof window === "undefined") {
    return { handled: false, session: null };
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const callbackError = url.searchParams.get("error") ?? hashParams.get("error");
  const callbackErrorCode = url.searchParams.get("error_code") ?? hashParams.get("error_code");
  const callbackErrorDescription = url.searchParams.get("error_description") ?? hashParams.get("error_description");
  const expectedGuestUserId = url.pathname === "/home" && url.searchParams.get("guest_link") === "1"
    ? url.searchParams.get("guest_user")
    : null;
  if (callbackError || callbackErrorCode || callbackErrorDescription || code || accessToken || refreshToken) {
    // Remove credentials before awaiting Auth; retain parsed values in memory.
    stripAuthParamsFromUrl(url);
  }
  // Email registration upgrades the current guest. A bad/expired link must
  // not discard the guest's only session or switch it to another account.
  const previousGuestSession = expectedGuestUserId
    ? (await client.auth.getSession()).data.session
    : null;
  const recoverableGuestSession = previousGuestSession?.user.id === expectedGuestUserId
    && previousGuestSession.user.is_anonymous === true ? previousGuestSession : null;
  const callbackFailure = async (error: string) => {
    stripAuthParamsFromUrl(url);
    if (recoverableGuestSession) {
      const { data: current } = await client.auth.getSession();
      if (current.session?.user.id === recoverableGuestSession.user.id) {
        return { handled: true, session: current.session, error };
      }
      const { data, error: restoreError } = await client.auth.setSession({
        access_token: recoverableGuestSession.access_token,
        refresh_token: recoverableGuestSession.refresh_token
      });
      if (!restoreError && data.session?.user.id === recoverableGuestSession.user.id) {
        return { handled: true, session: data.session, error };
      }
    }
    await clearSessionAfterAuthCallbackFailure(client);
    return { handled: true, session: null, error };
  };
  const callbackSuccess = async (session: Session | null) => {
    if (expectedGuestUserId && session?.user.id !== expectedGuestUserId) {
      return callbackFailure("元のゲストと異なるアカウントの確認リンクです。手帳を別のアカウントへ移していません。元のブラウザからメール登録をやり直してください。");
    }
    stripAuthParamsFromUrl(url);
    return { handled: true, session };
  };

  if (callbackError || callbackErrorCode || callbackErrorDescription) {
    return callbackFailure(callbackErrorCode === "otp_expired"
        ? "確認リンクの期限が切れています。新しい確認メールを送ってください。"
        : "確認リンクを使えませんでした。新しい確認メールを送ってください。");
  }

  try {
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) return callbackFailure(error.message);
      return callbackSuccess(data.session);
    }

    if (accessToken || refreshToken) {
      if (!accessToken || !refreshToken) {
        stripAuthParamsFromUrl(url);
        return callbackFailure("ログイン情報が不足しています。");
      }
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (error) return callbackFailure(error.message);
      return callbackSuccess(data.session);
    }
  } catch (error) {
    if (code || accessToken || refreshToken) {
      return callbackFailure(error instanceof Error ? error.message : "ログイン確認に失敗しました。");
    }
    return { handled: true, session: null, error: error instanceof Error ? error.message : "ログイン確認に失敗しました。" };
  }

  const { data } = await client.auth.getSession();
  return { handled: false, session: data.session };
}

export async function sendNotebookMagicLink(email: string, options: AuthCaptchaOptions = {}): Promise<{ ok: boolean; error?: string }> {
  // A guest may have signed in in another tab before Home has re-rendered.
  // Never let a stale email form create a separate account for that guest.
  const client = getBrowserSupabase();
  if (client) {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) return { ok: false, error: "ログイン状態を確認できません。画面を読み直してから試してください。" };
      if (data.session?.user.is_anonymous === true) {
        return { ok: false, error: "ゲストのログインを確認しました。画面を読み直し、「このゲストにメールを登録する」から登録してください。今の手帳はそのままです。" };
      }
    } catch {
      return { ok: false, error: "ログイン状態を確認できません。画面を読み直してから試してください。" };
    }
  }
  return sendMagicLink(email, "/home?cloud=1", options);
}

export async function linkGuestNotebookEmail(
  email: string,
  expectedUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const client = getBrowserSupabase();
  if (!client || typeof window === "undefined") {
    return { ok: false, error: "メール登録の設定がまだありません。" };
  }
  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const session = sessionData.session;
    if (sessionError || !session || session.user.id !== expectedUserId || session.user.is_anonymous !== true) {
      return { ok: false, error: "ゲストのログイン状態が変わりました。画面を読み直してから登録してください。" };
    }
    const { data: userData, error: userError } = await client.auth.getUser(session.access_token);
    if (userError || userData.user?.id !== expectedUserId || userData.user.is_anonymous !== true) {
      return { ok: false, error: "ゲストの本人確認ができませんでした。今の画面を閉じずに、通信を確認してもう一度試してください。" };
    }
    const { data: latest } = await client.auth.getSession();
    if (latest.session?.user.id !== expectedUserId || latest.session.user.is_anonymous !== true) {
      return { ok: false, error: "確認中にログイン状態が変わりました。メールは送っていません。" };
    }
    const redirectTo = new URL("/home?cloud=1&guest_link=1", window.location.origin);
    redirectTo.searchParams.set("guest_user", expectedUserId);
    const { data, error } = await client.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: redirectTo.toString() }
    );
    if (error) {
      if (["email_exists", "user_already_exists", "identity_already_exists"].includes(error.code ?? "")
          || /already.*(?:registered|exists)|(?:registered|exists).*already/i.test(error.message)) {
        return { ok: false, error: "このメールアドレスは別のアカウントで使われているため登録できません。今のゲストと手帳はそのままです。別のメールアドレスを使ってください。アカウントの切り替えや手帳の統合は行っていません。" };
      }
      return { ok: false, error: authErrorMessage(error) };
    }
    if (data.user?.id !== expectedUserId) {
      return { ok: false, error: "メール登録の対象を確認できませんでした。今の画面を閉じずに、保存先を確認してください。" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "メール登録の通信が完了しませんでした。今の画面を閉じずに、通信を確認してもう一度試してください。" };
  }
}

export async function sendAdminMagicLink(
  email: string,
  redirectPath = "/admin/monitor-feedback",
  options: AuthCaptchaOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const client = getBrowserSupabase();
  if (!client || typeof window === "undefined") {
    return { ok: false, error: "管理者認証の設定がまだありません。" };
  }

  const safeRedirectPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//")
    ? redirectPath
    : "/admin/monitor-feedback";
  const redirectTo = `${window.location.origin}${safeRedirectPath}`;
  return sendOtpWithCaptcha(client, email, redirectTo, false, options);
}

export async function beginTotpEnrollmentUsingAal1Token(input: {
  accessToken: string;
  expectedUserId: string;
  friendlyName: string;
}): Promise<{
  ok: true;
  enrollment: { factorId: string; qrCode: string; secret: string };
} | { ok: false }> {
  const client = getBrowserSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!client || !url || !anonKey || typeof window === "undefined") return { ok: false };

  const { data: assuranceData, error: assuranceError } = await client.auth.mfa
    .getAuthenticatorAssuranceLevel(input.accessToken);
  if (assuranceError || assuranceData?.currentLevel !== "aal1") return { ok: false };
  const { data: userData, error: userError } = await client.auth.getUser(input.accessToken);
  if (userError || !userData.user || userData.user.id !== input.expectedUserId) return { ok: false };

  try {
    const response = await fetch(`${url}/auth/v1/factors`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        factor_type: "totp",
        friendly_name: input.friendlyName
      })
    });
    if (!response.ok) return { ok: false };
    const body = await response.json() as {
      id?: unknown;
      type?: unknown;
      totp?: { qr_code?: unknown; secret?: unknown };
    };
    if (
      typeof body.id !== "string"
      || body.type !== "totp"
      || typeof body.totp?.qr_code !== "string"
      || typeof body.totp.secret !== "string"
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      enrollment: {
        factorId: body.id,
        qrCode: body.totp.qr_code.startsWith("data:")
          ? body.totp.qr_code
          : `data:image/svg+xml;utf-8,${body.totp.qr_code}`,
        secret: body.totp.secret
      }
    };
  } catch {
    return { ok: false };
  }
}

export async function removeUnverifiedTotpFactorUsingAal1Token(input: {
  accessToken: string;
  expectedUserId: string;
  factorId: string;
}): Promise<"removed" | "absent" | "protected" | "error"> {
  const client = getBrowserSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!client || !url || !anonKey || typeof window === "undefined") return "error";

  // Bind cleanup to the AAL1 token that created this enrollment. Supabase
  // requires AAL2 to remove a verified factor, so this token can remove only
  // the unfinished factor and fails closed if another tab verified it first.
  const { data: assuranceData, error: assuranceError } = await client.auth.mfa
    .getAuthenticatorAssuranceLevel(input.accessToken);
  if (assuranceError || assuranceData?.currentLevel !== "aal1") return "protected";

  const { data: userData, error: userError } = await client.auth.getUser(input.accessToken);
  if (userError || !userData.user || userData.user.id !== input.expectedUserId) return "error";
  const factor = userData.user.factors?.find((candidate) => candidate.id === input.factorId);
  if (!factor) return "absent";
  if (factor.factor_type !== "totp" || factor.status !== "unverified") return "protected";

  try {
    const response = await fetch(`${url}/auth/v1/factors/${encodeURIComponent(input.factorId)}`, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${input.accessToken}`
      }
    });
    if (response.ok) return "removed";
    if (response.status === 404) return "absent";
    if (response.status === 401 || response.status === 403) return "protected";
    return "error";
  } catch {
    return "error";
  }
}

/**
 * 確認メールから戻る先を指定できる版。招待の受け取りでは招待ページへ戻す必要がある。
 */
export async function sendMagicLink(email: string, redirectPath: string, options: AuthCaptchaOptions = {}): Promise<{ ok: boolean; error?: string }> {
  const client = getBrowserSupabase();
  if (!client || typeof window === "undefined") {
    return { ok: false, error: "クラウド保存の設定がまだありません。" };
  }

  const redirectTo = `${window.location.origin}${redirectPath}`;
  return sendOtpWithCaptcha(client, email, redirectTo, true, options);
}

async function sendOtpWithCaptcha(
  client: SupabaseClient,
  email: string,
  emailRedirectTo: string,
  shouldCreateUser: boolean,
  options: AuthCaptchaOptions
): Promise<{ ok: boolean; error?: string }> {
  const captchaToken = validAuthCaptchaToken(options.captchaToken);
  if (getAuthCaptchaConfig().enabled && !captchaToken) {
    return { ok: false, error: AUTH_CAPTCHA_REQUIRED_MESSAGE };
  }
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo, shouldCreateUser, ...(captchaToken ? { captchaToken } : {}) }
    });
    return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
  } catch {
    return { ok: false, error: "確認メールの送信結果を確認できませんでした。入力したメールアドレスは残っています。届いたメールを確認し、再送する場合は安全確認をやり直してください。" };
  }
}

function stripAuthParamsFromUrl(url: URL) {
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.searchParams.delete("guest_link");
  url.searchParams.delete("guest_user");
  url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}
