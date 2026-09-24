import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { getSupabase, createMobileAuthVerifier } from "./supabase";
import { withDevicePushRevoked } from "./notifications";
import { DEFAULT_REDIRECT_PATH, MOBILE_AUTH_CALLBACK, MOBILE_AUTH_MAX_AGE_MS, MOBILE_AUTH_PENDING_KEY, mobileAuthBrowserUrl, normalizeMobileEmail, parseMobileAuthCallback, parsePendingMobileAuth, sanitizeRedirectPath, type PendingMobileAuth } from "./authFlow";

let authBusy = false;
let browserFlight: { state: string; promise: ReturnType<typeof WebBrowser.openAuthSessionAsync> } | null = null;
let completedAuth: { state: string; userId: string; redirectPath: string; expiresAt: number } | null = null;
const retryMessage = "本人確認を完了できませんでした。アプリの元の画面で、もう一度メールの確認を始めてください。";
type MagicLinkResult = { sent: false; demo: false; browserOpened?: boolean; message: string; redirectPath?: string };

async function removePendingIfMatching(state: string) {
  if (authBusy) return;
  authBusy = true;
  try {
    const pending = parsePendingMobileAuth(await SecureStore.getItemAsync(MOBILE_AUTH_PENDING_KEY));
    if (pending?.state === state) await SecureStore.deleteItemAsync(MOBILE_AUTH_PENDING_KEY);
  } finally { authBusy = false; }
}

/** Updated native logins use the Web challenge, also when CAPTCHA is off. */
export async function sendMagicLink(email: string, redirectPath = DEFAULT_REDIRECT_PATH): Promise<MagicLinkResult> {
  if (authBusy || browserFlight) return { sent: false, demo: false, message: "本人確認の準備中です。少しお待ちください。" };
  const supabase = getSupabase();
  if (!supabase) return { sent: false, demo: false, message: "アプリの接続設定が不足しています。最新版のアプリでお試しください。" };
  const normalizedEmail = normalizeMobileEmail(email);
  if (!normalizedEmail) return { sent: false, demo: false, message: "メールアドレスを確認してください。" };
  authBusy = true;
  let prepared: { state: string; browserUrl: string } | null = null;
  try {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const state = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const browserUrl = mobileAuthBrowserUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "", state);
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const pending: PendingMobileAuth = {
      version: 1, state, email: normalizedEmail, createdAt: Date.now(),
      redirectPath: sanitizeRedirectPath(redirectPath), startingUserId: data.session?.user.id ?? null
    };
    await SecureStore.setItemAsync(MOBILE_AUTH_PENDING_KEY, JSON.stringify(pending));
    completedAuth = null;
    prepared = { state, browserUrl };
  } catch {
    return { sent: false, demo: false, message: "本人確認の画面を開けませんでした。通信とアプリの更新を確認して、もう一度お試しください。" };
  } finally { authBusy = false; }

  if (!prepared) return { sent: false, demo: false, message: retryMessage };
  let browserPromise: ReturnType<typeof WebBrowser.openAuthSessionAsync>;
  try {
    browserPromise = WebBrowser.openAuthSessionAsync(prepared.browserUrl, `${MOBILE_AUTH_CALLBACK}?state=${prepared.state}`);
  } catch {
    await removePendingIfMatching(prepared.state).catch(() => undefined);
    return { sent: false, demo: false, message: "本人確認の画面を開けませんでした。通信とアプリの更新を確認して、もう一度お試しください。" };
  }
  const flight = { state: prepared.state, promise: browserPromise };
  browserFlight = flight;
  try {
    const browserResult = await flight.promise;
    if (browserResult.type === "success") {
      const result = await handleAuthRedirectUrl(browserResult.url);
      if (result.handled) return { sent: false, demo: false, browserOpened: true, message: result.message, redirectPath: result.redirectPath };
      return { sent: false, demo: false, browserOpened: true, message: result.message };
    }
    // Android can report dismiss before the email callback is delivered.
    // Keep the pending state until an explicit new attempt, logout, or expiry.
    return { sent: false, demo: false, browserOpened: true, message: "確認画面を閉じました。メールのリンクをこの端末で開くか、元の画面からもう一度お試しください。" };
  } catch {
    await removePendingIfMatching(flight.state).catch(() => undefined);
    return { sent: false, demo: false, message: "本人確認の画面を開けませんでした。通信とアプリの更新を確認して、もう一度お試しください。" };
  } finally {
    if (browserFlight === flight) browserFlight = null;
  }
}

/** Only revoke this installation's session; never delete account or family data. */
export async function signOutThisDevice() {
  if (authBusy) return { ok: false, message: "本人確認の処理中です。完了してからもう一度ログアウトしてください。" };
  authBusy = true;
  try {
    completedAuth = null;
    await SecureStore.deleteItemAsync(MOBILE_AUTH_PENDING_KEY);
    const supabase = getSupabase();
    if (!supabase) return { ok: false, message: "アプリの接続設定を確認できないため、ログアウトを完了できませんでした。" };
    const revoked = await withDevicePushRevoked(() => supabase.auth.signOut({ scope: "local" }));
    if (!revoked.completed) return { ok: false, message: revoked.message };
    const { error } = revoked.result;
    if (error) return { ok: false, message: "ログアウトを完了できませんでした。通信を確認してもう一度お試しください。" };
    return { ok: true, message: "この端末からログアウトしました。" };
  } catch {
    return { ok: false, message: "ログアウトを完了できませんでした。もう一度お試しください。" };
  } finally { authBusy = false; }
}

