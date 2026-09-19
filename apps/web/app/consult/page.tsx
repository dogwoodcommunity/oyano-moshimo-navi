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
      <header className="consult-page-heading">
        <h1>AI相談</h1>
        <Link className="secondary" href="/home">手帳へ戻る</Link>
      </header>
      <ConsultPanel />
      <p className="consult-safety-note">AIの回答は参考情報です。診断や法律・税務の判断は、主治医や専門家に確認してください。</p>
    </main>
  );
}
