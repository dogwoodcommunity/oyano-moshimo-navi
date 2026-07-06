import Link from "next/link";

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

const portalGuides = [
  "銀行暗証番号・パスワード・マイナンバー画像は保存しない",
  "法律・税務の判断は断定せず、必要な相談先カテゴリを整理する",
  "家族で共有しやすいタスクと期限から始める"
];

export default function HomePage() {
  return (
    <main>
      <section className="hero portal-hero">
        <div className="hero-inner portal-hero-inner">
          <div>
            <p className="eyebrow">親のもしも準備ポータル</p>
            <h1>親のことで、いつか困る前に。家族で確認することを、ここから整理する。</h1>
            <p className="lead">
              入院、介護、実家じまい、相続前の情報整理まで。まずは無料の読みものとチェックで、いま必要な準備だけを見つけます。
            </p>
            <div className="actions">
              <Link className="button" href="/start">無料で状況を整理する</Link>
              <Link className="secondary" href="/guides">準備ガイドを読む</Link>
            </div>
            <p className="hint portal-trust">会員登録は結果を家族で保存・共有したい時だけ。診断名より、やることリストを先に出します。</p>
          </div>
          <div className="portal-side panel elevated">
            <p className="pill">今日できること</p>
            <h2>家族に聞く前に、まず自分の頭を整理する。</h2>
            <ul className="list">
              {portalGuides.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
        <div className="hero-proof portal-proof" aria-label="サービス概要">
          <div className="proof-item">
            <span className="proof-number">無料</span>
            <span className="proof-label">まずは読みものと整理チェック</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">匿名</span>
            <span className="proof-label">ログイン前にやることリスト表示</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">共有</span>
            <span className="proof-label">必要になったらアプリで家族管理</span>
          </div>
        </div>
      </section>

      <section className="container portal-section" id="portal-topics">
        <div className="section-head">
          <div>
            <p className="eyebrow">Preparation topics</p>
            <h2>まず読める、親のもしも準備</h2>
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

      <section className="portal-band">
        <div className="container portal-band-inner">
          <div>
            <p className="eyebrow">Next step</p>
            <h2>会員登録の前に、いまの状況から必要なリストを作る。</h2>
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
