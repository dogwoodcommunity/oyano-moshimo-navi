"use client";

import { useEffect, useRef, useState } from "react";

type Turnstile = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
let scriptReady: Promise<Turnstile> | null = null;
function loadTurnstile() {
  if (!scriptReady) scriptReady = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      const api = (window as Window & { turnstile?: Turnstile }).turnstile;
      if (api) resolve(api); else reject(new Error("安全確認を読み込めませんでした。"));
    };
    script.onerror = () => { script.remove(); scriptReady = null; reject(new Error("安全確認に接続できませんでした。")); };
    document.head.appendChild(script);
  });
  return scriptReady;
}

/** Mounted only after the person explicitly selects first-use consent. */
export function ConsultGuestCheck({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [message, setMessage] = useState("安全確認をしています…");
  useEffect(() => {
    let cancelled = false;
    let widget: string | undefined;
    let api: Turnstile | undefined;
    void loadTurnstile().then((loaded) => {
      if (cancelled || !host.current) return;
      api = loaded;
      widget = api.render(host.current, {
        sitekey: siteKey, size: "flexible", language: "ja", appearance: "interaction-only",
        callback: (token: string) => { if (!cancelled) { callback.current(token); setMessage("安全確認ができました。"); } },
        "expired-callback": () => { if (!cancelled) { callback.current(""); setMessage("安全確認の期限が切れました。再確認をお待ちください。"); } },
        "error-callback": () => { if (!cancelled) { callback.current(""); setMessage("安全確認に失敗しました。通信状況を確認し、チェックを入れ直してください。"); } }
      });
    }).catch(() => { if (!cancelled) setMessage("安全確認を読み込めませんでした。通信状況を確認し、チェックを入れ直してください。"); });
    return () => { cancelled = true; if (api && widget) api.remove(widget); };
  }, [siteKey]);
  return <div className="consult-guest-check"><div ref={host} /><p role="status">{message}</p></div>;
}
