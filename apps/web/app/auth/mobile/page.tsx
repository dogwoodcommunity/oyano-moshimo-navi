"use client";

import { useEffect, useRef, useState } from "react";
import { AuthCaptcha, useAuthCaptcha } from "@/components/AuthCaptcha";
import { mobileAuthStateFromHash, sendMobileMagicLink } from "@/lib/mobileAuth";

export default function MobileAuthPage() {
  const [state, setState] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const initialized = useRef(false);
  const captcha = useAuthCaptcha();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const requestState = mobileAuthStateFromHash(window.location.hash);
    setState(requestState);
    window.history.replaceState(null, "", window.location.pathname);
    if (!requestState) setMessage("アプリのログイン画面から「安全確認をしてメールを送る」を開いてください。");
  }, []);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !state) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await sendMobileMagicLink(email, state, { captchaToken: captcha.consumeToken() });
      setMessage(result.ok
        ? "確認メールを送りました。アプリで入力したものと同じメールを、この端末で開いてください。アプリで確認を始めてから15分以内にリンクを開くと、元の操作へ戻ります。"
        : result.error ?? "確認メールを送れませんでした。もう一度お試しください。");
    } finally { sending.current = false; setBusy(false); }
  }

  return <main className="container" style={{ maxWidth: 640 }}>
    <section className="panel">
      <h1>アプリのメール確認</h1>
      <p>アプリで入力したメールアドレスを、ここにも入力してください。安全確認のあと、メールを送ります。</p>
      <form onSubmit={send}>
        <label htmlFor="mobile-auth-email">メールアドレス</label>
        <input id="mobile-auth-email" type="email" autoComplete="email" autoCapitalize="none" required maxLength={254}
          value={email} onChange={(event) => setEmail(event.target.value)} disabled={!state || busy} />
        {state ? <AuthCaptcha control={captcha} /> : null}
        <button className="primary" type="submit" disabled={!state || busy || !captcha.ready}>
          {busy ? "送信中…" : "確認メールを送る"}
        </button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      <p>ページを閉じた・再読み込みした場合や、メールアドレスを変える場合は、アプリからもう一度始めてください。</p>
    </section>
  </main>;
}
