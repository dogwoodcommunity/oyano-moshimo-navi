import Link from "next/link";
import type { Metadata } from "next";
import { ConsultPanel } from "@/components/ConsultPanel";

export const metadata: Metadata = {
  title: "長期相談",
  description: "手帳のプロフィールと日々の記録を前提に、次に確認することと窓口で聞くことを整理します。医療・法律・税務の結論は出しません。"
};

export default function ConsultPage() {
  return (
    <main className="container consult-page">
      <section className="consult-hero">
        <p className="consult-eyebrow">長期相談</p>
        <h1>毎回ゼロから説明せずに、相談できます。</h1>
        <p className="consult-lead">
          この手帳のプロフィールと最近の記録を前提に、いま確認するとよいこと、窓口で聞くこと、相談先の候補を整理します。
          診断や法律・税務の結論は出しません。判断が必要なことは、必ず主治医や専門家に確認してください。
        </p>
        <div className="consult-hero-actions">
          <Link className="secondary" href="/home">手帳へ戻る</Link>
          <Link className="secondary" href="/safety">安全方針を見る</Link>
        </div>
      </section>

      <ConsultPanel />
    </main>
  );
}
