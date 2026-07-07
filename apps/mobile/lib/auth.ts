import * as Linking from "expo-linking";
import { getSupabase } from "./supabase";

function getAuthParams(url: string) {
  const [, queryAndHash = ""] = url.split("?");
  const [query = "", hash = ""] = queryAndHash.split("#");
  const hashOnly = url.includes("#") ? url.split("#")[1] ?? "" : hash;
  return new URLSearchParams([query, hashOnly].filter(Boolean).join("&"));
}

export async function sendMagicLink(email: string, redirectPath = "/(tabs)/dashboard") {
  const supabase = getSupabase();
  if (!supabase) {
    return { sent: false, demo: true, message: "ログイン準備中です。見本画面で確認できます。" };
  }

  const redirectTo = Linking.createURL(redirectPath);
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
