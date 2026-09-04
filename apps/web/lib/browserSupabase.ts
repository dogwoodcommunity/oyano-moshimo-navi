"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { authErrorMessage } from "@oyano/shared";

let browserClient: SupabaseClient | null = null;

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
  const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
  const refreshToken = url.hash.match(/refresh_token=([^&]+)/)?.[1];

  try {
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) return { handled: true, session: null, error: error.message };
      stripAuthParamsFromUrl(url);
      return { handled: true, session: data.session };
    }

    if (accessToken && refreshToken) {
      const { data, error } = await client.auth.setSession({
        access_token: decodeURIComponent(accessToken),
        refresh_token: decodeURIComponent(refreshToken)
      });
      if (error) return { handled: true, session: null, error: error.message };
      stripAuthParamsFromUrl(url);
      return { handled: true, session: data.session };
    }
  } catch (error) {
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
  url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}
