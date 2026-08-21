import Link from "next/link";
import { AdminFunnel } from "@/components/AdminFunnel";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminFunnelPage() {
  return (
    <main className="container">
      <section className="admin-hero">
        <p className="pill">Operations</p>
        <h1 className="page-title">ファネル</h1>
        <p className="lead">
          測るのは1つの数字だけです。危機モードを開いた人のうち、対象者を登録し、7日以内に2件目の記録を書いた割合。
        </p>
        <div className="actions">
          <Link className="secondary" href="/admin">admin overview</Link>
          <Link className="secondary" href="/admin/env">env</Link>
        </div>
      </section>

      <AdminFunnel />
      <AdminTokenControl />
    </main>
  );
}
