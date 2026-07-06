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
    href: "/guides/hospitalized"
  },
  {
    title: "介護が始まりそう",
    body: "家族の役割、通院、薬、相談先を整理します。",
    href: "/guides/care"
  },
  {
    title: "親が亡くなった",
    body: "葬儀、親族連絡、役所手続きの初動を整理します。",
    href: "/guides/after-death"
  },
  {
    title: "実家を片付けたい",
    body: "写真、鍵、書類、家財の確認順を整理します。",
    href: "/guides/home-clearance"
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
      <section className="hero portal-hero">
        <div className="hero-inner portal-hero-inner">
          <div>
            <p className="eyebrow">親のもしもナビ</p>
            <h1>親のことで困ったら、まずここで整理できます。</h1>
            <p className="lead">
              入院、介護、亡くなった後の手続き、実家の片付け。いま何をすればいいかを、家族で見られるリストにします。
            </p>
            <div className="actions">
              <Link className="button primary-cta" href="/start">まず状況を選ぶ</Link>
              <Link className="secondary" href="/guides">先に読む</Link>
            </div>
            <p className="hint portal-trust">無料・ログインなしで始められます。保存したい時だけアプリへ引き継ぎます。</p>
          </div>
          <div className="portal-side elevated">
            <p className="pill">使い方</p>
            <h2>むずかしい準備を、3つに分けます。</h2>
            <div className="hero-flow">
              <span>1. 選ぶ</span>
              <span>2. 整理</span>
              <span>3. 共有</span>
            </div>
            <p className="simple-copy">いちばん近い状況を選ぶだけで、家族に聞くことと期限のあることが見えてきます。</p>
          </div>
        </div>
        <div className="hero-proof portal-proof" aria-label="サービス概要">
          <div className="proof-item">
            <span className="proof-number">無料</span>
            <span className="proof-label">まずは登録なしで使えます</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">簡単</span>
            <span className="proof-label">近い状況を選ぶだけです</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">安心</span>
            <span className="proof-label">大事な番号は保存しません</span>
          </div>
        </div>
      </section>

      <section className="container entry-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>やることは、この3つだけです。</h2>
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
            <p className="eyebrow">Choose a situation</p>
            <h2>いま近いものを選んでください。</h2>
          </div>
          <Link className="secondary" href="/start">選んで始める</Link>
        </div>
        <div className="grid portal-topic-grid">
          {portalTopics.map((topic) => (
            <Link className="panel portal-topic simple-topic" href="/start" key={topic.title}>
              <strong>{topic.title}</strong>
              <p>{topic.body}</p>
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
