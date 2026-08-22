import Link from "next/link";
import type { Metadata } from "next";
import { FamilyShare } from "@/components/FamilyShare";

export const metadata: Metadata = {
  title: "家族共有",
  description: `同じ手帳を家族で見られるようにします。招待された家族は追加課金なしで共有手帳に参加できます。`
};

export default function FamilyPage() {
  return (
    <main className="container family-page">
      <section className="family-hero">
        <p className="family-eyebrow">家族共有</p>
        <h1>一人で抱えないために、同じ手帳を見てもらう。</h1>
        <p className="family-lead">
          病院に聞く人、支払いを見る人、写真を残す人。役割を分けるには、まず同じ記録を見ている必要があります。
          招待された人は追加課金なしで、共有された手帳の確認・記録・写真更新に参加できます。
          招待やプラン変更は、手帳を作った人が管理します。
        </p>
        <div className="family-hero-actions">
          <Link className="secondary" href="/home">手帳へ戻る</Link>
        </div>
      </section>

      <FamilyShare />

      <p className="family-safety">
        招待した人には、クラウドに控えた手帳の内容が見えます。暗証番号やパスワードは、これまで通り保存しないでください。
      </p>
    </main>
  );
}
