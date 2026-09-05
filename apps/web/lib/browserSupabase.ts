"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { authErrorMessage } from "@oyano/shared";

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

  if (callbackError || callbackErrorCode || callbackErrorDescription) {
    stripAuthParamsFromUrl(url);
    await clearSessionAfterAuthCallbackFailure(client);
    return {
      handled: true,
      session: null,
      error: callbackErrorCode === "otp_expired"
        ? "確認リンクの期限が切れています。新しい確認メールを送ってください。"
        : "確認リンクを使えませんでした。新しい確認メールを送ってください。"
    };
  }

  try {
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        stripAuthParamsFromUrl(url);
        await clearSessionAfterAuthCallbackFailure(client);
        return { handled: true, session: null, error: error.message };
      }
      stripAuthParamsFromUrl(url);
      return { handled: true, session: data.session };
    }

    if (accessToken || refreshToken) {
      if (!accessToken || !refreshToken) {
        stripAuthParamsFromUrl(url);
        await clearSessionAfterAuthCallbackFailure(client);
        return { handled: true, session: null, error: "ログイン情報が不足しています。" };
      }
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (error) {
        stripAuthParamsFromUrl(url);
        await clearSessionAfterAuthCallbackFailure(client);
        return { handled: true, session: null, error: error.message };
      }
      stripAuthParamsFromUrl(url);
      return { handled: true, session: data.session };
    }
  } catch (error) {
    if (code || accessToken || refreshToken) {
      stripAuthParamsFromUrl(url);
      await clearSessionAfterAuthCallbackFailure(client);
    }
    return { handled: true, session: null, error: error instanceof Error ? error.message : "ログイン確認に失敗しました。" };
  }

  const { data } = await client.auth.getSession();
  return { handled: false, session: data.session };
}

export async function sendNotebookMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  return sendMagicLink(email, "/home?cloud=1");
}

export async function sendAdminMagicLink(
  email: string,
  redirectPath = "/admin/monitor-feedback"
): Promise<{ ok: boolean; error?: string }> {
  const client = getBrowserSupabase();
  if (!client || typeof window === "undefined") {
    return { ok: false, error: "管理者認証の設定がまだありません。" };
  }

  const safeRedirectPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//")
    ? redirectPath
    : "/admin/monitor-feedback";
  const redirectTo = `${window.location.origin}${safeRedirectPath}`;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false
    }
  });

  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
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
export async function sendMagicLink(email: string, redirectPath: string): Promise<{ ok: boolean; error?: string }> {
  const client = getBrowserSupabase();
  if (!client || typeof window === "undefined") {
    return { ok: false, error: "クラウド保存の設定がまだありません。" };
  }

  const redirectTo = `${window.location.origin}${redirectPath}`;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true
    }
  });

  // Supabaseのエラーは英語で返る。そのまま出すと利用者には読めないので日本語へ直す。
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
}

function stripAuthParamsFromUrl(url: URL) {
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}
