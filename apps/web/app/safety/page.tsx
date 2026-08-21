import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "安全方針",
  description: "親のもしもナビが保存しない情報、断定しない判断、家族で安全に使うための考え方をまとめています。"
};

const safetyPrinciples = [
  {
    title: "危ない情報を預からない",
    body: "銀行暗証番号、パスワード、マイナンバー画像、通帳の全ページ画像など、漏れると取り返しにくい情報は保存対象にしません。"
  },
  {
    title: "専門判断を断定しない",
    body: "法律、税務、登記、医療、介護認定の結論は断定せず、確認すべき論点と相談先カテゴリを整理します。"
  },
  {
    title: "家族で共有できる形にする",
    body: "一人が抱えるメモではなく、期限、担当、写真、相談前の確認事項として共有しやすい単位へ分けます。"
  },
  {
    title: "必要になってから機能を増やす",
    body: "最初は1人分の管理手帳を作り、記録や期限を整えます。家族共有は無料枠で価値を確認し、複数人管理や長期相談は必要になった時に追加します。"
  }
];

export default function SafetyPage() {
  return (
    <main className="container">
      <section className="result-summary safety-hero">
        <p className="pill">安全方針</p>
        <h1 className="page-title">親の大事な情報を扱うから、保存しないものを先に決める。</h1>
        <p className="lead">
          親のもしもナビは、家族の不安を整理するためのサービスです。便利さだけを増やすのではなく、保存しない情報、断定しない判断、共有するときの守り方を明確にします。
        </p>
        <div className="actions">
          <Link className="button" href="/home">家族ボードへ戻る</Link>
          <Link className="secondary" href="/legal/disclaimer">免責事項を見る</Link>
        </div>
      </section>

      <section className="safety-grid">
        {safetyPrinciples.map((principle) => (
          <article className="panel safety-card" key={principle.title}>
            <span className="safety-mark" aria-hidden="true" />
            <h2>{principle.title}</h2>
            <p>{principle.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
