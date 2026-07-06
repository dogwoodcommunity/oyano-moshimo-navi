import Link from "next/link";

const plans = [
  {
    name: "無料ポータル",
    price: "0円",
    audience: "まず何をすればいいか知りたい家族",
    items: [
      "状況別ガイド",
      "状況整理チェック",
      "初回やることリスト",
      "相談先カテゴリ整理"
    ],
    cta: "無料で始める",
    href: "/start",
    featured: false
  },
  {
    name: "家族共有アプリ",
    price: "IAP想定",
    audience: "継続して家族で管理したい人",
    items: [
      "家族共有ボード",
      "期限通知",
      "実家メモ・写真管理",
      "タイムライン保存"
    ],
    cta: "チェック後に引き継ぐ",
    href: "/start",
    featured: true
  },
  {
    name: "困った時の整理サポート",
    price: "Web決済",
    audience: "家族会議や相談前に人の整理が欲しい人",
    items: [
      "診断回答の人力レビュー",
      "家族会議用メモ",
      "相談先比較軸",
      "次に確認する論点整理"
    ],
    cta: "内容を見る",
    href: "/support-pack",
    featured: false
  }
];

const revenueRules = [
  "不安を煽って売らず、無料で整理価値を先に出す",
  "アプリ内には外部Web決済CTAを置かない",
  "法律・税務判断の断定や成約課金に寄せない",
  "保存・共有・通知・人力整理に対して課金する"
];

export default function PlansPage() {
  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">料金と使い方</p>
        <h1 className="page-title">無料で整理し、必要になった時だけ保存・共有・人力サポートへ。</h1>
        <p className="lead">
          親のもしもナビは、最初から売り込むサイトではありません。まず不安を整理し、継続管理や人のレビューが必要な家族だけが有料機能へ進む設計です。
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

      <section className="panel revenue-panel">
        <div>
          <p className="eyebrow">Business policy</p>
          <h2>信頼を失わずに、ちゃんと儲けるための線引き。</h2>
        </div>
        <ul className="list">
          {revenueRules.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </main>
  );
}
