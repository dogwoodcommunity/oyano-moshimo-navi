import { AdminSupportPacks } from "@/components/AdminSupportPacks";

export default function AdminSupportPacksPage() {
  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="pill">Support</p>
        <h1 className="page-title">support pack確認</h1>
        <p className="lead">Web/Stripeで発動サポートパックへ進んだcaseを確認します。アプリ内には外部決済CTAを置かない方針です。</p>
      </section>
      <section className="panel">
        <AdminSupportPacks />
      </section>
    </main>
  );
}
