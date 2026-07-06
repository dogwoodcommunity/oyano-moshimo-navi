import { AdminDeleteRequests } from "@/components/AdminDeleteRequests";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminDeleteRequestsPage() {
  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="pill">Privacy Ops</p>
        <h1 className="page-title">削除依頼の確認</h1>
        <p className="lead">アプリ内から送信されたアカウント削除依頼を確認します。誤削除を避けるため、内容確認後に削除作業を進めます。</p>
      </section>
      <AdminTokenControl />
      <section className="panel" style={{ marginTop: 18 }}>
        <AdminDeleteRequests />
      </section>
    </main>
  );
}
