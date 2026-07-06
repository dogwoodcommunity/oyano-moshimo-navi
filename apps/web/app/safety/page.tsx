import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "安心設計",
  description: "親のもしもナビが保存しない情報、断定しない判断、Web決済とアプリ課金の線引きをまとめています。"
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
    title: "売り込みより先に整理価値を出す",
    body: "無料ガイド、チェックリスト、状況整理を先に提供し、保存・通知・人力レビューが必要な時だけ有料導線へ進めます。"
  }
];

const boundaries = [
  "発動サポートパックはWeb/Stripe決済で扱う",
  "Expoアプリ内には外部Web決済CTAを置かない",
  "アプリ内デジタル機能の継続課金はIAP対応余地を残す",
  "業者ログイン、口コミ、予約、成約課金には寄せない"
];

export default function SafetyPage() {
  return (
    <main className="container">
      <section className="result-summary safety-hero">
        <p className="pill">安心設計</p>
        <h1 className="page-title">親の大事な情報を扱うから、やらないことを先に決める。</h1>
        <p className="lead">
          親のもしもナビは、家族の不安を整理するためのサービスです。便利さだけを増やすのではなく、保存しない情報、断定しない判断、課金の線引きを明確にします。
        </p>
        <div className="actions">
          <Link className="button" href="/start">無料で状況を整理する</Link>
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

      <section className="panel safety-boundary">
        <div>
          <p className="eyebrow">Payment boundary</p>
          <h2>Web入口とExpoアプリの役割を分ける。</h2>
          <p>
            本番運用では、Webは検索流入、無料整理、Stripe決済を担い、Expoアプリは家族ボード、通知、写真、タイムラインの継続利用に集中します。
          </p>
        </div>
        <ul className="list">
          {boundaries.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </main>
  );
}
