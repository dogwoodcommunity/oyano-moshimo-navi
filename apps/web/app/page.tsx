import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "親のもしもナビ | 家族で使う保管庫・通知係",
  description: "入院、介護、認知症、相続前整理、実家じまい。親のもしもに備えて、家族でタスク・期限・写真を管理するアプリです。"
};

const appUseCases = [
  {
    title: "家族ボード",
    body: "親ごとに、いま必要なこと・未完了・担当未定を一覧で見ます。"
  },
  {
    title: "期限通知",
    body: "死亡届、年金、準確定申告、相続税など、忘れたくない期限を通知します。"
  },
  {
    title: "写真とメモ",
    body: "保険証券、鍵、通帳の保管場所など、家族で確認する情報を残します。"
  },
  {
    title: "対象者ごとに管理",
    body: "母は入院、父は在宅介護など、状況が違う場合も1人ずつ管理します。"
  }
];

const appSteps = [
  {
    label: "1",
    title: "アプリを開く",
    body: "最初からアプリで、親の名前と今の状況を登録します。"
  },
  {
    label: "2",
    title: "家族で分ける",
    body: "誰がやるか決まっていないタスクを見える化します。"
  },
  {
    label: "3",
    title: "必要な時に戻る",
    body: "毎日使うのではなく、期限や家族更新の時に戻ってこられます。"
  }
];

const reasonCards = [
  {
    title: "入口はアプリです",
    body: "診断サイトで回り道せず、家族ボードから始めます。"
  },
  {
    title: "大事な番号は預かりません",
    body: "暗証番号、パスワード、マイナンバー画像は保存しません。"
  },
  {
    title: "専門判断は断定しません",
    body: "法律・税務・医療の結論ではなく、相談前の整理を助けます。"
  }
];

const guideLinks = [
  {
    title: "まず読む",
    body: "状況別のやさしいガイドを読む",
    href: "/guides",
    cta: "ガイドへ"
  },
  {
    title: "紙のように確認する",
    body: "家族会議で使えるチェックリストを見る",
    href: "/checklists",
    cta: "チェックリストへ"
  },
  {
    title: "安心して使う",
    body: "保存しない情報やサービスの線引きを見る",
    href: "/safety",
    cta: "安心設計へ"
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="photo-portal-hero">
        <div className="photo-portal-overlay">
          <div className="hero-copy hero-copy-panel">
            <p className="eyebrow">親のもしもナビ</p>
            <h1>親のことは、アプリで家族と管理する。</h1>
            <p className="lead">入院、介護、亡くなった後の手続き、実家の片付け。家族でやること、期限、写真、メモを1つのボードにまとめます。</p>
            <div className="app-gateway" aria-label="アプリ入口">
              <p className="gateway-label">入口はアプリです</p>
              <Link className="button gateway-button" href="/install">
                ホーム画面に追加
                <span>PWAとしてすぐ開けます</span>
              </Link>
              <p className="gateway-note">正式アプリ公開前は、PWAとしてホーム画面に置いて確認します。ストア公開後はアプリ案内へ切り替えます。</p>
            </div>
            <div className="urgent-strip" aria-label="アプリでできること">
              <span>家族ボード</span>
              <span>期限通知</span>
              <span>写真管理</span>
              <span>対象者追加</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container entry-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">使い方</p>
            <h2>最初からアプリで始めます。</h2>
          </div>
        </div>
        <div className="entry-grid">
          {appSteps.map((entry, index) => (
            <div className={`entry-card panel ${index === 0 ? "featured" : ""}`} key={entry.title}>
              <span className="meta-chip">{entry.label}</span>
              <strong>{entry.title}</strong>
              <p>{entry.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container portal-section" id="portal-topics">
        <div className="section-head">
          <div>
            <p className="eyebrow">アプリの中身</p>
            <h2>低頻度でも、必要な瞬間に戻ってこられる設計です。</h2>
          </div>
          <Link className="secondary" href="/guides">使い方を読む</Link>
        </div>
        <div className="grid portal-topic-grid">
          {appUseCases.map((topic) => (
            <div className="panel portal-topic simple-topic" key={topic.title}>
              <strong>{topic.title}</strong>
              <p>{topic.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container portal-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">安心して使うために</p>
            <h2>無理に登録させたり、大事な番号を預かったりしません。</h2>
          </div>
        </div>
        <div className="columns">
          {reasonCards.map((item) => (
            <div className="panel checklist-preview" key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container portal-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">More</p>
            <h2>読むだけ、確認するだけでも使えます。</h2>
          </div>
        </div>
        <div className="entry-grid light-entry-grid">
          {guideLinks.map((item) => (
            <Link className="entry-card panel" href={item.href} key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <span className="entry-link">{item.cta}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="portal-band">
        <div className="container portal-band-inner">
          <div>
            <p className="eyebrow">Start</p>
            <h2>アプリを開いて、家族ボードを作ります。</h2>
            <p>
              親が複数いる場合も、1人ずつ登録して、それぞれの状態とタスクを分けて管理できます。
            </p>
          </div>
          <Link className="button" href="/install">ホーム画面に追加</Link>
        </div>
      </section>
    </main>
  );
}