type AuthRedirectResult = { handled: boolean; message: string; redirectPath?: string };
let activeCallback: { url: string; promise: Promise<AuthRedirectResult> } | null = null;

export function handleAuthRedirectUrl(url: string): Promise<AuthRedirectResult> {
  if (activeCallback) return activeCallback.url === url ? activeCallback.promise : Promise.resolve({ handled: false, message: retryMessage });
  const promise = restoreOrReuseAuthRedirect(url).finally(() => {
    if (activeCallback?.promise === promise) activeCallback = null;
  });
  activeCallback = { url, promise };
  return promise;
}

async function restoreOrReuseAuthRedirect(url: string): Promise<AuthRedirectResult> {
  const callback = parseMobileAuthCallback(url);
  if (!callback) return { handled: false, message: retryMessage };
  const finished = completedAuth;
  if (finished && !callback.error && callback.state === finished.state && Date.now() < finished.expiresAt && !authBusy) {
    try {
      const current = await getSupabase()?.auth.getSession();
      if (!current?.error && current?.data.session?.user.id === finished.userId
        && completedAuth === finished) return { handled: true, message: "本人確認ができました。", redirectPath: finished.redirectPath };
    } catch {
      return { handled: false, message: retryMessage };
    }
  }
  return restoreAuthRedirect(url);
}

async function restoreAuthRedirect(url: string): Promise<AuthRedirectResult> {
  const callback = parseMobileAuthCallback(url);
  if (!callback || authBusy) return { handled: false, message: retryMessage };
  const supabase = getSupabase();
  const verifier = createMobileAuthVerifier();
  if (!supabase || !verifier) return { handled: false, message: retryMessage };
  authBusy = true;
  try {
    const pending = parsePendingMobileAuth(await SecureStore.getItemAsync(MOBILE_AUTH_PENDING_KEY));
    if (!pending) {
      await SecureStore.deleteItemAsync(MOBILE_AUTH_PENDING_KEY);
      return { handled: false, message: retryMessage };
    }
    if (pending.state !== callback.state) return { handled: false, message: retryMessage };
    if (callback.error) {
      await SecureStore.deleteItemAsync(MOBILE_AUTH_PENDING_KEY);
      return { handled: false, message: "確認リンクの期限が切れたか、確認できませんでした。アプリからもう一度お試しください。" };
    }
    const current = await supabase.auth.getSession();
    if (current.error || (current.data.session?.user.id ?? null) !== pending.startingUserId) return { handled: false, message: retryMessage };
    const verified = await verifier.auth.getUser(callback.accessToken);
    const user = verified.data.user;
    if (verified.error || !user?.email || !user.email_confirmed_at || user.is_anonymous
      || normalizeMobileEmail(user.email) !== pending.email
      || (pending.startingUserId !== null && pending.startingUserId !== user.id)) {
      return { handled: false, message: "アプリで入力したメールと本人確認が一致しません。元の画面から同じメールでやり直してください。" };
    }
    // Verify the refresh token belongs to the same user too, so a mixed pair
    // cannot switch identity later during native automatic refresh.
    const refreshed = await verifier.auth.refreshSession({ refresh_token: callback.refreshToken });
    const candidate = refreshed.data.session;
    if (refreshed.error || !candidate || candidate.user.id !== user.id) return { handled: false, message: retryMessage };
    const confirmed = await verifier.auth.getUser(candidate.access_token);
    if (confirmed.error || confirmed.data.user?.id !== user.id
      || !confirmed.data.user.email_confirmed_at || confirmed.data.user.is_anonymous
      || normalizeMobileEmail(confirmed.data.user.email ?? "") !== pending.email) return { handled: false, message: retryMessage };
    const latest = parsePendingMobileAuth(await SecureStore.getItemAsync(MOBILE_AUTH_PENDING_KEY));
    const currentAgain = await supabase.auth.getSession();
    if (latest?.state !== pending.state || currentAgain.error
      || (currentAgain.data.session?.user.id ?? null) !== pending.startingUserId) return { handled: false, message: retryMessage };
    await SecureStore.deleteItemAsync(MOBILE_AUTH_PENDING_KEY);
    const { error } = await supabase.auth.setSession({ access_token: candidate.access_token, refresh_token: candidate.refresh_token });
    if (error) return { handled: false, message: retryMessage };
    completedAuth = { state: pending.state, userId: user.id, redirectPath: pending.redirectPath, expiresAt: pending.createdAt + MOBILE_AUTH_MAX_AGE_MS };
    return { handled: true, message: "本人確認ができました。", redirectPath: pending.redirectPath };
  } catch { return { handled: false, message: retryMessage }; }
  finally { authBusy = false; }
}
