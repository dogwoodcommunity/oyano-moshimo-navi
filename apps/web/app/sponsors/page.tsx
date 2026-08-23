import type { Metadata } from "next";
import Link from "next/link";
import { SponsorApplicationForm } from "@/components/SponsorApplicationForm";

export const metadata: Metadata = {
  title: "スポンサー枠の申請",
  description: "親のもしもナビの地域スポンサー枠について、都道府県と分野を指定して申請できます。"
};

const fields = [
  ["葬儀", "急な時の地域ガイドや相談先一覧で、審査済みの地域事業者として扱う枠。"],
  ["相続士業", "司法書士、税理士、弁護士など、家族が次に確認する相談先の候補。"],
  ["家族信託", "元気なうちの備え、認知症前後の相談候補。"],
  ["ホーム紹介", "施設探しや退院後の住まい相談の候補。"],
  ["保険", "保険証券や請求準備の確認先。"],
  ["遺品整理", "実家じまい、片付け、見積比較前の相談候補。"]
];

export default function SponsorsPage() {
  return (
    <main className="container sponsors-page">
      <section className="sponsor-hero">
        <p className="pill">Local sponsor</p>
        <h1>地域ごとのスポンサー枠を、先に申請できます。</h1>
        <p>
          親のもしもナビは、家族が親の状況を記録し、次に確認することを整理する手帳です。
          スポンサー枠は、利用者の記録画面に広告を出すものではありません。地域ガイド、
          相談先一覧、印刷物など、家族が明示的に相談先を探す場面だけで扱います。
        </p>
        <div className="sponsor-hero-actions">
          <a className="primary-cta" href="#apply">申請する</a>
          <Link className="secondary" href="/home">利用者向け画面を見る</Link>
        </div>
      </section>

      <section className="sponsor-principles">
        <article>
          <span>01</span>
          <strong>手帳画面には出しません</strong>
          <p>病歴、入院、死亡、家族の記録の途中に広告を挟まない。信頼を壊さないことを優先します。</p>
        </article>
        <article>
          <span>02</span>
          <strong>都道府県×分野で枠を管理</strong>
          <p>同じ県、同じ分野で枠を絞り、問い合わせ実績を見ながら地域ごとに広げます。</p>
        </article>
        <article>
          <span>03</span>
          <strong>初期から申請受付</strong>
          <p>会員数が増える前から希望地域を受け付け、兵庫・神戸から優先的に検証します。</p>
        </article>
      </section>

      <section className="panel sponsor-field-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Sponsor fields</p>
            <h2>申請できる分野</h2>
          </div>
          <span className="hint">月3万円枠を基準に検証</span>
        </div>
        <div className="sponsor-field-grid">
          {fields.map(([title, body]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel sponsor-apply-panel" id="apply">
        <div className="section-head">
          <div>
            <p className="eyebrow">Apply</p>
            <h2>スポンサー枠を申請する</h2>
          </div>
          <span className="hint">審査後に個別連絡</span>
        </div>
        <SponsorApplicationForm />
      </section>
    </main>
  );
}
