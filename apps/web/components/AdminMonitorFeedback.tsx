"use client";

import { useEffect, useMemo, useState } from "react";
import { adminHeaders } from "@/lib/adminClientAuth";

type ResponseRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  screenshotUrls?: string[];
};

type ProgressUsageMetrics = {
  capturedAt: string | null;
  monitorStartedAt: string | null;
  reportDueAt: string | null;
  appOpenCount: number;
  appOpenDistinctDayCount: number;
  storedDiaryEntryCount: number;
  storedDiaryDistinctDateCount: number;
  manualRecordSaveCount: number;
  manualRecordDistinctDayCount: number;
  lastManualRecordDayNumber: number | null;
  taskUpdateCount: number;
  diaryHistoryOpened: boolean;
  checklistOpened: boolean;
  documentMemoSaved: boolean;
  familyInviteOpened: boolean;
  aiConsultCompleted: boolean;
  cloudBackupConfirmed: boolean;
};

type ProgressRow = {
  id: string;
  source: "progress" | "final-response";
  startedAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  reportDueAt: string | null;
  reportSubmittedAt: string | null;
  dayNumber: number | null;
  isReportDue: boolean;
  finalResponseSubmitted: boolean;
  finalResponseId: string | null;
  finalResponseName: string | null;
  usageMetrics: ProgressUsageMetrics;
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

function usageMetrics(metadata: Record<string, unknown>) {
  return metadata.usageMetrics && typeof metadata.usageMetrics === "object"
    ? metadata.usageMetrics as Record<string, unknown>
    : {};
}

function metricNumber(metadata: Record<string, unknown>, key: string) {
  const metric = usageMetrics(metadata)[key];
  return typeof metric === "number" && Number.isFinite(metric) ? metric : null;
}

function metricDone(metadata: Record<string, unknown>, key: string) {
  return usageMetrics(metadata)[key] === true ? "確認あり" : "確認なし";
}

function dateTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "取得なし";
  return new Date(value).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function progressDone(done: boolean) {
  return done ? "実施を確認" : "まだ確認なし";
}

export function AdminMonitorFeedback() {
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let disposed = false;
    let fullController: AbortController | null = null;
    let progressController: AbortController | null = null;

    async function load(progressOnly = false) {
      if (progressOnly && fullController) return;
      if (progressOnly) {
        progressController?.abort();
      } else {
        fullController?.abort();
        progressController?.abort();
        setRefreshing(true);
        setError("");
      }
      const controller = new AbortController();
      if (progressOnly) progressController = controller;
      else fullController = controller;

      try {
        const response = await fetch(
          progressOnly ? "/api/admin/monitor-feedback?progressOnly=1" : "/api/admin/monitor-feedback",
          { headers: adminHeaders(), cache: "no-store", signal: controller.signal }
        );
        const body = await response.json().catch(() => ({})) as {
          responses?: ResponseRow[];
          progress?: ProgressRow[];
          message?: string;
          error?: string;
        };
        if (!response.ok) throw { ...body, status: response.status };
        if (disposed || controller.signal.aborted) return;
        if (!progressOnly) setRows(body.responses ?? []);
        setProgressRows(body.progress ?? []);
        setLastUpdatedAt(new Date());
      } catch (caught) {
        if (disposed || controller.signal.aborted || progressOnly) return;
        const body = caught as { message?: string; error?: string; status?: number };
        setError(body?.status === 401
          ? "上の管理者認証を完了すると、ここに回答が表示されます。"
          : body?.message ?? body?.error ?? "回答を読み込めませんでした。");
      } finally {
        if (progressOnly && progressController === controller) progressController = null;
        if (!progressOnly && fullController === controller) {
          fullController = null;
          if (!disposed) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      }
    }

    void load();
    const timer = window.setInterval(() => void load(true), 60_000);
    const reloadAfterAuthentication = () => void load();
    window.addEventListener("admin-auth-changed", reloadAfterAuthentication);
    return () => {
      disposed = true;
      fullController?.abort();
      progressController?.abort();
      window.clearInterval(timer);
      window.removeEventListener("admin-auth-changed", reloadAfterAuthentication);
    };
  }, [refreshKey]);

  const summary = useMemo(() => {
    const recentThreshold = Date.now() - (48 * 60 * 60 * 1000);
    return {
      started: progressRows.length,
      notebookReached: progressRows.filter((row) => row.usageMetrics.appOpenDistinctDayCount > 0 || row.finalResponseSubmitted).length,
      recentlyActive: progressRows.filter((row) => row.lastSeenAt && Date.parse(row.lastSeenAt) >= recentThreshold).length,
      threePlusRecords: progressRows.filter((row) => row.usageMetrics.manualRecordDistinctDayCount >= 3).length,
      submitted: rows.length
    };
  }, [progressRows, rows]);

  function revealFinalResponse(responseId: string) {
    const target = document.getElementById(`monitor-response-${responseId}`);
    if (!(target instanceof HTMLDetailsElement)) return;
    target.open = true;
    window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (loading) return <p className="admin-empty-state">回答を読み込んでいます。</p>;
  if (error) return <p className="admin-auth-warning">{error}</p>;

  return (
    <div>
      <div className="admin-metrics-summary">
        <article><span>テスト開始操作</span><strong>{summary.started}<small>件</small></strong><p>やり直し等を含む参考値</p></article>
        <article><span>手帳まで到達</span><strong>{summary.notebookReached}<small>件</small></strong><p>初期設定後の画面を確認</p></article>
        <article><span>直近48時間に利用</span><strong>{summary.recentlyActive}<small>件</small></strong><p>最近の利用を確認</p></article>
        <article><span>3日以上記録</span><strong>{summary.threePlusRecords}<small>件</small></strong><p>端末の自動カウント</p></article>
        <article><span>最終回答提出済み</span><strong>{summary.submitted}<small>件</small></strong><p>アンケートの送信完了数</p></article>
      </div>

      <div className="admin-monitor-refresh">
        <p>{lastUpdatedAt ? `最終更新 ${lastUpdatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "更新時刻を確認中"}・1分ごとに自動更新</p>
        <button type="button" disabled={refreshing} onClick={() => setRefreshKey((current) => current + 1)}>
          {refreshing ? "更新中…" : "今すぐ更新"}
        </button>
      </div>

      <section className="admin-monitor-section" aria-labelledby="monitor-progress-heading">
        <h2 id="monitor-progress-heading">開始・途中利用（参考）</h2>
        <p className="admin-metrics-note">
          途中経過では名前や記録本文を送らず、開始日・利用日数・試した機能だけを、本人が共有に同意した後に反映します。
          公開URLから受信したテスト開始単位の参考値で、やり直し、履歴削除、運営の動作確認は別件になることがあります。募集人数そのものではありません。
          この機能の公開後に画面を開いて同意した方から順次表示されます。
        </p>
        {progressRows.length === 0 ? (
          <p className="admin-empty-state">
            途中経過はまだ届いていません。利用中の方が画面を開き、「同意して共有する」を押すと反映されます。
          </p>
        ) : (
          <div className="admin-feedback-list">
            {progressRows.map((row) => (
              <details className="admin-feedback-card" key={row.id}>
                <summary>
                  <div>
                    <strong>{row.source === "final-response" ? `${row.finalResponseName ?? "名前未取得"}（最終回答から補完）` : `テスト ${row.id.slice(-4).toUpperCase()}`}</strong>
                    <span>最終利用 {dateTime(row.lastSeenAt)}</span>
                  </div>
                  <div className="admin-feedback-tags">
                    <span>{row.isReportDue ? "回答期間" : row.dayNumber ? `最終同期時 ${row.dayNumber}日目` : "日数取得なし"}</span>
                    <span>記録 {row.usageMetrics.manualRecordDistinctDayCount}日</span>
                    <span>{row.finalResponseSubmitted ? "最終回答済み" : "最終回答前"}</span>
                  </div>
                </summary>
                <div className="admin-feedback-body">
                  <section>
                    <h3>利用状況</h3>
                    <dl>
                      <div><dt>モニター開始</dt><dd>{dateTime(row.startedAt)}</dd></div>
                      <div><dt>サーバー初回確認</dt><dd>{dateTime(row.firstSeenAt)}</dd></div>
                      <div><dt>最終利用</dt><dd>{dateTime(row.lastSeenAt)}</dd></div>
                      <div><dt>最終同期時の日数</dt><dd>{row.dayNumber ? `${row.dayNumber}日目` : "取得なし"}</dd></div>
                      <div><dt>アンケート開始予定</dt><dd>{dateTime(row.reportDueAt)}</dd></div>
                      <div><dt>最終回答</dt><dd>{row.finalResponseId ? <a className="admin-inline-link" href={`#monitor-response-${row.finalResponseId}`} onClick={() => revealFinalResponse(row.finalResponseId!)}>{row.finalResponseName ?? "回答"}の回答を見る</a> : "未提出"}</dd></div>
                    </dl>
                  </section>
                  <section>
                    <h3>記録の自動集計</h3>
                    <dl>
                      <div><dt>アプリを開いた日数</dt><dd>{row.usageMetrics.appOpenDistinctDayCount}日</dd></div>
                      <div><dt>今日の記録を書いた日数</dt><dd>{row.usageMetrics.manualRecordDistinctDayCount}日</dd></div>
                      <div><dt>今日の記録の保存回数</dt><dd>{row.usageMetrics.manualRecordSaveCount}回</dd></div>
                      <div><dt>最後に記録した日</dt><dd>{row.usageMetrics.lastManualRecordDayNumber ? `${row.usageMetrics.lastManualRecordDayNumber}日目` : "まだ確認なし"}</dd></div>
                    </dl>
                  </section>
                  <section className="is-wide">
                    <h3>機能を試した状況</h3>
                    <dl>
                      <div><dt>過去の記録</dt><dd>{progressDone(row.usageMetrics.diaryHistoryOpened)}</dd></div>
                      <div><dt>確認リスト</dt><dd>{progressDone(row.usageMetrics.checklistOpened)}</dd></div>
                      <div><dt>書類の所在メモ</dt><dd>{progressDone(row.usageMetrics.documentMemoSaved)}</dd></div>
                      <div><dt>家族招待画面</dt><dd>{progressDone(row.usageMetrics.familyInviteOpened)}</dd></div>
                      <div><dt>AI相談</dt><dd>{progressDone(row.usageMetrics.aiConsultCompleted)}</dd></div>
                      <div><dt>クラウドの控え</dt><dd>{progressDone(row.usageMetrics.cloudBackupConfirmed)}</dd></div>
                    </dl>
                  </section>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="admin-monitor-section" aria-labelledby="monitor-final-responses-heading">
        <h2 id="monitor-final-responses-heading">最終回答提出済み</h2>
        <p className="admin-metrics-note">7日間終了後に、最終アンケートの送信まで完了した回答です。</p>

      {rows.length === 0 ? (
        <p className="admin-empty-state">最終回答はまだ届いていません。</p>
      ) : (
        <div className="admin-feedback-list">
          {rows.map((row, index) => {
            const metadata = row.metadata ?? {};
            const crowdworksName = value(metadata, "crowdworksName")
              || value(metadata, "monitorCode")
              || `回答 ${rows.length - index}`;
            const submittedAt = value(metadata, "submittedAt") || row.created_at;
            const screenshots = row.screenshotUrls ?? [];
            return (
              <details className="admin-feedback-card" id={`monitor-response-${row.id}`} key={row.id}>
                <summary>
                  <div>
                    <strong>{crowdworksName}</strong>
                    <span>{new Date(submittedAt).toLocaleString("ja-JP")}</span>
                  </div>
                  <div className="admin-feedback-tags">
                    <span>{answer(value(metadata, "usagePeriod"))}</span>
                    <span>{answer(value(metadata, "priceReaction") || value(metadata, "paymentIntent"))}</span>
                  </div>
                </summary>
                <div className="admin-feedback-body">
                  <section>
                    <h3>モニターについて</h3>
                    <dl>
                      <div><dt>クラウドワークス名</dt><dd>{answer(crowdworksName)}</dd></div>
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
                      <div><dt>記録回数（自己申告）</dt><dd>{answer(value(metadata, "recordCount"))}</dd></div>
                      <div><dt>記録した日数（自動）</dt><dd>{metricNumber(metadata, "manualRecordDistinctDayCount") ?? "取得なし"}</dd></div>
                      <div><dt>記録保存回数（自動）</dt><dd>{metricNumber(metadata, "manualRecordSaveCount") ?? "取得なし"}</dd></div>
                      <div><dt>最終記録日（自動）</dt><dd>{metricNumber(metadata, "lastManualRecordDayNumber") ? `${metricNumber(metadata, "lastManualRecordDayNumber")}日目` : "取得なし"}</dd></div>
                      <div><dt>保存した記録の再確認</dt><dd>{answer(value(metadata, "savedRecord"))}</dd></div>
                      <div><dt>確認リスト</dt><dd>{answer(value(metadata, "checklistTried"))}</dd></div>
                      <div><dt>書類の所在メモ</dt><dd>{answer(value(metadata, "documentMemoTried"))}</dd></div>
                      <div><dt>家族招待</dt><dd>{answer(value(metadata, "familyInviteTried"))}</dd></div>
                      <div><dt>AI相談</dt><dd>{answer(value(metadata, "aiConsult"))}</dd></div>
                    </dl>
                  </section>
                  <section>
                    <h3>端末の自動計測</h3>
                    <dl>
                      <div><dt>初回登録時間</dt><dd>{metricNumber(metadata, "registrationDurationSeconds") !== null ? `${metricNumber(metadata, "registrationDurationSeconds")}秒` : "取得なし"}</dd></div>
                      <div><dt>手帳を開いた日数</dt><dd>{metricNumber(metadata, "appOpenDistinctDayCount") ?? "取得なし"}</dd></div>
                      <div><dt>過去記録を開いた</dt><dd>{metricDone(metadata, "diaryHistoryOpened")}</dd></div>
                      <div><dt>確認リストを開いた</dt><dd>{metricDone(metadata, "checklistOpened")}</dd></div>
                      <div><dt>書類メモを保存</dt><dd>{metricDone(metadata, "documentMemoSaved")}</dd></div>
                      <div><dt>家族招待画面を開いた</dt><dd>{metricDone(metadata, "familyInviteOpened")}</dd></div>
                      <div><dt>AI相談が成功</dt><dd>{metricDone(metadata, "aiConsultCompleted")}</dd></div>
                      <div><dt>クラウド控え</dt><dd>{metricDone(metadata, "cloudBackupConfirmed")}</dd></div>
                    </dl>
                  </section>
                  <section className="is-wide">
                    <h3>率直な感想</h3>
                    <dl>
                      <div><dt>最初に迷った場所</dt><dd>{answer(value(metadata, "firstStoppedAt"))}</dd></div>
                      <div><dt>ほかに迷った場所</dt><dd>{list(metadata, "stoppedAt").join("、") || "回答なし"}</dd></div>
                      <div><dt>分かりにくかったこと</dt><dd>{answer(value(metadata, "confusingPoint"))}</dd></div>
                      <div><dt>役に立ったこと</dt><dd>{answer(value(metadata, "usefulPoint"))}</dd></div>
                      <div><dt>足りないこと</dt><dd>{answer(value(metadata, "missingPoint"))}</dd></div>
                      <div><dt>7日後も使いたいか</dt><dd>{answer(value(metadata, "returnIntent"))}</dd></div>
                      <div><dt>家族と共有したいか</dt><dd>{answer(value(metadata, "familyShare"))}</dd></div>
                      <div><dt>アンカー前の支払上限</dt><dd>{answer(value(metadata, "willingnessToPay"))}</dd></div>
                      <div><dt>実価格への反応</dt><dd>{answer(value(metadata, "priceReaction") || value(metadata, "paymentIntent"))}</dd></div>
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
      </section>
    </div>
  );
}
