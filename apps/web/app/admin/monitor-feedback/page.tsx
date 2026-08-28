import Link from "next/link";
import { AdminMonitorFeedback } from "@/components/AdminMonitorFeedback";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminMonitorFeedbackPage() {
  return (
    <main className="admin-container">
      <section className="admin-page-heading">
        <div>
          <p className="admin-section-label">7日間モニターテスト</p>
          <h1>モニターの進み具合と最終回答</h1>
          <p>
            途中の利用状況と、7日間終了後に届いた最終回答を分けて表示します。
            最終回答を開くと「指が止まった場所」や支払意向も確認できます。
          </p>
        </div>
        <div className="admin-page-actions">
          <Link href="/monitor">モニター入口を見る</Link>
          <Link href="/monitor/report">回答フォームを見る</Link>
        </div>
      </section>
      <AdminTokenControl />
      <section className="admin-content-panel">
        <AdminMonitorFeedback />
      </section>
    </main>
  );
}
