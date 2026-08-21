"use client";

import { useCallback, useEffect, useState } from "react";
import { funnelRate, type FunnelSummary } from "@oyano/shared";
import { adminHeaders } from "@/lib/adminClientAuth";

const ranges = [7, 30, 90];

export function AdminFunnel() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<FunnelSummary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/funnel?days=${range}`, { headers: adminHeaders() });
      const data = await response.json() as { summary?: FunnelSummary; message?: string };

      if (!response.ok || !data.summary) {
        setSummary(null);
        setMessage(data.message ?? "集計を読み込めませんでした。Admin tokenを確認してください。");
        return;
      }

      setSummary(data.summary);
    } catch {
      setSummary(null);
      setMessage("通信できませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const opened = summary?.crisisOpened ?? 0;
  const created = summary?.personCreated ?? 0;
  const returned = summary?.returnedWithin7Days ?? 0;

  return (
    <section className="panel admin-control-panel" style={{ marginTop: 18 }}>
      <p className="eyebrow">この1つだけ見る</p>
      <h2>危機モードを開いた人が、記録を続けたか</h2>
      <p className="hint">
        危機モードは、その夜に価値を出して終わる機能です。開いた人が対象者を登録し、7日以内に2件目の記録を書いたかどうかが、
        これが単発のツールなのか、続けて使うものなのかを分けます。
      </p>

      <div className="meta-row" style={{ marginTop: 12 }}>
        {ranges.map((range) => (
          <button
            className={range === days ? "button" : "secondary"}
            key={range}
            onClick={() => setDays(range)}
            type="button"
          >
            直近{range}日
          </button>
        ))}
      </div>

      {loading ? <p className="hint">読み込み中です</p> : null}
      {message ? <p className="hint">{message}</p> : null}

      {summary ? (
        <>
          <div className="admin-stat-grid" style={{ marginTop: 14 }}>
            <article className="admin-stat">
              <strong>{opened}</strong>
              <span>危機モードを開いた</span>
              <small>アプリ {summary.crisisOpenedApp} / Web {summary.crisisOpenedWeb}</small>
            </article>
            <article className="admin-stat">
              <strong>{created}</strong>
              <span>対象者を登録した</span>
              <small>{funnelRate(created, opened)}</small>
            </article>
            <article className="admin-stat">
              <strong>{returned}</strong>
              <span>7日以内に2件目を書いた</span>
              <small>{funnelRate(returned, opened)}</small>
            </article>
          </div>

          <p className="hint" style={{ marginTop: 12 }}>
            この一番右が数%なら、危機モードは良い無料ツールであって事業ではありません。20%を超えるなら、そこに賭けてよい数字です。
          </p>

          <div className="meta-row" style={{ marginTop: 12 }}>
            {Object.entries(summary.eventTotals).map(([event, total]) => (
              <span className="meta-chip" key={event}>{event}: {total}</span>
            ))}
          </div>

          <p className="hint" style={{ marginTop: 10 }}>
            匿名IDは端末ごとです。Webで開いた人がアプリで続けたかは追えません。Web入口とアプリは別々の数字として見てください。
          </p>
        </>
      ) : null}
    </section>
  );
}
