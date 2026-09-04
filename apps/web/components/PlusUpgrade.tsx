"use client";

import { useEffect, useState } from "react";
import { completeBrowserSupabaseAuthFromUrl, getBrowserSupabase, sendMagicLink } from "@/lib/browserSupabase";
import { readNotebookCloudBinding } from "@/lib/store";

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

export function PlusUpgrade({ salesReady }: { salesReady: boolean }) {
  const [state, setState] = useState<State>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<"success" | "cancel" | null>(null);
  const [canManageBilling, setCanManageBilling] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyResolved, setFamilyResolved] = useState(false);

  useEffect(() => {
    if (!salesReady) {
      setState("unavailable");
      return;
    }
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
      if (token) {
        try {
          const binding = readNotebookCloudBinding();
          const boundFamilyId = binding && binding.authUserId === data.session?.user.id ? binding.familyId : null;
          const params = new URLSearchParams();
          if (boundFamilyId) params.set("familyId", boundFamilyId);
          const endpoint = params.size > 0 ? `/api/family?${params.toString()}` : "/api/family";
          const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
          if (response.ok) {
            const family = await response.json() as { familyId?: string; isOwner?: boolean };
            if (cancelled) return;
            setCanManageBilling(family.isOwner !== false);
            setFamilyId(family.familyId ?? null);
            setFamilyResolved(Boolean(family.familyId));
          } else {
            const failure = await response.json().catch(() => ({})) as { message?: string };
            if (cancelled) return;
            setMessage(failure.message ?? "手帳の情報を確認できませんでした。");
            setState("error");
            return;
          }
        } catch {
          if (cancelled) return;
          setMessage("手帳の情報を確認できませんでした。通信を確認して、もう一度開いてください。");
          setState("error");
          return;
        }
      }
      if (cancelled) return;
      setState(token ? "ready" : "signed-out");
    }

    void boot();
    return () => { cancelled = true; };
  }, [salesReady]);

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ familyId })
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

      <h2>{canManageBilling ? "Plusにする" : "共有された手帳のプラン"}</h2>
      <p>
        2人目以降の対象者、写真・PDFの容量、家族会議用のまとめ、長期相談が広がります。
        まずは無料のまま使ってみて、足りなくなってからで大丈夫です。
        Plusは家族手帳単位なので、招待された家族が同じ手帳で別に支払う必要はありません。
      </p>

      {state === "checking" ? <p className="plus-note">読み込み中です</p> : null}

      {state === "unavailable" ? (
        <div className="plus-note" role="status">
          <strong>現在は受付準備中です。</strong>
          <p>1人分の手帳、家族1人との共有、毎日の記録、1日1回のAI相談、思い出の手帳PDFは無料のまま使えます。</p>
        </div>
      ) : null}

      {state === "already" ? (
        <p className="plus-outcome" role="status">この手帳はすでにPlusです。</p>
      ) : null}

      {state === "signed-out" || state === "sending" || state === "sent" ? (
        <>
          <p className="plus-note">Plusは手帳を作った人が家族単位で手続きします。招待された家族が共有手帳を見るだけなら、別の支払いは不要です。先にメールで本人確認をします。</p>
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

      {(state === "ready" || state === "opening" || state === "error") && familyResolved ? (
        canManageBilling ? (
          <button className="plus-button" disabled={state === "opening"} onClick={openCheckout} type="button">
            {state === "opening" ? "決済画面を開いています…" : "Plusの手続きへ進む"}
          </button>
        ) : (
          <p className="plus-note" role="status">
            この手帳は作成者がプランを管理しています。招待された家族の追加手続きは不要です。
          </p>
        )
      ) : null}

      {message ? <p className="plus-error" role="status">{message}</p> : null}

      <p className="plus-note">
        iPhoneのアプリの中からは、Appleの規約により同じ手続きはご利用いただけません。招待された家族には、この受付導線を案内しません。
      </p>
    </section>
  );
}
