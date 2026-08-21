"use client";

import { useEffect, useState } from "react";
import { completeBrowserSupabaseAuthFromUrl, getBrowserSupabase, sendMagicLink } from "@/lib/browserSupabase";

type State =
  | "checking"
  | "unavailable"
  | "signed-out"
  | "sending"
  | "sent"
  | "ready"
  | "opening"
  | "already"
  | "error";

export function PlusUpgrade() {
  const [state, setState] = useState<State>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<"success" | "cancel" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const params = new URLSearchParams(window.location.search);
      const plus = params.get("plus");
      if (plus === "success" || plus === "cancel") setOutcome(plus);

      const client = getBrowserSupabase();
      if (!client) {
        setState("unavailable");
        return;
      }

      await completeBrowserSupabaseAuthFromUrl();
      const { data } = await client.auth.getSession();
      if (cancelled) return;

      const token = data.session?.access_token ?? null;
      setAccessToken(token);
      setState(token ? "ready" : "signed-out");
    }

    void boot();
    return () => { cancelled = true; };
  }, []);

  async function requestSignIn() {
    if (!email.trim()) return;
    setState("sending");
    setMessage("");
    const result = await sendMagicLink(email.trim(), "/plans");
    if (result.ok) {
      setState("sent");
    } else {
      setState("signed-out");
      setMessage(result.error ?? "確認メールを送れませんでした。");
    }
  }

  async function openCheckout() {
    if (!accessToken) return;
    setState("opening");
    setMessage("");

    try {
      const response = await fetch("/api/stripe/plus-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json() as { url?: string; message?: string; error?: string };

      if (data.error === "already_plus") {
        setState("already");
        return;
      }

      if (!response.ok || !data.url) {
        setMessage(data.message ?? "決済画面を開けませんでした。");
        setState("error");
        return;
      }

      window.location.href = data.url;
    } catch {
      setMessage("通信できませんでした。");
      setState("error");
    }
  }

  return (
    <section className="plus-upgrade" id="plus">
      {outcome === "success" ? (
        <p className="plus-outcome" role="status">
          お手続きありがとうございます。反映まで少し時間がかかることがあります。
        </p>
      ) : null}
      {outcome === "cancel" ? (
        <p className="plus-note" role="status">手続きは取り消されました。無料のままお使いいただけます。</p>
      ) : null}

      <h2>Plusにする</h2>
      <p>
        2人目以降の対象者、写真・PDFの容量、家族会議用のまとめ、長期相談が広がります。
        まずは無料のまま使ってみて、足りなくなってからで大丈夫です。
      </p>

      {state === "checking" ? <p className="plus-note">読み込み中です</p> : null}

      {state === "unavailable" ? (
        <p className="plus-note">この環境では受付を開いていません。</p>
      ) : null}

      {state === "already" ? (
        <p className="plus-outcome" role="status">この手帳はすでにPlusです。</p>
      ) : null}

      {state === "signed-out" || state === "sending" || state === "sent" ? (
        <>
          <p className="plus-note">Plusは手帳の家族単位です。先にメールで本人確認をします。パスワードは作りません。</p>
          <div className="plus-field">
            <label htmlFor="plus-email">メールアドレス</label>
            <input
              autoComplete="email"
              id="plus-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </div>
          <button
            className="plus-button"
            disabled={state === "sending" || !email.trim()}
            onClick={requestSignIn}
            type="button"
          >
            {state === "sending" ? "送信しています…" : "確認メールを送る"}
          </button>
          {state === "sent" ? (
            <p className="plus-note" role="status">確認メールを送りました。リンクを開くと、この画面に戻ります。</p>
          ) : null}
        </>
      ) : null}

      {state === "ready" || state === "opening" || state === "error" ? (
        <button className="plus-button" disabled={state === "opening"} onClick={openCheckout} type="button">
          {state === "opening" ? "決済画面を開いています…" : "Plusの手続きへ進む"}
        </button>
      ) : null}

      {message ? <p className="plus-error" role="status">{message}</p> : null}

      <p className="plus-note">
        iPhoneのアプリの中からは、Appleの規約により同じ手続きはご利用いただけません。この画面から手続きしてください。
      </p>
    </section>
  );
}
