import { Suspense } from "react";
import { SupportPackClient } from "./SupportPackClient";

export default function SupportPackPage() {
  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">Web / Stripe Checkout</p>
        <h1 className="page-title">発動サポートパック</h1>
        <p className="lead">
          整理結果を人が確認し、家族会議で話す順番と相談先の比較軸を整理するWeb申し込みの商品です。
        </p>
        <div className="meta-row">
          <span className="meta-chip">アプリ内決済CTAなし</span>
          <span className="meta-chip">専門判断は断定しません</span>
          <span className="meta-chip">成約課金なし</span>
        </div>
      </section>

      <section className="columns">
        <div className="panel elevated">
          <h2>含まれるもの</h2>
          <ul className="list">
            <li>入力内容と期限タスクの人力レビュー</li>
            <li>家族会議で確認する論点の整理</li>
            <li>相談先カテゴリと候補比較軸の整理</li>
          </ul>
        </div>
        <div className="panel elevated">
          <h2>含まれないもの</h2>
          <ul className="list">
            <li>法律・税務・登記判断の断定</li>
            <li>業者予約、口コミ、成約課金</li>
            <li>銀行暗証番号・パスワード保管</li>
          </ul>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>進み方</h2>
          <span className="hint">MVPでは管理画面でsupport pack確認まで行います。</span>
        </div>
        <div className="timeline-row">
          <div className="timeline-step"><strong>1</strong><span>整理結果を作成</span></div>
          <div className="timeline-step"><strong>2</strong><span>Webで申し込み</span></div>
          <div className="timeline-step"><strong>3</strong><span>人力レビュー</span></div>
          <div className="timeline-step"><strong>4</strong><span>家族会議メモへ</span></div>
        </div>
      </section>

      <Suspense fallback={<section className="panel" style={{ marginTop: 18 }}>読み込み中</section>}>
        <SupportPackClient />
      </Suspense>
    </main>
  );
}
