import Link from "next/link";
import type { Metadata } from "next";
import { FREE_PLAN_MEMBER_LIMIT } from "@oyano/shared";
import { FamilyShare } from "@/components/FamilyShare";

export const metadata: Metadata = {
  title: "家族共有",
  description: `同じ手帳を家族で見られるようにします。あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人までは無料です。`
};

export default function FamilyPage() {
  return (
    <main className="container family-page">
      <section className="family-hero">
        <p className="family-eyebrow">家族共有</p>
        <h1>一人で抱えないために、同じ手帳を見てもらう。</h1>
        <p className="family-lead">
          病院に聞く人、支払いを見る人、写真を残す人。役割を分けるには、まず同じ記録を見ている必要があります。
          あなたのほかに{FREE_PLAN_MEMBER_LIMIT}人まで、無料で招待できます。
        </p>
        <div className="family-hero-actions">
          <Link className="secondary" href="/home">手帳へ戻る</Link>
          <Link className="secondary" href="/plans">Plusを見る</Link>
        </div>
      </section>

      <FamilyShare />

      <p className="family-safety">
        招待した人には、クラウドに控えた手帳の内容が見えます。暗証番号やパスワードは、これまで通り保存しないでください。
      </p>
    </main>
  );
}
