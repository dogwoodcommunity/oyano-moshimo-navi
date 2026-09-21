"use client";

import { useEffect, useRef, useState } from "react";
import { adminBearerHeaders, ADMIN_BEARER_TOKEN_STORAGE_KEY } from "@/lib/adminClientAuth";
import { AI_REPORT_PAGE_SIZE } from "@/lib/aiReportReviewClient";
import { AI_REPORT_REASON_LABELS, AI_REPORT_REVIEW_OPTIONS, aiReportReviewLabel, type AiReportDetail, type AiReportSummary } from "@/lib/aiReportReviewTypes";

type ReportPage = { reports: AiReportSummary[]; offset: number; hasMore: boolean };
const endpoint = "/api/admin/ai-reports";
const when = (value: string | null) => value ? new Date(value).toLocaleString("ja-JP") : "日時不明";
const selectionOf = (detail: AiReportDetail) => `${detail.review.status}:${detail.review.outcome}`;
const bearer = () => window.localStorage.getItem(ADMIN_BEARER_TOKEN_STORAGE_KEY);

export function AdminAiReports() {
  const [page, setPage] = useState<ReportPage | null>(null);
  const [detail, setDetail] = useState<AiReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const generation = useRef(0);
  const listRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  function clearPrivateContent() {
    generation.current += 1;
    listRequest.current?.abort();
    detailRequest.current?.abort();
    setPage(null); setDetail(null); setSelection(""); setLoading(false); setSaving(false); setMessage(""); setError("");
  }

  async function loadPage(offset = 0) {
    clearPrivateContent();
    const token = bearer();
    if (!token) { setError("管理者本人でログインし、多要素認証を完了してください。"); return; }
    const current = generation.current;
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`${endpoint}?offset=${offset}`, { headers: adminBearerHeaders(), cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (generation.current !== current || bearer() !== token) return;
      if (!response.ok || !Array.isArray(data.reports)) throw new Error(data.message ?? "通報一覧を確認できませんでした。");
      setPage(data as ReportPage);
    } catch (failure) {
      if (generation.current === current && bearer() === token && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "一覧を確認できませんでした。");
    } finally { if (generation.current === current) setLoading(false); }
  }

  useEffect(() => {
    const changed = () => { void loadPage(); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === ADMIN_BEARER_TOKEN_STORAGE_KEY || event.key === null) changed();
    };
    const hidden = () => { if (document.hidden) clearPrivateContent(); };
    changed();
    window.addEventListener("admin-auth-changed", changed);
    window.addEventListener("storage", storageChanged);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      generation.current += 1; listRequest.current?.abort(); detailRequest.current?.abort();
      window.removeEventListener("admin-auth-changed", changed);
      window.removeEventListener("storage", storageChanged);
      document.removeEventListener("visibilitychange", hidden);
    };
    // All requests bind to the current token and generation; no private content is stored in the browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openReport(id: string) {
    detailRequest.current?.abort();
    const current = ++generation.current;
    const token = bearer();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetail(null); setSelection(""); setMessage(""); setError(""); setLoading(true); setSaving(false);
    try {
      const response = await fetch(`${endpoint}/${id}`, { headers: adminBearerHeaders(), cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (generation.current !== current || bearer() !== token) return;
      if (!response.ok || data.id !== id) throw new Error(data.message ?? "通報を確認できませんでした。");
      setDetail(data as AiReportDetail); setSelection(selectionOf(data));
    } catch (failure) {
      if (generation.current === current && bearer() === token && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "通報を確認できませんでした。");
    } finally { if (generation.current === current) setLoading(false); }
  }

  async function saveReview() {
    if (!detail || saving) return;
    const choice = AI_REPORT_REVIEW_OPTIONS.find((option) => `${option.status}:${option.outcome}` === selection);
    if (!choice) return;
    const current = ++generation.current;
    const token = bearer();
    const reportId = detail.id;
    const controller = new AbortController();
    detailRequest.current = controller;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`${endpoint}/${reportId}`, {
        method: "PATCH", headers: { ...adminBearerHeaders(), "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ expectedRevision: detail.review.revision, status: choice.status, outcome: choice.outcome })
      });
      if (generation.current !== current || bearer() !== token) return;
      if ([401, 403, 404].includes(response.status)) {
        // The server has invalidated access/existence. Do not keep previously
        // disclosed content while waiting for an error body or a new auth event.
        clearPrivateContent();
        setError(response.status === 404
          ? "この通報を確認できないため、通報内容を非表示にしました。一覧を読み直してください。"
          : "権限を確認できないため、通報内容を非表示にしました。管理者認証と多要素認証を確認し、一覧を読み直してください。");
        return;
      }
      const data = await response.json();
      if (generation.current !== current || bearer() !== token) return;
      if (!response.ok || data.saved !== true || !data.review) throw new Error(data.message ?? "保存を確認できませんでした。同じ内容で再試行できます。");
      setDetail((value) => value?.id === reportId ? { ...value, review: data.review, reviews: [data.review, ...value.reviews.filter((review) => review.revision !== data.review.revision)].slice(0, 20) } : value);
      setPage((value) => value ? { ...value, reports: value.reports.map((report) => report.id === reportId ? { ...report, review: data.review } : report) } : value);
      setMessage("対応状況を保存しました。");
    } catch (failure) {
      if (generation.current === current && bearer() === token && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "保存を確認できませんでした。");
    } finally { if (generation.current === current) setSaving(false); }
  }

  return <section className="panel" style={{ marginTop: 18 }}>
    <div className="section-head"><h2>AI回答の通報</h2><button className="secondary" type="button" disabled={loading || saving} onClick={() => void loadPage(page?.offset ?? 0)}>一覧を読み直す</button></div>
    <p className="hint">一覧には相談本文を表示しません。「この1件を確認」で通報された相談と回答だけを開き、閲覧を記録します。本文を外部AI・メール・チャットへ転記しないでください。</p>
    {error ? <p className="admin-error" role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {loading ? <p role="status">確認しています…</p> : null}
    {page ? <>
      {!page.reports.length ? <p>このページに通報はありません。</p> : <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>受付日時</th><th>理由</th><th>対応状況</th><th>確認</th></tr></thead>
        <tbody>{page.reports.map((report) => <tr key={report.id}>
          <td>{when(report.createdAt)}</td><td>{AI_REPORT_REASON_LABELS[report.reason] ?? "その他"}</td><td>{aiReportReviewLabel(report.review)}</td>
          <td><button className="secondary" type="button" disabled={loading || saving} onClick={() => void openReport(report.id)}>この1件を確認</button></td>
        </tr>)}</tbody>
      </table></div>}
      <div className="actions"><button className="secondary" type="button" disabled={page.offset === 0 || loading || saving} onClick={() => void loadPage(Math.max(0, page.offset - AI_REPORT_PAGE_SIZE))}>前の20件</button>
        <button className="secondary" type="button" disabled={!page.hasMore || loading || saving} onClick={() => void loadPage(page.offset + AI_REPORT_PAGE_SIZE)}>次の20件</button></div>
    </> : null}
    {detail ? <article style={{ marginTop: 24 }}>
      <div className="section-head"><h2>選んだ通報</h2><button className="secondary" type="button" onClick={() => { generation.current += 1; detailRequest.current?.abort(); setDetail(null); setSaving(false); setMessage(""); }}>本文を閉じる</button></div>
      <p className="hint">受付番号 {detail.id} ／ {when(detail.createdAt)}</p>
      <p>報告理由：{AI_REPORT_REASON_LABELS[detail.reason] ?? "その他"}</p>
      {detail.content ? <>
        <h3>この1件の相談</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail.content.question}</p>
        <h3>この1件のAI回答</h3>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail.content.answer.situation}</p>
        <h4>次の確認</h4><ul>{detail.content.answer.nextChecks.map((item, index) => <li key={index}>{item.title}：{item.why}</li>)}</ul>
        <h4>聞いておくこと</h4><ul>{detail.content.answer.askQuestions.map((item, index) => <li key={index}>{item}</li>)}</ul>
        <h4>相談先の種類</h4><p>{detail.content.answer.providerCategories.join("、")}</p>
        <h4>注意点</h4><ul>{detail.content.answer.watchOuts.map((item, index) => <li key={index}>{item}</li>)}</ul>
        <h4>記録の提案</h4><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail.content.answer.recordSuggestion}</p>
      </> : <p role="status">本文の削除、閲覧権限の変更、または報告時の同意を確認できないため、本文は表示できません。本文の復元は行いません。</p>}
      <h3>対応状況</h3><p>現在：{aiReportReviewLabel(detail.review)}</p>
      <p className="hint">「修正と確認済み」は、別途必要な修正と検証が完了してから選んでください。この操作は回答の変更・削除・通知送信を行いません。</p>
      <label>記録する対応<select className="input" value={selection} disabled={saving} onChange={(event) => setSelection(event.target.value)}>
        <option value="">対応を選んでください</option>{AI_REPORT_REVIEW_OPTIONS.map((option) => <option key={option.outcome} value={`${option.status}:${option.outcome}`}>{option.label}</option>)}
      </select></label>
      <button className="primary" type="button" disabled={saving || !AI_REPORT_REVIEW_OPTIONS.some((option) => `${option.status}:${option.outcome}` === selection)} onClick={() => void saveReview()}>{saving ? "保存を確認しています…" : "対応状況を保存"}</button>
      <h3>直近の対応記録</h3>
      {detail.reviews.length ? <ul>{detail.reviews.map((review) => <li key={review.revision}>{when(review.updatedAt)}：{aiReportReviewLabel(review)} ／ 担当ID {review.operatorId ?? "アカウント削除済み"}</li>)}</ul> : <p>対応記録はまだありません。</p>}
    </article> : null}
  </section>;
}
