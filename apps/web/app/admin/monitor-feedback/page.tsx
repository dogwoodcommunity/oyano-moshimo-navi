import Link from "next/link";
import { AdminMonitorFeedback } from "@/components/AdminMonitorFeedback";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminMonitorFeedbackPage() {
  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="pill">Monitor test</p>
        <h1 className="page-title">モニターテスト回答</h1>
        <p className="lead">モニターの完走状況、迷った場所、7日後の利用意向、Family Plusへの支払意向を確認します。</p>
        <div className="actions">
          <Link className="secondary" href="/admin">admin top</Link>
          <Link className="secondary" href="/monitor">モニター入口を見る</Link>
        </div>
      </section>
      <AdminTokenControl />
      <section className="panel" style={{ marginTop: 18 }}>
        <AdminMonitorFeedback />
      </section>
    </main>
  );
}
