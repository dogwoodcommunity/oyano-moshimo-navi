export const MOBILE_AUTH_CALLBACK = "oyanomoshimo:///auth/complete";
export const MOBILE_AUTH_PENDING_KEY = "oyano.mobile.auth.pending.v1";
export const MOBILE_AUTH_MAX_AGE_MS = 15 * 60 * 1000;
export const DEFAULT_REDIRECT_PATH = "/(tabs)/dashboard";

export type PendingMobileAuth = {
  version: 1; state: string; email: string; createdAt: number;
  redirectPath: string; startingUserId: string | null;
};

export function normalizeMobileEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function sanitizeRedirectPath(redirectPath: string) {
  if (redirectPath === DEFAULT_REDIRECT_PATH) return redirectPath;
  if (redirectPath.startsWith("/invite?")) {
    const params = new URLSearchParams(redirectPath.slice("/invite?".length));
    const token = params.get("token") ?? "";
    if (/^[A-Za-z0-9_-]{16,160}$/.test(token)) return `/invite?token=${encodeURIComponent(token)}`;
  }
  if (redirectPath.startsWith("/handoff?")) {
    const params = new URLSearchParams(redirectPath.slice("/handoff?".length));
    const caseId = params.get("caseId") ?? "";
    const token = params.get("token") ?? "";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId)
      && /^handoff_(?:[a-f0-9]{48}|[a-f0-9]{12}_[a-f0-9]{48})$/i.test(token)) {
      return `/handoff?${new URLSearchParams({ caseId, token }).toString()}`;
    }
  }
  return DEFAULT_REDIRECT_PATH;
}

export function parsePendingMobileAuth(value: string | null, now = Date.now()): PendingMobileAuth | null {
  try {
    const pending = JSON.parse(value ?? "null") as PendingMobileAuth | null;
    if (!pending || pending.version !== 1 || !/^[a-f0-9]{64}$/.test(pending.state)
      || typeof pending.email !== "string" || normalizeMobileEmail(pending.email) !== pending.email
      || !Number.isFinite(pending.createdAt) || now < pending.createdAt || now - pending.createdAt >= MOBILE_AUTH_MAX_AGE_MS
      || typeof pending.redirectPath !== "string" || sanitizeRedirectPath(pending.redirectPath) !== pending.redirectPath
      || !(pending.startingUserId === null || typeof pending.startingUserId === "string" && pending.startingUserId.length > 0)) return null;
    return pending;
  } catch { return null; }
}

export function mobileAuthBrowserUrl(webBaseUrl: string, state: string) {
  const base = new URL(webBaseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash
    || base.pathname !== "/" || !/^[a-f0-9]{64}$/.test(state)) throw new Error("Invalid mobile auth configuration");
  // Only an opaque value leaves the device; fragments do not enter Web logs.
  return `${base.origin}/auth/mobile#state=${state}`;
}

export function parseMobileAuthCallback(url: string) {
  try {
    const parsed = new URL(url);
    if (`${parsed.protocol}//${parsed.host}${parsed.pathname}` !== MOBILE_AUTH_CALLBACK
      || parsed.username || parsed.password || parsed.searchParams.getAll("state").length !== 1) return null;
    const state = parsed.searchParams.get("state") ?? "";
    if (!/^[a-f0-9]{64}$/.test(state)) return null;
    const hash = new URLSearchParams(parsed.hash.slice(1));
    const error = parsed.searchParams.has("error") || parsed.searchParams.has("error_code") || hash.has("error") || hash.has("error_code");
    if (error) return { state, error: true as const };
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");
    if (hash.getAll("access_token").length !== 1 || hash.getAll("refresh_token").length !== 1
      || !accessToken || !refreshToken || accessToken.length > 16384 || refreshToken.length > 4096
      || (type !== "magiclink" && type !== "signup")) return null;
    return { state, error: false as const, accessToken, refreshToken };
  } catch { return null; }
}
