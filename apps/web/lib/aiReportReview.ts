import { createHash, randomUUID } from "node:crypto";
import { normalizeConsultAnswer } from "@oyano/shared";
import { AiReportOperatorError, type authorizeAiReportOperator } from "@/lib/aiReportOperator";
import { AI_REPORT_REVIEW_OPTIONS, type AiReportDetail, type AiReportReview, type AiReportReviewChoice, type AiReportSummary } from "@/lib/aiReportReviewTypes";

type Operator = Awaited<ReturnType<typeof authorizeAiReportOperator>>;
type Row = { id: string; actor_user_id: string | null; target_id: string | null; created_at: string | null; metadata: Record<string, unknown> | null };
const REPORT = "ai_consult_answer_report";
const REVIEW = "ai_consult_answer_report_review";
const VIEW = "ai_consult_answer_report_viewed";
const CONSENT = "ai-answer-report-v1-2026-09-20";
const COLUMNS = "id,actor_user_id,target_id,created_at,metadata";
export const AI_REPORT_PAGE_SIZE = 20;
export const isReportUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const unavailable = () => new AiReportOperatorError("report_review_unavailable", "通報の読込・保存を確認できませんでした。");
const conflict = () => new AiReportOperatorError("review_conflict", "別の対応が保存されています。通報を開き直して確認してください。", 409);
const emptyReview = (): AiReportReview => ({ revision: 0, status: "received", outcome: null, updatedAt: null, operatorId: null });

function parseReview(row: Row): AiReportReview {
  const metadata = row.metadata ?? {};
  const choice = AI_REPORT_REVIEW_OPTIONS.find((option) => option.status === metadata.status && option.outcome === metadata.outcome);
  if (!choice || !Number.isSafeInteger(metadata.revision) || Number(metadata.revision) < 1) throw unavailable();
  return { revision: Number(metadata.revision), status: choice.status, outcome: choice.outcome, updatedAt: row.created_at, operatorId: row.actor_user_id };
}

async function readReviews(operator: Operator, reportId: string, limit = 1) {
  const { data, error } = await operator.supabase.from("audit_logs").select(COLUMNS)
    .eq("action", REVIEW).eq("target_type", REPORT).eq("target_id", reportId)
    // -> keeps JSON numeric ordering, including revision 10 after revision 9.
    .order("metadata->revision", { ascending: false }).limit(limit);
  if (error || !Array.isArray(data)) throw unavailable();
  return (data as Row[]).map(parseReview);
}

async function readReport(operator: Operator, reportId: string): Promise<Row> {
  if (!isReportUuid(reportId)) throw new AiReportOperatorError("invalid_request", "通報の識別番号を確認してください。", 400);
  const { data, error } = await operator.supabase.from("audit_logs").select(COLUMNS)
    .eq("id", reportId).eq("action", REPORT).eq("target_type", "ai_consult_turn").maybeSingle();
  if (error) throw unavailable();
  if (!data) throw new AiReportOperatorError("report_not_found", "この通報は見つかりませんでした。", 404);
  return data as Row;
}

function summary(row: Row, review: AiReportReview): AiReportSummary {
  const reason = row.metadata?.reason;
  return { id: row.id, reason: typeof reason === "string" && ["unsafe", "incorrect", "inappropriate", "other"].includes(reason) ? reason : "other", createdAt: row.created_at, review };
}

export async function listAiReports(operator: Operator, offset: number) {
  const { data, error } = await operator.supabase.from("audit_logs").select(COLUMNS)
    .eq("action", REPORT).eq("target_type", "ai_consult_turn")
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + AI_REPORT_PAGE_SIZE);
  if (error || !Array.isArray(data)) throw unavailable();
  const reports = await Promise.all((data as Row[]).slice(0, AI_REPORT_PAGE_SIZE).map(async (row) =>
    summary(row, (await readReviews(operator, row.id))[0] ?? emptyReview())));
  // No reporter identity, turn ID, question, answer, person profile, or family record in this list.
  return { reports, offset, hasMore: data.length > AI_REPORT_PAGE_SIZE };
}

