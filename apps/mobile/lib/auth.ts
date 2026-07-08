import * as Linking from "expo-linking";
import { getSupabase } from "./supabase";

const DEFAULT_REDIRECT_PATH = "/(tabs)/dashboard";

function getAuthParams(url: string) {
  const [, queryAndHash = ""] = url.split("?");
  const [query = "", hash = ""] = queryAndHash.split("#");
  const hashOnly = url.includes("#") ? url.split("#")[1] ?? "" : hash;
  return new URLSearchParams([query, hashOnly].filter(Boolean).join("&"));
}

function sanitizeRedirectPath(redirectPath: string) {
  if (redirectPath === DEFAULT_REDIRECT_PATH) return redirectPath;

  if (redirectPath.startsWith("/invite?")) {
    const params = new URLSearchParams(redirectPath.slice("/invite?".length));
    const token = params.get("token") ?? "";
    if (/^[A-Za-z0-9_-]{16,160}$/.test(token)) {
      return `/invite?token=${encodeURIComponent(token)}`;
    }
  }

  if (redirectPath.startsWith("/handoff?")) {
    const params = new URLSearchParams(redirectPath.slice("/handoff?".length));
    const caseId = params.get("caseId") ?? "";
    const token = params.get("token") ?? "";
    const isCaseIdSafe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId);
    const isTokenSafe = /^handoff_(?:[a-f0-9]{48}|[a-f0-9]{12}_[a-f0-9]{48})$/i.test(token);

    if (isCaseIdSafe && isTokenSafe) {
      return `/handoff?${new URLSearchParams({ caseId, token }).toString()}`;
    }
  }

  return DEFAULT_REDIRECT_PATH;
}

export async function sendMagicLink(email: string, redirectPath = DEFAULT_REDIRECT_PATH) {
  const supabase = getSupabase();
  if (!supabase) {
    return { sent: false, demo: true, message: "ログイン準備中です。見本画面で確認できます。" };
  }

  const redirectTo = Linking.createURL(sanitizeRedirectPath(redirectPath));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo
    }
  });

  if (error) {
    return { sent: false, demo: false, message: error.message };
  }

  return { sent: true, demo: false, message: "Magic Linkを送信しました。メールを確認してください。" };
}

export async function handleAuthRedirectUrl(url: string) {
  const supabase = getSupabase();
  if (!supabase) return { handled: false, message: "Supabase is not configured." };

  const params = getAuthParams(url);
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error
      ? { handled: false, message: error.message }
      : { handled: true, message: "Magic Link session restored." };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    return error
      ? { handled: false, message: error.message }
      : { handled: true, message: "Magic Link session restored." };
  }

  return { handled: false, message: "No auth parameters found." };
}
