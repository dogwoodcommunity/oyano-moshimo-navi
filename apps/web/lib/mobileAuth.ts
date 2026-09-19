import { createClient } from "@supabase/supabase-js";
import { authErrorMessage } from "@oyano/shared";
import { AUTH_CAPTCHA_REQUIRED_MESSAGE, getAuthCaptchaConfig, validAuthCaptchaToken, type AuthCaptchaOptions } from "./authCaptcha";

export const MOBILE_EMAIL_CALLBACK = "oyanomoshimo:///auth/complete";

export function mobileAuthStateFromHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const state = params.get("state");
  return params.getAll("state").length === 1 && state && /^[a-f0-9]{64}$/.test(state) ? state : null;
}

export async function sendMobileMagicLink(emailInput: string, state: string, options: AuthCaptchaOptions = {}) {
  const email = emailInput.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(state)) return { ok: false, error: "アプリから本人確認をやり直してください。" };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "メールアドレスを確認してください。" };
  const captchaToken = validAuthCaptchaToken(options.captchaToken);
  if (getAuthCaptchaConfig().enabled && !captchaToken) return { ok: false, error: AUTH_CAPTCHA_REQUIRED_MESSAGE };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, error: "本人確認の準備ができていません。時間をおいてお試しください。" };
  // Never load browserSupabase: an existing browser user must not be handed to
  // the native app. This client sends email only and never persists a session.
  try {
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false, flowType: "implicit", storageKey: "oyano-mobile-email-only" }
    });
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${MOBILE_EMAIL_CALLBACK}?state=${state}`, ...(captchaToken ? { captchaToken } : {}) }
    });
    return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
  } catch { return { ok: false, error: "送信結果を確認できませんでした。メールの受信を確認してから、必要なら安全確認をやり直してください。" }; }
}
