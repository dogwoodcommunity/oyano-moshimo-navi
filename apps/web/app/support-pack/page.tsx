import { Suspense } from "react";
import { SupportPackClient } from "./SupportPackClient";

export default function SupportPackPage() {
  return (
    <main className="container">
      <h1 className="page-title">発動サポートパック</h1>
      <p className="lead">
        発動サポートは、人的レビュー、家族会議用レポート、専門家・業者候補整理をWebで申し込む人的サポート商品です。
      </p>
      <section className="columns">
        <div className="panel">
          <h2>含まれるもの</h2>
          <ul className="list">
            <li>診断回答と期限タスクの人力レビュー</li>
            <li>家族会議で確認する論点の整理</li>
            <li>相談先カテゴリと候補比較軸の整理</li>
          </ul>
        </div>
        <div className="panel">
          <h2>決済方針</h2>
          <p>
            Web/Stripe Checkout前提です。Expoアプリ内には外部決済CTAを置かず、申し込み済み・レビュー中・レポート完成の状態表示に留めます。
          </p>
        </div>
      </section>
      <Suspense fallback={<section className="panel" style={{ marginTop: 18 }}>読み込み中</section>}>
        <SupportPackClient />
      </Suspense>
    </main>
  );
}
