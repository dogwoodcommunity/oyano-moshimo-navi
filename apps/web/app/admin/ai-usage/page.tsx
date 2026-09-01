import Link from "next/link";
import { AdminAiUsage } from "@/components/AdminAiUsage";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminAiUsagePage() {
  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="pill">AI consultation operations</p>
        <h1 className="page-title">AI相談の利用回数と原価</h1>
        <p className="lead">
          無料の1日1回相談とFamily Plusの利用状況、月上限、AI APIの概算原価を確認します。
          利用者の相談本文はここには表示しません。
        </p>
        <div className="actions">
          <Link className="secondary" href="/admin">admin top</Link>
          <Link className="secondary" href="/plans">料金表示を確認</Link>
        </div>
      </section>
      <AdminTokenControl />
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Current month</p>
            <h2>家族ごとの利用状況</h2>
          </div>
          <span className="hint">この管理画面には相談本文を表示しません</span>
        </div>
        <AdminAiUsage />
      </section>
    </main>
  );
}
