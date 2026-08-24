import Link from "next/link";
import { AdminMonitorFeedback } from "@/components/AdminMonitorFeedback";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminMonitorFeedbackPage() {
  return (
    <main className="admin-container">
      <section className="admin-page-heading">
        <div>
          <p className="admin-section-label">7日間モニターテスト</p>
          <h1>モニターから届いた回答</h1>
          <p>
            まず「指が止まった場所」と「月980円を払うか」を読みます。
            回答を開くと、利用状況と自由記述を1人ずつ確認できます。
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
