"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  completeBrowserSupabaseAuthFromUrl,
  getBrowserSupabase,
  sendMagicLink
} from "@/lib/browserSupabase";

type Phase =
  | "checking"
  | "unavailable"
  | "signed-out"
  | "sending"
  | "sent"
  | "ready"
  | "joining"
  | "joined"
  | "error";

export function InviteAccept({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const client = getBrowserSupabase();
      if (!client) {
        setPhase("unavailable");
        return;
      }

      await completeBrowserSupabaseAuthFromUrl();
      const { data } = await client.auth.getSession();
      if (cancelled) return;

      const sessionToken = data.session?.access_token ?? null;
      setAccessToken(sessionToken);
      setSignedInEmail(data.session?.user?.email ?? null);
      setPhase(sessionToken ? "ready" : "signed-out");
    }

    void boot();
    return () => { cancelled = true; };
  }, []);

  async function requestSignIn() {
    if (!email.trim()) return;
    setPhase("sending");
    setMessage("");
    const result = await sendMagicLink(email.trim(), `/invite/${encodeURIComponent(token)}`);
    if (result.ok) {
      setPhase("sent");
    } else {
      setPhase("signed-out");
      setMessage(result.error ?? "確認メールを送れませんでした。");
    }
  }

  async function join() {
    if (!accessToken) return;
    setPhase("joining");
    setMessage("");

    try {
      const response = await fetch("/api/family/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token })
      });
      const data = await response.json() as { message?: string };

      if (!response.ok) {
        setMessage(data.message ?? "参加できませんでした。");
        setPhase("error");
        return;
      }

      setPhase("joined");
    } catch {
      setMessage("通信できませんでした。電波のよい場所でお試しください。");
      setPhase("error");
    }
  }

  if (phase === "unavailable") {
    return (
      <section className="invite-card">
        <h2>いまは受け取れません</h2>
        <p>この環境ではクラウドの設定が入っていないため、招待を受け取れません。</p>
      </section>
    );
  }

  if (phase === "checking") {
    return <p className="family-loading">読み込み中です</p>;
  }

  if (phase === "joined") {
    return (
      <section className="invite-card is-done">
        <h2>参加しました</h2>
        <p>同じ手帳を見られるようになりました。追加課金は不要です。手帳を開いて、クラウドの控えを読み込んでください。</p>
        <Link className="family-primary" href="/home?cloud=1">手帳を開く</Link>
      </section>
    );
  }

  if (phase === "signed-out" || phase === "sending" || phase === "sent") {
    return (
      <section className="invite-card">
        <h2>招待されたメールアドレスで確認します</h2>
        <p>
          招待メールが届いたアドレスを入れてください。確認メールのリンクを開くと、この画面に戻って参加できます。
          パスワードは作りません。追加課金はありません。
        </p>
        <div className="family-field">
          <label htmlFor="invite-email">メールアドレス</label>
          <input
            autoComplete="email"
            id="invite-email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </div>
        <button
          className="family-primary"
          disabled={phase === "sending" || !email.trim()}
          onClick={requestSignIn}
          type="button"
        >
          {phase === "sending" ? "送信しています…" : "確認メールを送る"}
        </button>
        {phase === "sent" ? (
          <p className="family-note" role="status">確認メールを送りました。メール内のリンクを開いてください。</p>
        ) : null}
        {message ? <p className="family-error" role="status">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="invite-card">
      <h2>この招待を受け取りますか</h2>
      <p>
        {signedInEmail ? `${signedInEmail} として確認済みです。` : "確認済みです。"}
        参加すると、同じ手帳のクラウド控えを見られるようになります。手帳を作った人の家族プランに参加するだけなので、別の支払いは不要です。
      </p>
      <button className="family-primary" disabled={phase === "joining"} onClick={join} type="button">
        {phase === "joining" ? "参加しています…" : "この手帳に参加する"}
      </button>
      {message ? <p className="family-error" role="status">{message}</p> : null}
      <p className="family-note">
        招待されたアドレスと違う場合は参加できません。その時は、招待した家族に送り直してもらってください。
      </p>
    </section>
  );
}
