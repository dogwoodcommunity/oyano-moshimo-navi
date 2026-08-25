"use client";

import { useEffect, useState } from "react";
import { adminHeaders } from "@/lib/adminClientAuth";

type FamilyUsage = {
  key: string;
  label: string;
  plan: "free" | "plus";
  apiCalls: number;
  successfulAnswers: number;
  todaySuccessfulAnswers: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  estimatedCostYen: number;
  limitStatus: "ok" | "near" | "limit" | "daily-free";
};

type UsageResponse = {
  limits?: {
    perClientDaily: number;
    perFamilyMonthly: number;
    serviceDaily: number;
  };
  exchangeRate?: number;
  summary?: {
    apiCalls: number;
    todayApiCalls: number;
    successfulAnswers: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    estimatedCostYen: number;
  };
  families?: FamilyUsage[];
  error?: string;
  message?: string;
};

function statusLabel(status: FamilyUsage["limitStatus"]) {
  if (status === "limit") return "月上限";
  if (status === "near") return "上限間近";
  if (status === "daily-free") return "無料・1日1回";
  return "利用可";
}

function statusClass(status: FamilyUsage["limitStatus"]) {
  return status === "ok" ? "admin-chip success" : "admin-chip warning";
}

export function AdminAiUsage() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function loadUsage() {
      setError("");
      setData(null);
      fetch("/api/admin/ai-usage", { headers: adminHeaders() })
        .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(body)))
        .then((body: UsageResponse) => setData(body))
        .catch((body: UsageResponse) => setError(body?.message ?? body?.error ?? "AI利用状況を読み込めませんでした。"));
    }

    loadUsage();
    window.addEventListener("admin-auth-changed", loadUsage);
    return () => window.removeEventListener("admin-auth-changed", loadUsage);
  }, []);

  if (error) return <p className="admin-error">{error}</p>;
  if (!data?.summary || !data.limits) return <p className="hint">AI利用状況を読み込んでいます。</p>;

  const { summary, limits } = data;
  const families = data.families ?? [];

  return (
    <div>
      <div className="admin-metrics-summary">
        <article>
          <span>今月の回答</span>
          <strong>{summary.successfulAnswers.toLocaleString("ja-JP")}</strong>
          <p>成功した回答。Family Plusは1家族あたり月{limits.perFamilyMonthly}回まで</p>
        </article>
        <article>
          <span>今日のAPI呼び出し</span>
          <strong>{summary.todayApiCalls} / {limits.serviceDaily}</strong>
          <p>失敗や拒否でもAPI原価が発生した呼び出しを含みます</p>
        </article>
        <article>
          <span>今月の概算原価</span>
          <strong>¥{summary.estimatedCostYen.toLocaleString("ja-JP")}</strong>
          <p>${summary.estimatedCostUsd.toFixed(4)}（$1=¥{data.exchangeRate ?? 150}の運営用概算）</p>
        </article>
      </div>

      <p className="admin-metrics-note" style={{ marginBottom: 14 }}>
        無料は1日1回答、Plusは1日{limits.perClientDaily}回・月{limits.perFamilyMonthly}回です。
        回数と原価は回答に利用したAI APIログから集計しています。
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>家族</th>
              <th>plan</th>
              <th>today</th>
              <th>month</th>
              <th>API calls</th>
              <th>tokens</th>
              <th>cost</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {families.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td><span className={row.plan === "plus" ? "admin-chip success" : "admin-chip"}>{row.plan}</span></td>
                <td className="numeric">{row.todaySuccessfulAnswers} / {row.plan === "plus" ? limits.perClientDaily : 1}</td>
                <td className="numeric">{row.successfulAnswers}{row.plan === "plus" ? ` / ${limits.perFamilyMonthly}` : ""}</td>
                <td className="numeric">{row.apiCalls}</td>
                <td className="numeric">
                  {row.inputTokens.toLocaleString("ja-JP")} in<br />
                  {row.outputTokens.toLocaleString("ja-JP")} out
                </td>
                <td className="numeric">
                  ¥{row.estimatedCostYen.toLocaleString("ja-JP")}<br />
                  <small>${row.estimatedCostUsd.toFixed(4)}</small>
                </td>
                <td><span className={statusClass(row.limitStatus)}>{statusLabel(row.limitStatus)}</span></td>
              </tr>
            ))}
            {families.length === 0 && <tr><td colSpan={8}>AI相談の利用履歴はまだありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
