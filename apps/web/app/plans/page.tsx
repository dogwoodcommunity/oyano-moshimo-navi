import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "料金と使い方",
  description: "1人目の管理手帳、家族共有、長期相談。親のもしもナビでできることをまとめています。"
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
    href: "/home",
    featured: false
  },
  {
    name: "Family Plus",
    price: "準備中",
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
    name: "長期相談",
    price: "Plus内機能",
    audience: "毎回説明せずに相談したい人",
    items: [
      "対象者プロフィールと日々の記録を前提に整理",
      "次に確認すること、窓口で聞くことを提示",
      "今聞くべき質問の提案",
      "専門判断は断定しない安全設計"
    ],
    cta: "相談してみる",
    href: "/consult",
    featured: false
  }
];

export default function PlansPage() {
  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">料金と使い方</p>
        <h1 className="page-title">1人目は無料。複数管理と長期相談は有料へ。</h1>
        <p className="lead">
          親のもしもナビは、家族の手帳として続けて使うアプリです。まず1人分の記録を整え、必要になった時だけ複数管理や長期相談を追加できます。家族共有は最初の価値体験として無料枠を残します。
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
