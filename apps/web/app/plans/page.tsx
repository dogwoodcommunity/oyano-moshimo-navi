import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "料金と使い方",
  description: "無料ポータル、家族共有アプリ、困った時の整理サポート。親のもしもナビの使い方と課金方針をまとめています。"
};

const plans = [
  {
    name: "無料",
    price: "0円",
    audience: "まず1人目を整理したい家族",
    items: [
      "1人目の家族ボード",
      "状況整理チェック",
      "初回やることリスト",
      "日々の記録"
    ],
    cta: "無料で始める",
    href: "/",
    featured: false
  },
  {
    name: "Family Plus",
    price: "月額想定",
    audience: "2人目以降も管理したい家族",
    items: [
      "複数対象者の管理",
      "写真・PDF容量の拡張",
      "家族会議用PDF",
      "履歴保存とカスタム通知"
    ],
    cta: "Plusを確認する",
    href: "/plans",
    featured: true
  },
  {
    name: "AI相談",
    price: "Plus内機能",
    audience: "毎回説明せずに相談したい人",
    items: [
      "対象者プロフィールを参照",
      "日々の記録を踏まえた助言",
      "今聞くべき質問の提案",
      "専門判断は断定しない安全設計"
    ],
    cta: "設計を見る",
    href: "/safety",
    featured: false
  }
];

export default function PlansPage() {
  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">料金と使い方</p>
        <h1 className="page-title">1人目は無料。複数管理とAI相談は有料へ。</h1>
        <p className="lead">
          親のもしもナビは、家族の手帳として続けて使うアプリです。まず1人目を記録し、2人目以降やAI相談が必要になった家族だけが有料機能へ進みます。
        </p>
      </section>

      <section className="pricing-grid">
        {plans.map((plan) => (
          <article className={`panel pricing-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
            <p className="pill">{plan.audience}</p>
            <h2>{plan.name}</h2>
            <strong className="price">{plan.price}</strong>
            <ul className="list">
              {plan.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <Link className={plan.featured ? "button" : "secondary"} href={plan.href}>{plan.cta}</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
