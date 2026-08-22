import Link from "next/link";
import type { Metadata } from "next";
import { FREE_PLAN_MEMBER_LIMIT } from "@oyano/shared";
import { PlanCompletionNotice } from "@/components/PlanCompletionNotice";
import { PlusUpgrade } from "@/components/PlusUpgrade";

export const metadata: Metadata = {
  title: "料金と使い方",
  description: "1人目の管理手帳、家族共有、長期相談。親のもしもナビでできることをまとめています。"
};

const plusPrice = process.env.NEXT_PUBLIC_PLUS_PRICE_LABEL?.trim() || "月額980円 / 年額9,800円";

const plans = [
  {
    name: "無料",
    price: "0円",
    audience: "まず1人目を整理したい家族",
    items: [
      "1人目の手帳と家族ボード",
      `家族招待はあなたのほかに${FREE_PLAN_MEMBER_LIMIT}人まで`,
      "日々の記録・確認リスト",
      "長期相談を初回1回だけおためし"
    ],
    cta: "無料で始める",
    href: "/home",
    featured: false
  },
  {
    name: "Family Plus",
    price: plusPrice,
    audience: "2人目以降も管理したい家族",
    items: [
      "2人目以降の対象者管理",
      "家族招待を増やす",
      "写真・PDF容量の拡張",
      "長期相談を1日5回まで",
      "家族会議用PDFと月次まとめ"
    ],
    cta: "Plusの手続きへ",
    href: "#plus",
    featured: true
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

      <section className="panel plan-trust-panel">
        <p className="pill">解約しても読める</p>
        <h2>手帳の記録は、あとから見返せることを優先します。</h2>
        <p>
          Family Plusをやめても、これまで残した基本の記録は読み返せます。
          追加対象者、容量拡張、PDF、長期相談などのPlus機能だけが止まります。
        </p>
      </section>

      <section className="panel plan-compare">
        <h2>無料とFamily Plusの違い</h2>
        <div className="plan-compare-row">
          <span>対象者</span>
          <strong>無料: 1人</strong>
          <strong>Plus: 複数人</strong>
        </div>
        <div className="plan-compare-row">
          <span>家族共有</span>
          <strong>無料: あなたのほかに{FREE_PLAN_MEMBER_LIMIT}人</strong>
          <strong>Plus: 人数を増やせる</strong>
        </div>
        <div className="plan-compare-row">
          <span>相談</span>
          <strong>無料: 初回1回</strong>
          <strong>Plus: 1日5回</strong>
        </div>
        <div className="plan-compare-row">
          <span>出力</span>
          <strong>無料: 緊急カード</strong>
          <strong>Plus: 家族会議PDF</strong>
        </div>
      </section>

      <PlanCompletionNotice />

      <PlusUpgrade />
    </main>
  );
}
