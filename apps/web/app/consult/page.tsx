import Link from "next/link";
import type { Metadata } from "next";
import { ConsultPanel } from "@/components/ConsultPanel";

export const metadata: Metadata = {
  title: "AI相談チャット",
  description: "手帳のプロフィールと日々の記録を前提に、同じ会話の続きとしてAIへ相談できます。医療・法律・税務の結論は出しません。"
};

export default function ConsultPage() {
  return (
    <main className="container consult-page">
      <section className="consult-hero">
        <p className="consult-eyebrow">AI相談チャット</p>
        <h1>この人のことを、続けて相談できます。</h1>
        <p className="consult-lead">
          この手帳のプロフィール、最近の記録、これまでの会話を読み、同じ相談の続きとして答えます。
          診断や法律・税務の結論は出しません。判断が必要なことは、必ず主治医や専門家に確認してください。
        </p>
        <div className="consult-hero-actions">
          <Link className="secondary" href="/home">手帳へ戻る</Link>
        </div>
      </section>

      <ConsultPanel />
    </main>
  );
}
