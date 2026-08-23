import Link from "next/link";
import { AdminRegionalSponsorMetrics } from "@/components/AdminRegionalSponsorMetrics";

export default function AdminRegionalSponsorsPage() {
  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="pill">Regional sponsor metrics</p>
        <h1 className="page-title">県×分野のスポンサー営業データ</h1>
        <p className="lead">
          親御さんの居住都道府県を基準に、有効会員数、公開可否、掲載枠の反応を確認します。
          CSVで出力して営業資料に使えます。
        </p>
        <div className="actions">
          <Link className="secondary" href="/admin">admin top</Link>
          <Link className="secondary" href="/admin/sponsor-applications">申請一覧</Link>
          <Link className="secondary" href="/sponsors">公開申請ページ</Link>
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">CSV export</p>
            <h2>都道府県別の枠状況</h2>
          </div>
          <span className="hint">親の居住地ベース</span>
        </div>
        <AdminRegionalSponsorMetrics />
      </section>
    </main>
  );
}
