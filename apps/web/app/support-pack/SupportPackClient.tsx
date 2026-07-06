"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function SupportPackClient() {
  const params = useSearchParams();
  const caseId = params.get("caseId");
  const [message, setMessage] = useState("");

  async function startCheckout() {
    if (!caseId) return;
    setMessage("申し込み画面を準備しています。");

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId })
    });
    const body = await response.json() as { checkoutUrl?: string; error?: string };

    if (!response.ok || !body.checkoutUrl) {
      if (response.status === 409) {
        setMessage("この整理結果では、すでにサポートパックが申し込み済みです。");
        return;
      }

      setMessage("申し込み画面を開けませんでした。時間をおいてもう一度お試しください。");
      return;
    }

    window.location.href = body.checkoutUrl;
  }

  return (
    <section className="panel handoff-band" style={{ marginTop: 18 }}>
      <h2>申し込み</h2>
      <p className="hint">決済はStripeの安全な画面で行います。申し込み後、管理画面で確認できます。</p>
      <div className="actions">
        <button className="button" disabled={!caseId} onClick={startCheckout}>
          {caseId ? "申し込み画面へ進む" : "整理結果の画面から申し込む"}
        </button>
      </div>
      {message ? <p className="hint">{message}</p> : null}
    </section>
  );
}
