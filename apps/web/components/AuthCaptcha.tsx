"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_CAPTCHA_MAX_AGE_MS, createAuthCaptchaTokenStore, getAuthCaptchaConfig } from "@/lib/authCaptcha";

type Turnstile = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
let scriptReady: Promise<Turnstile> | null = null;
function loadTurnstile() {
  const existing = (window as Window & { turnstile?: Turnstile }).turnstile;
  if (existing) return Promise.resolve(existing);
  if (!scriptReady) scriptReady = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      scriptReady = null;
      reject(new Error("安全確認を読み込めませんでした。"));
    };
    const timer = window.setTimeout(fail, 15_000);
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      const api = (window as Window & { turnstile?: Turnstile }).turnstile;
      if (!api) { fail(); return; }
      window.clearTimeout(timer);
      resolve(api);
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptReady;
}

/** Widget success only supplies a token; it never sends a form or email. */
export function TurnstileCheck({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("安全確認をしています…");
  const [canRetry, setCanRetry] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let widget: string | undefined;
    let api: Turnstile | undefined;
    callback.current("");
    setCanRetry(false);
    setMessage("安全確認をしています…");
    const invalidate = (message: string) => {
      if (cancelled) return;
      callback.current("");
      setMessage(message);
      setCanRetry(true);
    };
    void loadTurnstile().then((loaded) => {
      if (cancelled || !host.current) return;
      api = loaded;
      widget = api.render(host.current, {
        sitekey: siteKey, size: "compact", language: "ja", appearance: "interaction-only",
        callback: (token: string) => {
          if (cancelled) return;
          callback.current(token);
          setCanRetry(false);
          setMessage("安全確認ができました。送信ボタンを押してください。");
        },
        "expired-callback": () => invalidate("安全確認の期限が切れました。下のボタンでやり直してください。"),
        "timeout-callback": () => invalidate("安全確認が時間切れになりました。もう一度お試しください。"),
        "error-callback": () => { invalidate("安全確認に接続できませんでした。通信を確認してやり直してください。"); return true; }
      });
    }).catch(() => invalidate("安全確認を読み込めませんでした。通信を確認してやり直してください。"));
    return () => {
      cancelled = true;
      callback.current("");
      if (api && widget) api.remove(widget);
    };
  }, [siteKey, attempt]);
  return <div className="consult-guest-check" style={{ gridColumn: "1 / -1" }}><div ref={host} /><p role="status">{message}</p>
    {canRetry ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>安全確認をやり直す</button> : null}
  </div>;
}

export function useAuthCaptcha() {
  const { siteKey } = getAuthCaptchaConfig();
  const store = useRef(createAuthCaptchaTokenStore());
  const [tokenReady, setTokenReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (expiryTimer.current !== null) clearTimeout(expiryTimer.current);
    expiryTimer.current = null;
  }, []);
  const reset = useCallback(() => {
    clearTimer();
    store.current.clear();
    setTokenReady(false);
    setAttempt((value) => value + 1);
  }, [clearTimer]);
  const acceptToken = useCallback((token: string) => {
    clearTimer();
    store.current.accept(token);
    const ready = Boolean(store.current.peek());
    setTokenReady(ready);
    if (ready) expiryTimer.current = setTimeout(reset, AUTH_CAPTCHA_MAX_AGE_MS);
  }, [clearTimer, reset]);
  useEffect(() => () => { clearTimer(); store.current.clear(); }, [clearTimer]);
  const consumeToken = useCallback(() => {
    if (!siteKey) return undefined;
    const token = store.current.consume();
    reset();
    return token;
  }, [siteKey, reset]);
  return { siteKey, required: Boolean(siteKey), ready: !siteKey || tokenReady, attempt, acceptToken, consumeToken, reset };
}

export function AuthCaptcha({ control }: { control: ReturnType<typeof useAuthCaptcha> }) {
  return control.siteKey ? <TurnstileCheck key={control.attempt} siteKey={control.siteKey} onToken={control.acceptToken} /> : null;
}
