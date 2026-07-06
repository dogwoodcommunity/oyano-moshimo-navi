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
    return (
      <main className="container">
        <section className="admin-hero compact">
          <p className="pill">Cases</p>
          <h1 className="page-title">case not found</h1>
          <p className="lead">指定されたcaseは見つかりませんでした。Admin tokenまたはlocalStorageのデモcaseを確認してください。</p>
        </section>
      </main>
    );
  }

  const supportPackStatus = "supportPacks" in record
    ? record.supportPacks.map((item) => item.status).join(", ") || "none"
    : record.supportPackStatus ?? "none";

  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="pill">Case detail</p>
        <h1 className="page-title">case確認</h1>
        <p className="lead">診断入力、結果、発動サポートの状態を確認します。法律・税務判断の断定は行わず、整理支援として扱います。</p>
      </section>
      <section className="panel">
        <div className="admin-detail-grid">
          <div>
            <span>ID</span>
            <strong>{record.id}</strong>
          </div>
          <div>
            <span>状態</span>
            <strong>{statusLabel(record.selectedStatus)} <span className="admin-chip">{record.status}</span></strong>
          </div>
          <div>
            <span>発動サポート</span>
            <strong><span className={`admin-chip ${supportPackStatus !== "none" ? "success" : ""}`}>{supportPackStatus}</span></strong>
          </div>
          <div>
            <span>連絡先</span>
            <strong>{record.contactName || "-"} {record.contactEmail || ""}</strong>
          </div>
        </div>
      </section>
      {"answers" in record ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Diagnosis input</p>
              <h2>回答</h2>
            </div>
          </div>
          <pre className="admin-json">{JSON.stringify(record.answers, null, 2)}</pre>
        </section>
      ) : null}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Generated result</p>
            <h2>診断結果</h2>
          </div>
        </div>
        <pre className="admin-json">{JSON.stringify(record.result, null, 2)}</pre>
      </section>
    </main>
  );
}
