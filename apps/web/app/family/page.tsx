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
        <h1>家族1人を無料で招待できます。</h1>
        <p className="family-lead">
          あなたが作った手帳を、家族と一緒に見て更新できます。
          招待された人に料金はかかりません。
        </p>
        <div className="family-hero-actions">
          <Link className="secondary" href="/home">手帳へ戻る</Link>
        </div>
      </section>

      <section className="family-how" aria-label="家族を招待する手順">
        <h2>招待は3つの手順です</h2>
        <ol>
          <li><span>1</span><div><strong>クラウド保存を始める</strong><small>メール確認をして、同じ手帳を安全に共有できるようにします。</small></div></li>
          <li><span>2</span><div><strong>招待リンクを作る</strong><small>招待する家族のメールアドレスを入力します。</small></div></li>
          <li><span>3</span><div><strong>LINEやメールで送る</strong><small>リンクを作っただけでは相手に届きません。最後に自分で送信します。</small></div></li>
        </ol>
      </section>

      <section className="family-card family-sharing-scope" aria-labelledby="family-sharing-scope-title">
        <h2 id="family-sharing-scope-title">招待する前に：家族に見える内容</h2>
        <p>クラウドに保存した日記・写真・プロフィール・確認リストは、「見るだけ」を選んでも家族に見えます。書類・鍵の保管場所も共有されます。</p>
        <p>AIが覚えている要約・重要な変化・家族が補足した情報も共有されます。</p>
        <p>AI相談の質問・回答の履歴は、相談した本人だけが見られます。ただし「この回答を手帳に残す」で記録した内容は、家族にも見えます。</p>
      </section>

      <FamilyShare />

      <p className="family-safety">
        招待した人には、クラウドに控えた手帳の内容が見えます。暗証番号やパスワードは、これまで通り保存しないでください。
      </p>
    </main>
  );
}
