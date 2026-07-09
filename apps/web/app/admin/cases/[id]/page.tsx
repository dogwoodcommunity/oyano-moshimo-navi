"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { adminHeaders } from "@/lib/adminClientAuth";
import { getLocalCase } from "@/lib/store";
import { statusLabel, type DiagnosisAnswers } from "@oyano/shared";
import type { AdminCaseDetail } from "@/app/api/admin/cases/[caseId]/route";

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
  const answers = record.answers as Partial<DiagnosisAnswers> | undefined;
  const consentToSensitiveInfo = "consentToSensitiveInfo" in record
    ? record.consentToSensitiveInfo
    : Boolean(answers?.consentToSensitiveInfo);
  const consentVersion = "sensitiveInfoConsentVersion" in record
    ? record.sensitiveInfoConsentVersion
    : answers?.consentTextVersion;
  const consentedAt = "sensitiveInfoConsentedAt" in record ? record.sensitiveInfoConsentedAt : undefined;
  const consentLogs = "consentLogs" in record ? record.consentLogs : [];

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
          <div>
            <span>要配慮情報の同意</span>
            <strong>
              <span className={`admin-chip ${consentToSensitiveInfo ? "success" : ""}`}>
                {consentToSensitiveInfo ? "同意あり" : "未確認"}
              </span>
            </strong>
          </div>
          <div>
            <span>同意バージョン</span>
            <strong>{consentVersion || "-"}</strong>
          </div>
          <div>
            <span>同意日時</span>
            <strong>{consentedAt ? new Date(consentedAt).toLocaleString("ja-JP") : "-"}</strong>
          </div>
        </div>
      </section>
      {consentLogs.length > 0 ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Consent logs</p>
              <h2>同意履歴</h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>種別</th>
                  <th>日時</th>
                  <th>文言</th>
                </tr>
              </thead>
              <tbody>
                {consentLogs.map((item) => (
                  <tr key={item.id}>
                    <td>{item.consentType}</td>
                    <td>{new Date(item.createdAt).toLocaleString("ja-JP")}</td>
                    <td>{item.consentText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
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