async function readReportedContent(operator: Operator, report: Row): Promise<AiReportDetail["content"]> {
  if (!report.actor_user_id || !report.target_id || report.metadata?.consent_version !== CONSENT) return null;
  const { data: turn, error: turnError } = await operator.supabase.from("ai_consult_turns")
    .select("id,thread_id").eq("id", report.target_id).maybeSingle();
  if (turnError) throw unavailable();
  if (!turn) return null;
  const { data: thread, error: threadError } = await operator.supabase.from("ai_consult_threads")
    .select("id,person_id").eq("id", turn.thread_id).eq("owner_user_id", report.actor_user_id).maybeSingle();
  if (threadError) throw unavailable();
  if (!thread) return null;
  const { data: person, error: personError } = await operator.supabase.from("people")
    .select("family_id").eq("id", thread.person_id).maybeSingle();
  if (personError) throw unavailable();
  if (!person) return null;
  const { data: member, error: memberError } = await operator.supabase.from("family_members")
    .select("family_id").eq("family_id", person.family_id).eq("user_id", report.actor_user_id).maybeSingle();
  if (memberError) throw unavailable();
  if (!member) return null;
  const { data: content, error: contentError } = await operator.supabase.from("ai_consult_turns")
    .select("question,answer").eq("id", report.target_id).eq("thread_id", thread.id).maybeSingle();
  if (contentError) throw unavailable();
  if (!content) return null;
  const answer = normalizeConsultAnswer(content.answer);
  if (!answer || typeof content.question !== "string") throw unavailable();
  return { question: content.question, answer };
}

export async function readAiReportDetail(operator: Operator, reportId: string): Promise<AiReportDetail> {
  const report = await readReport(operator, reportId);
  const content = await readReportedContent(operator, report);
  const reviews = await readReviews(operator, reportId, 20);
  const id = randomUUID();
  const { data, error } = await operator.supabase.from("audit_logs").insert({
    id, actor_user_id: operator.userId, action: VIEW, target_type: REPORT, target_id: reportId,
    metadata: { content_available: Boolean(content) }
  }).select("id").maybeSingle();
  // An unaudited content read is never returned to the browser.
  if (error || data?.id !== id) throw unavailable();
  return { ...summary(report, reviews[0] ?? emptyReview()), content, reviews };
}

export function parseAiReportReview(value: unknown): ({ expectedRevision: number } & Pick<AiReportReviewChoice, "status" | "outcome">) | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["expectedRevision", "status", "outcome"].includes(key))
    || !Number.isSafeInteger(row.expectedRevision) || Number(row.expectedRevision) < 0
    || Number(row.expectedRevision) >= Number.MAX_SAFE_INTEGER) return null;
  const choice = AI_REPORT_REVIEW_OPTIONS.find((option) => option.status === row.status && option.outcome === row.outcome);
  return choice ? { expectedRevision: Number(row.expectedRevision), status: choice.status, outcome: choice.outcome } : null;
}

export async function writeAiReportReview(operator: Operator, reportId: string, change: NonNullable<ReturnType<typeof parseAiReportReview>>) {
  await readReport(operator, reportId);
  const current = (await readReviews(operator, reportId))[0] ?? emptyReview();
  const sameSubmission = (state: AiReportReview) => state.revision === change.expectedRevision + 1
    && state.status === change.status && state.outcome === change.outcome && state.operatorId === operator.userId;
  if (current.revision !== change.expectedRevision) {
    if (sameSubmission(current)) return { saved: true, review: current };
    throw conflict();
  }
  const revision = current.revision + 1;
  const hex = createHash("sha256").update(`${REVIEW}\0${reportId.toLowerCase()}\0${revision}`).digest("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const { data, error } = await operator.supabase.from("audit_logs").insert({
    id, actor_user_id: operator.userId, action: REVIEW, target_type: REPORT, target_id: reportId,
    metadata: { revision, status: change.status, outcome: change.outcome }
  }).select(COLUMNS).maybeSingle();
  if (!error && data?.id === id) return { saved: true, review: parseReview(data as Row) };
  if (error?.code === "23505") {
    const latest = (await readReviews(operator, reportId))[0];
    if (latest && sameSubmission(latest)) return { saved: true, review: latest };
    throw conflict();
  }
  throw unavailable();
}
