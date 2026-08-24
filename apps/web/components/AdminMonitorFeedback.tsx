"use client";

import { useEffect, useMemo, useState } from "react";
import { adminHeaders } from "@/lib/adminClientAuth";

type ResponseRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  screenshotUrls?: string[];
};

function value(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "string" ? metadata[key] : "";
}

function list(metadata: Record<string, unknown>, key: string) {
  return Array.isArray(metadata[key])
    ? (metadata[key] as unknown[]).filter((item): item is string => typeof item === "string")
    : [];
}

function answer(text: string) {
  return text || "回答なし";
}

export function AdminMonitorFeedback() {
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      setLoading(true);
      setError("");
      fetch("/api/admin/monitor-feedback", { headers: adminHeaders() })
        .then((response) => response.ok
          ? response.json()
          : response.json().then((body) => Promise.reject({ ...body, status: response.status })))
        .then((body: { responses?: ResponseRow[] }) => setRows(body.responses ?? []))
        .catch((body: { message?: string; error?: string; status?: number }) => {
          setError(body?.status === 401
            ? "上の管理者認証を完了すると、ここに回答が表示されます。"
            : body?.message ?? body?.error ?? "回答を読み込めませんでした。");
        })
        .finally(() => setLoading(false));
    }
    load();
    window.addEventListener("admin-auth-changed", load);
    return () => window.removeEventListener("admin-auth-changed", load);
  }, []);

  const summary = useMemo(() => ({
    total: rows.length,
    sevenDays: rows.filter((row) => value(row.metadata ?? {}, "usagePeriod") === "7日間").length,
    dailyRecords: rows.filter((row) => value(row.metadata ?? {}, "recordCount") === "7日すべて").length,
    pays: rows.filter((row) => ["月980円なら利用したい", "年9,800円なら利用したい"]
      .includes(value(row.metadata ?? {}, "paymentIntent"))).length
  }), [rows]);

  if (loading) return <p className="admin-empty-state">回答を読み込んでいます。</p>;
  if (error) return <p className="admin-auth-warning">{error}</p>;

  return (
    <div>
      <div className="admin-metrics-summary">
        <article><span>届いた回答</span><strong>{summary.total}<small>件</small></strong><p>送信済みの回答数</p></article>
        <article><span>7日間利用</span><strong>{summary.sevenDays}<small>人</small></strong><p>7日間アプリを開いた</p></article>
        <article><span>毎日記録</span><strong>{summary.dailyRecords}<small>人</small></strong><p>7日すべて記録した</p></article>
        <article><span>支払意向あり</span><strong>{summary.pays}<small>人</small></strong><p>月額か年額を選んだ</p></article>
      </div>

      {rows.length === 0 ? (
        <p className="admin-empty-state">回答はまだ届いていません。</p>
      ) : (
        <div className="admin-feedback-list">
          {rows.map((row, index) => {
            const metadata = row.metadata ?? {};
            const monitorCode = value(metadata, "monitorCode") || `回答 ${rows.length - index}`;
            const screenshots = row.screenshotUrls ?? [];
            return (
              <details className="admin-feedback-card" key={row.id} open={index === 0}>
                <summary>
                  <div>
                    <strong>{monitorCode}</strong>
                    <span>{new Date(row.created_at).toLocaleString("ja-JP")}</span>
                  </div>
                  <div className="admin-feedback-tags">
                    <span>{answer(value(metadata, "usagePeriod"))}</span>
                    <span>{answer(value(metadata, "paymentIntent"))}</span>
                  </div>
                </summary>
                <div className="admin-feedback-body">
                  <section>
                    <h3>モニターについて</h3>
                    <dl>
                      <div><dt>年代</dt><dd>{answer(value(metadata, "ageGroup"))}</dd></div>
                      <div><dt>介護する相手</dt><dd>{answer(value(metadata, "careRelation"))}</dd></div>
                      <div><dt>現在の状況</dt><dd>{answer(value(metadata, "careSituation"))}</dd></div>
                      <div><dt>使用端末</dt><dd>{answer(value(metadata, "device"))}</dd></div>
                    </dl>
                  </section>
                  <section>
                    <h3>7日間で試したこと</h3>
                    <dl>
                      <div><dt>利用期間</dt><dd>{answer(value(metadata, "usagePeriod"))}</dd></div>
                      <div><dt>記録回数</dt><dd>{answer(value(metadata, "recordCount"))}</dd></div>
                      <div><dt>保存した記録の再確認</dt><dd>{answer(value(metadata, "savedRecord"))}</dd></div>
                      <div><dt>確認リスト</dt><dd>{answer(value(metadata, "checklistTried"))}</dd></div>
                      <div><dt>書類の所在メモ</dt><dd>{answer(value(metadata, "documentMemoTried"))}</dd></div>
                      <div><dt>家族招待</dt><dd>{answer(value(metadata, "familyInviteTried"))}</dd></div>
                      <div><dt>AI相談</dt><dd>{answer(value(metadata, "aiConsult"))}</dd></div>
                    </dl>
                  </section>
                  <section className="is-wide">
                    <h3>率直な感想</h3>
                    <dl>
                      <div><dt>指が止まった場所</dt><dd>{list(metadata, "stoppedAt").join("、") || "回答なし"}</dd></div>
                      <div><dt>分かりにくかったこと</dt><dd>{answer(value(metadata, "confusingPoint"))}</dd></div>
                      <div><dt>役に立ったこと</dt><dd>{answer(value(metadata, "usefulPoint"))}</dd></div>
                      <div><dt>足りないこと</dt><dd>{answer(value(metadata, "missingPoint"))}</dd></div>
                      <div><dt>7日後も使いたいか</dt><dd>{answer(value(metadata, "returnIntent"))}</dd></div>
                      <div><dt>家族と共有したいか</dt><dd>{answer(value(metadata, "familyShare"))}</dd></div>
                      <div><dt>支払意向</dt><dd>{answer(value(metadata, "paymentIntent"))}</dd></div>
                    </dl>
                  </section>
                  {screenshots.length > 0 && (
                    <section className="is-wide">
                      <h3>添付された画面</h3>
                      <div className="admin-feedback-screenshots">
                        {screenshots.map((url, screenshotIndex) => (
                          <a href={url} key={url} target="_blank" rel="noreferrer">
                            スクリーンショット {screenshotIndex + 1} を開く
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
