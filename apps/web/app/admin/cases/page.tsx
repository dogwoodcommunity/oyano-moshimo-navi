import { AdminCases } from "@/components/AdminCases";

export default function AdminCasesPage() {
  return (
    <main className="container">
      <h1 className="page-title">Admin cases</h1>
      <section className="panel">
        <AdminCases />
      </section>
    </main>
  );
}
