import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "親のもしも準備ポータル",
  description: "入院、介護、認知症、相続前整理、実家じまい。親のもしもに備えて家族で確認することを整理します。"
};

const portalTopics = [
  {
    title: "親が入院した",
    body: "病院で聞くこと、支払い、退院後のことを整理します。",
    href: "/start"
  },
  {
    title: "介護が始まりそう",
    body: "家族の役割、通院、薬、相談先を整理します。",
    href: "/start"
  },
  {
    title: "親が亡くなった",
    body: "葬儀、親族連絡、役所手続きの初動を整理します。",
    href: "/start"
  },
  {
    title: "実家を片付けたい",
    body: "写真、鍵、書類、家財の確認順を整理します。",
    href: "/start"
  }
];

const entryCards = [
  {
    label: "1",
    title: "状況を選ぶ",
    body: "親のいまの状態に近いものを1つ選びます。正確でなくても大丈夫です。",
    href: "/start",
    cta: "はじめる"
  },
  {
    label: "2",
    title: "5分で整理する",
    body: "家族に聞くこと、期限があること、相談先をわかりやすく出します。",
    href: "/start",
    cta: "無料で整理"
  },
  {
    label: "3",
    title: "必要なら保存する",
    body: "結果を家族で共有したい時だけ、アプリに引き継いで管理できます。",
    href: "/plans",
    cta: "使い方を見る"
  }
];

const urgentEntries = [
  "親が入院した",
  "介護が始まりそう",
  "亡くなった直後",
  "実家を片付けたい"
];

const reasonCards = [
  {
    title: "ログインなしで始められます",
    body: "まず結果を見るところまで、会員登録は必要ありません。"
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
            <h1>親のことで困った時に、最初に開く場所。</h1>
            <p className="lead">入院、介護、亡くなった後の手続き、実家の片付け。家族で何から確認するかを、短いリストに整理します。</p>
            <div className="start-gateway" aria-label="入口">
              <p className="gateway-label">ここからです</p>
              <Link className="button gateway-button" href="/start">状況を選んで整理する</Link>
              <p className="gateway-note">無料・ログインなし。3分ほどで結果を見られます。</p>
            </div>
            <div className="urgent-strip" aria-label="よくある状況">
              {urgentEntries.map((item) => (
                <Link href="/start" key={item}>{item}</Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container entry-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">使い方</p>
            <h2>まずは「状況を選ぶ」だけで大丈夫です。</h2>
          </div>
        </div>
        <div className="entry-grid">
          {entryCards.map((entry, index) => (
            <Link className={`entry-card panel ${index === 1 ? "featured" : ""}`} href={entry.href} key={entry.title}>
              <span className="meta-chip">{entry.label}</span>
              <strong>{entry.title}</strong>
              <p>{entry.body}</p>
              <span className="entry-link">{entry.cta}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container portal-section" id="portal-topics">
        <div className="section-head">
          <div>
            <p className="eyebrow">入口</p>
            <h2>当てはまるものがあれば、ここから始めてください。</h2>
          </div>
          <Link className="secondary" href="/start">選んで始める</Link>
        </div>
        <div className="grid portal-topic-grid">
          {portalTopics.map((topic) => (
            <Link className="panel portal-topic simple-topic" href={topic.href} key={topic.title}>
              <strong>{topic.title}</strong>
              <p>{topic.body}</p>
              <span>この状況で整理する</span>
            </Link>
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
            <h2>迷ったら、まず状況を1つ選んでください。</h2>
            <p>
              くわしく分からなくても大丈夫です。近いものを選ぶと、次に確認することが見えてきます。
            </p>
          </div>
          <Link className="button" href="/start">はじめる</Link>
        </div>
      </section>
    </main>
  );
}
