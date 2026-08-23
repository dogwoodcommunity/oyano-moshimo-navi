"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { PREFECTURES, SPONSOR_APPLICATION_CATEGORIES } from "@/lib/prefectures";

type SubmitState = "idle" | "sending" | "sent" | "error";

const slotTypes = [
  "都道府県1枠を希望",
  "市区町村単位で相談したい",
  "複数県をまとめて相談したい",
  "資料だけ先に見たい"
];

export function SponsorApplicationForm() {
  const [status, setStatus] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("sending");
    setMessage("");

    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/sponsors/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "send_failed");
      }

      setStatus("sent");
      setMessage("申請を受け付けました。地域枠の準備状況を確認して、担当から連絡します。");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.message === "sponsor_applications_not_ready"
        ? "申請フォームの保存先がまだ準備中です。Supabaseの sponsor_applications SQL を反映してください。"
        : "送信できませんでした。入力内容を確認して、少し時間をおいて再度お試しください。");
    }
  }

  return (
    <form className="sponsor-form" onSubmit={submit}>
      <div className="sponsor-form-grid">
        <label>
          <span>会社名</span>
          <input name="companyName" placeholder="例: 株式会社〇〇" required />
        </label>
        <label>
          <span>担当者名</span>
          <input name="contactName" placeholder="例: 山田 太郎" required />
        </label>
        <label>
          <span>メール</span>
          <input name="email" placeholder="example@company.jp" required type="email" />
        </label>
        <label>
          <span>電話番号</span>
          <input name="phone" inputMode="tel" placeholder="078-000-0000" />
        </label>
        <label>
          <span>希望する都道府県</span>
          <select name="prefecture" required>
            <option value="">選択してください</option>
            {PREFECTURES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>主な市区町村</span>
          <input name="city" placeholder="例: 神戸市、西宮市など" />
        </label>
        <label>
          <span>分野</span>
          <select name="category" required>
            <option value="">選択してください</option>
            {SPONSOR_APPLICATION_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>希望枠</span>
          <select name="slotType" required>
            {slotTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Webサイト</span>
          <input name="website" placeholder="https://..." type="url" />
        </label>
        <label>
          <span>想定予算</span>
          <input name="budgetNote" placeholder="例: 月3万円枠を検討" />
        </label>
      </div>
      <label className="sponsor-wide-field">
        <span>相談したい内容</span>
        <textarea name="message" placeholder="希望地域、扱えるサービス、掲載開始時期などを入力してください。" rows={5} />
      </label>
      <label className="sponsor-consent">
        <input name="consent" required type="checkbox" value="yes" />
        <span>営業連絡のため、入力内容を保存して連絡を受けることに同意します。</span>
      </label>
      <button className="primary-cta" disabled={status === "sending"} type="submit">
        {status === "sending" ? "送信中..." : "スポンサー枠を申請する"}
      </button>
      {message ? <p className={`sponsor-form-message ${status}`}>{message}</p> : null}
    </form>
  );
}
