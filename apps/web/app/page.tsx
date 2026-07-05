import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hero">
      <section className="hero-inner">
        <div>
          <p className="eyebrow">親のもしもナビ v0.3</p>
          <h1>親の状況が変わったら、家族が次にやることが分かる。</h1>
          <p className="lead">
            QRからダウンロード不要で5分診断。状況、期限、相談先、家族で確認することを一つの結果にまとめ、必要な人だけアプリへ引き継げます。
          </p>
          <div className="actions">
            <Link className="button" href="/start">親の状態から始める</Link>
            <Link className="secondary" href="/support-pack">発動サポートを見る</Link>
          </div>
        </div>
        <div className="hero-proof" aria-label="サービス概要">
          <div className="proof-item">
            <span className="proof-number">5分</span>
            <span className="proof-label">ログイン不要のWeb診断</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">10状態</span>
            <span className="proof-label">準備から相続・実家整理まで</span>
          </div>
          <div className="proof-item">
            <span className="proof-number">継続</span>
            <span className="proof-label">Expoアプリで家族ボード管理</span>
          </div>
        </div>
      </section>
    </main>
  );
}
