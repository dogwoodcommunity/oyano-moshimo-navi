import Link from "next/link";
import { AdminCases } from "@/components/AdminCases";

export default function AdminPage() {
  return (
    <main className="container">
      <h1 className="page-title">Admin overview</h1>
      <div className="actions">
        <Link className="secondary" href="/admin/cases">cases</Link>
        <Link className="secondary" href="/admin/support-packs">support packs</Link>
        <Link className="secondary" href="/admin/providers">providers</Link>
      </div>
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>最近のcase</h2>
        <AdminCases />
      </section>
    </main>
  );
}
