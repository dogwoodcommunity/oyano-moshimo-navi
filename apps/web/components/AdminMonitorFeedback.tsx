"use client";

import { useEffect, useMemo, useState } from "react";
import { adminHeaders } from "@/lib/adminClientAuth";

type ResponseRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function text(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "string" ? metadata[key] : "";
}

export function AdminMonitorFeedback() {
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    function load() {
      setError("");
      fetch("/api/admin/monitor-feedback", { headers: adminHeaders() })
        .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(body)))
        .then((body: { responses?: ResponseRow[] }) => setRows(body.responses ?? []))
        .catch((body: { message?: string; error?: string }) => setError(body?.message ?? body?.error ?? "回答を読み込めませんでした。"));
    }
    load();
    window.addEventListener("admin-auth-changed", load);
    return () => window.removeEventListener("admin-auth-changed", load);
  }, []);

  const summary = useMemo(() => ({
    total: rows.length,
    completed: rows.filter((row) => text(row.metadata ?? {}, "completion") === "手助けなしで完了できた").length,
    returns: rows.filter((row) => ["ぜひ戻りたい", "たぶん戻る"].includes(text(row.metadata ?? {}, "returnIntent"))).length,
    pays: rows.filter((row) => ["月980円なら利用したい", "年9,800円なら利用したい"].includes(text(row.metadata ?? {}, "paymentIntent"))).length
  }), [rows]);

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div>
      <div className="admin-metrics-summary">
        <article><span>回答</span><strong>{summary.total}</strong><p>送信済みのモニター回答</p></article>
        <article><span>自力完走</span><strong>{summary.completed}</strong><p>手助けなしで完了</p></article>
        <article><span>7日後も利用</span><strong>{summary.returns}</strong><p>「ぜひ」「たぶん」の合計</p></article>
        <article><span>支払意向</span><strong>{summary.pays}</strong><p>月額または年額を選択</p></article>
      </div>
      <div className="admin-table-wrap" style={{ marginTop: 18 }}>
        <table className="admin-table">
          <thead><tr><th>日時</th><th>モニター</th><th>年代/端末</th><th>完走</th><th>迷った場所</th><th>AI相談</th><th>7日後</th><th>支払意向</th><th>自由記述</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const m = row.metadata ?? {};
              return (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ja-JP")}</td>
                  <td>{text(m, "monitorCode")}</td>
                  <td>{text(m, "ageGroup")}<br />{text(m, "device")}</td>
                  <td>{text(m, "completion")}</td>
                  <td>{Array.isArray(m.stoppedAt) ? m.stoppedAt.join("、") : ""}</td>
                  <td>{text(m, "aiConsult")}</td>
                  <td>{text(m, "returnIntent")}</td>
                  <td>{text(m, "paymentIntent")}</td>
                  <td>{text(m, "confusingPoint")}<br />{text(m, "usefulPoint")}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={9}>回答はまだありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
