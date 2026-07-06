import { AdminCases } from "@/components/AdminCases";

export default function AdminCasesPage() {
  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="pill">Cases</p>
        <h1 className="page-title">Admin cases</h1>
        <p className="lead">Web入口で作成された診断caseを確認します。Supabase未設定時はlocalStorageのデモcaseを表示します。</p>
      </section>
      <section className="panel">
        <AdminCases />
      </section>
    </main>
  );
}
