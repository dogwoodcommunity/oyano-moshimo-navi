import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "親のもしも準備ポータル",
  description: "入院、介護、認知症、相続前整理、実家じまい。親のもしもに備えて家族で確認することを整理します。"
};

const portalTopics = [
  {
    title: "入院・退院の前後",
    body: "支払い、保険、退院後の生活場所、家族の連絡役を早めに整理します。",
    href: "/guides/hospitalized"
  },
  {
    title: "介護・認知症の備え",
    body: "本人確認、緊急連絡先、通院・薬・お金の管理範囲を家族で分けます。",
    href: "/guides/care"
  },
  {
    title: "実家じまいと家の管理",
    body: "鍵、ライフライン、写真、家財量、売る・貸す・残す判断材料を集めます。",
    href: "/guides/home-clearance"
  },
  {
    title: "相続前の情報整理",
    body: "財産の断定ではなく、書類の所在、相談先、期限のある手続きを見える化します。",
    href: "/guides/inheritance"
  }
];

const entryCards = [
  {
    label: "Step 1",
    title: "まず読む",
    body: "入院、介護、死亡直後、実家じまい。いま起きていることに近いガイドを見ます。",
    href: "/guides",
    cta: "準備ガイドへ"
  },
  {
    label: "Step 2",
    title: "状況を整理する",
    body: "ログインなしで、家族が確認すること・期限のあるタスク・相談先カテゴリを出します。",
    href: "/start",
    cta: "無料で整理する"
  },
  {
    label: "Step 3",
    title: "家族で管理する",
    body: "必要になったらアプリへ引き継ぎ、家族ボード、通知、写真、タイムラインで続けます。",
    href: "/plans",
    cta: "使い方を見る"
  }
];

const promiseItems = [
  "会員登録前に、必要なやることリストを表示",
  "暗証番号・パスワード・マイナンバー画像は保存しない",
  "法律・税務・医療判断は断定せず、相談前の整理に徹する"
];

export default function HomePage() {
  return (
    <main>
      <section className="hero portal-hero">
        <div className="hero-inner portal-hero-inner">
          <div>
            <p className="eyebrow">親のもしもナビ</p>
            <h1>親が入院した。介護が始まる。亡くなった。次に何をするか、家族で迷わないためのサイト。</h1>
            <p className="lead">
              手続き、期限、家族の役割、実家の写真、相談先。バラバラになりがちな情報を、まず無料で「今日やること」に整理します。
            </p>
            <div className="actions">
              <Link className="button primary-cta" href="/start">いまの状況から始める</Link>
              <Link className="secondary" href="/guides">準備ガイドを読む</Link>
            </div>
            <p className="hint portal-trust">ログイン不要。結果を保存・共有したい時だけ、Expoアプリへ引き継げます。</p>
          </div>
          <div className="portal-side elevated">
            <p className="pill">このサイトでできること</p>
            <h2>親のもしもを、3つに分けて整理します。</h2>
            <div className="hero-flow">
              <span>読む</span>
              <span>整理する</span>
              <span>家族で管理</span>
            </div>
            <ul className="list">
              {promiseItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
        <div className="hero-proof portal-proof" aria-label="サービス概要">
          <div className="proof-item">
            <span className="proof-number">読む</span>
            <span className="proof-label">状況別ガイドとチェックリスト</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">整理</span>
            <span className="proof-label">期限タスクと家族への確認事項</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">継続</span>
            <span className="proof-label">アプリで通知・写真・家族ボード</span>
          </div>
        </div>
      </section>

      <section className="container entry-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Start here</p>
            <h2>入口は3つだけ。迷ったら「状況を整理する」へ。</h2>
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
            <p className="eyebrow">Common situations</p>
            <h2>よくある「親のもしも」から探す</h2>
          </div>
          <Link className="secondary" href="/guides">すべてのガイド</Link>
        </div>
        <div className="grid portal-topic-grid">
          {portalTopics.map((topic) => (
            <Link className="panel portal-topic" href={topic.href} key={topic.title}>
              <span className="meta-chip">準備ガイド</span>
              <strong>{topic.title}</strong>
              <p>{topic.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container portal-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Free tools</p>
            <h2>登録前に使えるチェックリスト</h2>
          </div>
          <Link className="secondary" href="/checklists">すべて見る</Link>
        </div>
        <div className="columns">
          <div className="panel checklist-preview">
            <span className="meta-chip">入院・介護</span>
            <strong>病院で聞くこと、家族で分けること</strong>
            <p>入院初日、退院前、介護が始まりそうな時に、聞き漏らしや抱え込みを減らします。</p>
          </div>
          <div className="panel checklist-preview">
            <span className="meta-chip">死亡直後・実家じまい</span>
            <strong>慌てて捨てない、期限を忘れない</strong>
            <p>重要書類、親族連絡、家の写真、支払い確認を、家族で共有しやすい順番にします。</p>
          </div>
        </div>
      </section>

      <section className="portal-band">
        <div className="container portal-band-inner">
          <div>
            <p className="eyebrow">Next step</p>
            <h2>まず1つ選ぶだけ。家族に聞くことと期限タスクに変換します。</h2>
            <p>
              状況を選ぶと、期限のあるタスク、家族に確認すること、相談先カテゴリを先に表示します。
              保存・共有・通知が必要になった時だけアプリへ引き継げます。
            </p>
          </div>
          <Link className="button" href="/start">状況整理チェックへ</Link>
        </div>
      </section>
    </main>
  );
}
