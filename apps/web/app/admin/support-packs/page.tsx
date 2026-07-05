import { AdminSupportPacks } from "@/components/AdminSupportPacks";

export default function AdminSupportPacksPage() {
  return (
    <main className="container">
      <h1 className="page-title">support pack確認</h1>
      <section className="panel">
        <AdminSupportPacks />
      </section>
    </main>
  );
}
