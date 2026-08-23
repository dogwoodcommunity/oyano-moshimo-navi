"use client";

import { useEffect, useMemo, useState } from "react";
import { adminHeaders } from "@/lib/adminClientAuth";

type MetricRow = {
  prefecture: string;
  category: string;
  activeFamilies: number;
  previousMonthFamilies: number;
  monthOverMonthFamilies: number;
  publicStatus: "visible" | "hidden";
  partnerCompany?: string;
  partnerStatus?: string;
  pageViews: number;
  taps: number;
  inquiries: number;
};

type MetricsResponse = {
  rows?: MetricRow[];
  threshold?: number;
  source?: "supabase" | "not_configured" | "not_ready";
  message?: string;
  partnerMessage?: string;
  error?: string;
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function publicStatusLabel(value: MetricRow["publicStatus"]) {
  return value === "visible" ? "公開可" : "非公開";
}

export function AdminRegionalSponsorMetrics() {
  const [rows, setRows] = useState<MetricRow[] | null>(null);
  const [threshold, setThreshold] = useState(100);
  const [source, setSource] = useState<MetricsResponse["source"]>("not_configured");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/regional-sponsor-metrics", { headers: adminHeaders() })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(body)))
      .then((body: MetricsResponse) => {
        setRows(body.rows ?? []);
        setThreshold(body.threshold ?? 100);
        setSource(body.source ?? "supabase");
        setMessage(body.message ?? body.partnerMessage ?? "");
      })
      .catch((body: MetricsResponse) => {
        setError(body?.error ?? "地域スポンサー指標を読み込めませんでした。");
        setRows([]);
      });
  }, []);

  const summary = useMemo(() => {
    const prefectures = new Map<string, number>();
    let visiblePrefectures = 0;
    let activeSlots = 0;

    (rows ?? []).forEach((row) => {
      prefectures.set(row.prefecture, Math.max(prefectures.get(row.prefecture) ?? 0, row.activeFamilies));
      if (row.partnerStatus && row.partnerStatus !== "open") activeSlots += 1;
    });
    prefectures.forEach((count) => {
      if (count >= threshold) visiblePrefectures += 1;
    });

    return {
      activeFamilies: Array.from(prefectures.values()).reduce((sum, count) => sum + count, 0),
      visiblePrefectures,
      activeSlots
    };
  }, [rows, threshold]);

  function downloadCsv() {
    const header = [
      "都道府県",
      "分野",
      "有効会員数",
      "前月比",
      "公開表示",
      "スポンサー",
      "ステータス",
      "相談先ページ表示数",
      "タップ数",
      "問い合わせ数"
    ];
    const csv = [
      header.map(csvCell).join(","),
      ...(rows ?? []).map((row) => [
        row.prefecture,
        row.category,
        row.activeFamilies,
        row.monthOverMonthFamilies,
        publicStatusLabel(row.publicStatus),
        row.partnerCompany ?? "",
        row.partnerStatus ?? "",
        row.pageViews,
        row.taps,
        row.inquiries
      ].map(csvCell).join(","))
    ].join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `regional-sponsor-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return <p className="admin-error">{error}</p>;
  }

  const metrics = rows ?? [];

  return (
    <div className="admin-regional-metrics">
      <div className="admin-metrics-summary">
        <article>
          <span>有効会員</span>
          <strong>{summary.activeFamilies.toLocaleString("ja-JP")}</strong>
          <p>親の居住都道府県で集計</p>
        </article>
        <article>
          <span>公開対象県</span>
          <strong>{summary.visiblePrefectures}</strong>
          <p>{threshold}家族以上だけ公開表示</p>
        </article>
        <article>
          <span>掲載中枠</span>
          <strong>{summary.activeSlots}</strong>
          <p>県×分野のスポンサー枠</p>
        </article>
      </div>

      <div className="admin-metrics-actions">
        <p className="admin-metrics-note">
          {source === "not_ready"
            ? "DBの地域集計SQLが未反映です。SQL適用後に実数が入ります。"
            : "営業資料へ貼るための県×分野データです。公開側の数字は閾値制にしてください。"}
          {message ? <><br />{message}</> : null}
        </p>
        <button className="secondary" disabled={metrics.length === 0} type="button" onClick={downloadCsv}>
          CSVを出力
        </button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>prefecture</th>
              <th>category</th>
              <th>families</th>
              <th>public</th>
              <th>sponsor</th>
              <th>views</th>
              <th>taps</th>
              <th>inquiries</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((row) => (
              <tr key={`${row.prefecture}-${row.category}`}>
                <td>{row.prefecture}</td>
                <td><span className="admin-chip success">{row.category}</span></td>
                <td className="numeric">
                  {row.activeFamilies.toLocaleString("ja-JP")}
                  <br />
                  <small>前月比 {row.monthOverMonthFamilies >= 0 ? "+" : ""}{row.monthOverMonthFamilies}</small>
                </td>
                <td>
                  <span className={row.publicStatus === "visible" ? "admin-public-visible" : "admin-public-hidden"}>
                    {publicStatusLabel(row.publicStatus)}
                  </span>
                </td>
                <td>
                  {row.partnerCompany ?? "募集中"}
                  {row.partnerStatus ? <><br /><small>{row.partnerStatus}</small></> : null}
                </td>
                <td className="numeric">{row.pageViews.toLocaleString("ja-JP")}</td>
                <td className="numeric">{row.taps.toLocaleString("ja-JP")}</td>
                <td className="numeric">{row.inquiries.toLocaleString("ja-JP")}</td>
              </tr>
            ))}
            {metrics.length === 0 && <tr><td colSpan={8}>地域スポンサー指標はまだありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
