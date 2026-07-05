import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container hero">
      <section>
        <p className="pill">Web入口 + Expo継続アプリ</p>
        <h1>親の状況が変わったら、家族が次にやることが分かる。</h1>
        <p className="lead">
          QRからダウンロード不要で5分診断。結果を家族に共有し、必要ならアプリへ引き継いで期限・写真・実家カルテを継続管理できます。
        </p>
        <div className="actions">
          <Link className="button" href="/start">親の状態から始める</Link>
          <Link className="secondary" href="/support-pack">発動サポートを見る</Link>
        </div>
      </section>
      <aside className="panel">
        <h2>最初にできること</h2>
        <ol className="list">
          <li>親の現在ステータスを選ぶ</li>
          <li>5分診断で家族・実家・資産把握状況を整理</li>
          <li>期限付きタスクと相談先カテゴリを確認</li>
          <li>Expoアプリへ引き継いで家族ボードへ</li>
        </ol>
      </aside>
    </main>
  );
}
