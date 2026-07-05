export default function AdminPersonPage({ params }: { params: { id: string } }) {
  return (
    <main className="container">
      <h1 className="page-title">person確認</h1>
      <section className="panel">
        <p>person id: {params.id}</p>
        <p className="hint">Supabase `people`, `tasks`, `homes`, `timeline_events` 接続用の管理詳細画面です。</p>
      </section>
    </main>
  );
}
