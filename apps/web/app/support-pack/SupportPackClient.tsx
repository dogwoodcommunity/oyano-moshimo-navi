"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function SupportPackClient() {
  const params = useSearchParams();
  const caseId = params.get("caseId");
  const [message, setMessage] = useState("");

  async function startCheckout() {
    if (!caseId) return;
    setMessage("Checkoutを準備しています");

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId })
    });
    const body = await response.json() as { checkoutUrl?: string; error?: string };

    if (!response.ok || !body.checkoutUrl) {
      setMessage(body.error ?? "Stripe Checkoutを開始できませんでした。環境変数を確認してください。");
      return;
    }

    window.location.href = body.checkoutUrl;
  }

  return (
    <section className="panel handoff-band" style={{ marginTop: 18 }}>
      <h2>申し込み</h2>
      <p className="hint">Stripe Checkout Sessionを作成し、決済完了後はWebhookでsupport_packsを更新します。</p>
      <div className="actions">
        <button className="button" disabled={!caseId} onClick={startCheckout}>
          {caseId ? "Stripe Checkoutへ進む" : "結果画面からcase付きで開始"}
        </button>
      </div>
      {message ? <p className="hint">{message}</p> : null}
    </section>
  );
}
