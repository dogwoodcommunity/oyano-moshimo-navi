import type { Metadata } from "next";
import Link from "next/link";
import { SponsorApplicationForm } from "@/components/SponsorApplicationForm";
import { publicPrefectureUsageThreshold } from "@/lib/prefectures";

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
  const threshold = publicPrefectureUsageThreshold();

  return (
    <main className="container sponsors-page">
      <section className="sponsor-hero">
        <p className="pill">Local sponsor</p>
        <h1>親御さんの地域ごとのスポンサー枠を、先に申請できます。</h1>
        <p>
          親のもしもナビは、家族が親の状況を記録し、次に確認することを整理する手帳です。
          スポンサー枠は、利用者本人の住所ではなく、親御さんの居住都道府県を基準に扱います。
          利用者の記録画面に広告を出すものではなく、地域ガイド、相談先一覧、印刷物など、
          家族が明示的に相談先を探す場面だけで、協賛/PRとして明示して扱います。
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
          <p>病歴、入院、死亡、家族の記録の途中に広告を挟まない。AI相談にもスポンサー名を混ぜません。</p>
        </article>
        <article>
          <span>02</span>
          <strong>親の居住都道府県×分野で枠を管理</strong>
          <p>同じ県、同じ分野で枠を絞り、親御さんの地域で発生する相談に合わせます。</p>
        </article>
        <article>
          <span>03</span>
          <strong>公開数字は閾値制</strong>
          <p>管理画面では生数字を見ますが、公開側では一定数を超えた県だけ利用数を表示します。営業資料の前月比は月次確定値だけを使います。</p>
        </article>
      </section>

      <section className="panel sponsor-field-panel sponsor-threshold-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Regional data</p>
            <h2>会員数は、親御さんの居住地で集計します</h2>
          </div>
          <span className="hint">公開は{threshold}世帯以上</span>
        </div>
        <p>
          管理画面では全都道府県の生数字と前月比を確認します。公開側では、
          有効世帯{threshold}世帯以上の県だけ「◯◯県:利用者△△人（□□世帯）が利用中」と表示し、
          閾値未満の県は「募集中」として扱います。
          掲載料の段階判定は、表示人数ではなく世帯数を基準にします。
          有効世帯は「親情報があり、家族共有が始まった世帯」を保守的に数え、ソロ利用者は営業用の有効世帯数に含めません。
          前月比は毎月のスナップショットで確定し、あとから変わらない数字だけを営業資料に使います。
        </p>
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
