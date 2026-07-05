"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getLocalCase } from "@/lib/store";
import { statusLabel } from "@oyano/shared";
import type { AdminCaseDetail } from "@/app/api/admin/cases/[caseId]/route";

function adminHeaders(): HeadersInit {
  const token = window.localStorage.getItem("oyano_admin_token");
  return token ? { "x-admin-token": token } : {};
}

export default function AdminCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [remoteRecord, setRemoteRecord] = useState<AdminCaseDetail | null>(null);
  const localRecord = getLocalCase(params.id);

  useEffect(() => {
    fetch(`/api/admin/cases/${params.id}`, { headers: adminHeaders() })
      .then((response) => response.ok ? response.json() : null)
      .then((body: { caseDetail?: AdminCaseDetail | null } | null) => {
        setRemoteRecord(body?.caseDetail ?? null);
      });
  }, [params.id]);

  const record = remoteRecord ?? localRecord;

  if (!record) {
    return <main className="container"><h1 className="page-title">case not found</h1></main>;
  }

  return (
    <main className="container">
      <h1 className="page-title">case確認</h1>
      <section className="panel">
        <p><strong>ID:</strong> {record.id}</p>
        <p><strong>状態:</strong> {statusLabel(record.selectedStatus)} / {record.status}</p>
        <p><strong>発動サポート:</strong> {"supportPacks" in record ? record.supportPacks.map((item) => item.status).join(", ") || "none" : record.supportPackStatus ?? "none"}</p>
        <p><strong>連絡先:</strong> {record.contactName || "-"} {record.contactEmail || ""}</p>
      </section>
      {"answers" in record ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>回答</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(record.answers, null, 2)}</pre>
        </section>
      ) : null}
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>診断結果</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(record.result, null, 2)}</pre>
      </section>
    </main>
  );
}
