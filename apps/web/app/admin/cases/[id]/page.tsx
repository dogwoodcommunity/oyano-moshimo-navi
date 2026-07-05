"use client";

import { useParams } from "next/navigation";
import { getLocalCase } from "@/lib/store";
import { statusLabel } from "@oyano/shared";

export default function AdminCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const record = getLocalCase(params.id);

  if (!record) {
    return <main className="container"><h1 className="page-title">case not found</h1></main>;
  }

  return (
    <main className="container">
      <h1 className="page-title">case確認</h1>
      <section className="panel">
        <p><strong>ID:</strong> {record.id}</p>
        <p><strong>状態:</strong> {statusLabel(record.selectedStatus)} / {record.status}</p>
        <p><strong>発動サポート:</strong> {record.supportPackStatus ?? "none"}</p>
        <p><strong>連絡先:</strong> {record.contactName || "-"} {record.contactEmail || ""}</p>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>診断結果</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(record.result, null, 2)}</pre>
      </section>
    </main>
  );
}
