"use client";

import { useEffect, useMemo, useState } from "react";
import { adminHeaders } from "@/lib/adminClientAuth";

type ResponseRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  screenshotUrls?: string[];
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
    sevenDays: rows.filter((row) => text(row.metadata ?? {}, "usagePeriod") === "7日間").length,
    threeRecords: rows.filter((row) => text(row.metadata ?? {}, "recordCount") === "3回以上").length,
    pays: rows.filter((row) => ["月980円なら利用したい", "年9,800円なら利用したい"].includes(text(row.metadata ?? {}, "paymentIntent"))).length
  }), [rows]);

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div>
      <div className="admin-metrics-summary">
        <article><span>回答</span><strong>{summary.total}</strong><p>送信済みのモニター回答</p></article>
        <article><span>7日利用</span><strong>{summary.sevenDays}</strong><p>7日間画面を開いた</p></article>
        <article><span>記録3回以上</span><strong>{summary.threeRecords}</strong><p>記録習慣の最低条件</p></article>
        <article><span>支払意向</span><strong>{summary.pays}</strong><p>月額または年額を選択</p></article>
      </div>
      <div className="admin-table-wrap" style={{ marginTop: 18 }}>
        <table className="admin-table">
          <thead><tr><th>日時</th><th>モニター</th><th>背景/端末</th><th>利用/記録</th><th>試した機能</th><th>迷った場所</th><th>AI相談</th><th>継続/共有</th><th>支払意向</th><th>スクショ</th><th>自由記述</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const m = row.metadata ?? {};
              return (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ja-JP")}</td>
                  <td>{text(m, "monitorCode")}</td>
                  <td>{text(m, "ageGroup")} / {text(m, "careRelation")}<br />{text(m, "careSituation")}<br />{text(m, "device")}</td>
                  <td>{text(m, "usagePeriod")}<br />記録: {text(m, "recordCount")}<br />再発見: {text(m, "savedRecord")}</td>
                  <td>リスト: {text(m, "checklistTried")}<br />書類: {text(m, "documentMemoTried")}<br />招待: {text(m, "familyInviteTried")}</td>
                  <td>{Array.isArray(m.stoppedAt) ? m.stoppedAt.join("、") : ""}</td>
                  <td>{text(m, "aiConsult")}</td>
                  <td>{text(m, "returnIntent")}<br />共有: {text(m, "familyShare")}</td>
                  <td>{text(m, "paymentIntent")}</td>
                  <td>{(row.screenshotUrls ?? []).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">画像{index + 1}{index < (row.screenshotUrls?.length ?? 0) - 1 ? " / " : ""}</a>)}</td>
                  <td><strong>迷い:</strong> {text(m, "confusingPoint")}<br /><strong>価値:</strong> {text(m, "usefulPoint")}<br /><strong>不足:</strong> {text(m, "missingPoint")}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={11}>回答はまだありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
