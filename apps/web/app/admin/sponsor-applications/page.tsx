import { AdminSponsorApplications } from "@/components/AdminSponsorApplications";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminSponsorApplicationsPage() {
  return (
    <main className="container">
      <section className="admin-hero">
        <p className="pill">Sponsor applications</p>
        <h1 className="page-title">スポンサー枠申請</h1>
        <p className="lead">都道府県×分野で届いたスポンサー枠の申請を確認します。</p>
      </section>
      <AdminTokenControl />
      <section className="panel" style={{ marginTop: 18 }}>
        <AdminSponsorApplications />
      </section>
    </main>
  );
}
