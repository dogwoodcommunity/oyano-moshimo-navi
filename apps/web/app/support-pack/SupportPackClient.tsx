"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getLocalCase } from "@/lib/store";

export function SupportPackClient() {
  const params = useSearchParams();
  const caseId = params.get("caseId");
  const localCase = caseId ? getLocalCase(caseId) : undefined;
  const [contactName, setContactName] = useState(localCase?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(localCase?.contactEmail ?? "");
  const [consentToContact, setConsentToContact] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function startCheckout() {
    if (!caseId) return;
    if (!contactEmail.trim() || !consentToContact) {
      setMessage("申し込みには連絡先メールと連絡同意が必要です。");
      return;
    }

    setSubmitting(true);
    setMessage("申し込み画面を準備しています。");

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        consentToContact
      })
    });
    const body = await response.json() as { checkoutUrl?: string; error?: string };

    if (!response.ok || !body.checkoutUrl) {
      setSubmitting(false);
      if (response.status === 409) {
        setMessage("この整理結果では、すでにサポートパックが申し込み済みです。");
        return;
      }

      setMessage(body.error === "contact_email_and_consent_required"
        ? "連絡先メールと連絡同意を確認してください。"
        : "申し込み画面を開けませんでした。時間をおいてもう一度お試しください。");
      return;
    }

    window.location.href = body.checkoutUrl;
  }

  return (
    <section className="panel handoff-band" style={{ marginTop: 18 }}>
      <h2>申し込み</h2>
      <p className="hint">決済はStripeの安全な画面で行います。申し込み後、運営側で整理結果を確認します。</p>
      <div className="columns compact-columns">
        <div className="field">
          <label htmlFor="supportContactName">お名前 任意</label>
          <input
            className="input"
            id="supportContactName"
            onChange={(event) => setContactName(event.target.value)}
            placeholder="お名前"
            value={contactName}
          />
        </div>
        <div className="field">
          <label htmlFor="supportContactEmail">メール 必須</label>
          <input
            className="input"
            id="supportContactEmail"
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="mail@example.com"
            type="email"
            value={contactEmail}
          />
        </div>
      </div>
      <label className="check consent-check">
        <input
          checked={consentToContact}
          onChange={(event) => setConsentToContact(event.target.checked)}
          type="checkbox"
        />
        発動サポートの提供に必要な連絡を受けることに同意する
      </label>
      <div className="actions">
        <button className="button" disabled={!caseId || submitting} onClick={startCheckout}>
          {submitting ? "準備しています" : caseId ? "Stripeの申し込み画面へ進む" : "整理結果の画面から申し込む"}
        </button>
      </div>
      {message ? <p className="hint">{message}</p> : null}
    </section>
  );
}
