export const AUTH_CAPTCHA_REQUIRED_MESSAGE = "安全確認が終わってから、もう一度確認メールを送ってください。入力したメールアドレスは残っています。";
// Turnstile expires at five minutes; stop locally before that boundary.
export const AUTH_CAPTCHA_MAX_AGE_MS = 4 * 60 * 1000;
export type AuthCaptchaOptions = { captchaToken?: string | null };

export function getAuthCaptchaConfig() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  return { enabled: Boolean(siteKey), siteKey };
}

export function validAuthCaptchaToken(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 2048 ? value.trim() : null;
}

/** Kept in memory only; every send attempt consumes its token exactly once. */
export function createAuthCaptchaTokenStore(now: () => number = Date.now) {
  let current: { token: string; receivedAt: number } | null = null;
  const clear = () => { current = null; };
  const peek = () => {
    if (!current || now() < current.receivedAt || now() - current.receivedAt >= AUTH_CAPTCHA_MAX_AGE_MS) {
      clear();
      return null;
    }
    return current.token;
  };
  return {
    accept(value: string) {
      const token = validAuthCaptchaToken(value);
      current = token ? { token, receivedAt: now() } : null;
    },
    clear,
    peek,
    consume() {
      const token = peek();
      clear();
      return token;
    }
  };
}
