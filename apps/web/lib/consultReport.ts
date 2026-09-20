import { createHash } from "node:crypto";
import type { getServerSupabase } from "@/lib/serverSupabase";

type ReportSupabase = NonNullable<ReturnType<typeof getServerSupabase>>;
export const CONSULT_REPORT_REASONS = ["unsafe", "inappropriate", "incorrect", "other"] as const;
export type ConsultReportReason = typeof CONSULT_REPORT_REASONS[number];
const REPORT_ACTION = "ai_consult_answer_report";
const REPORT_TARGET = "ai_consult_turn";
const CONSENT_VERSION = "ai-answer-report-v1-2026-09-20";

export class ConsultReportError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "ConsultReportError";
  }
}

export function parseConsultReport(value: unknown): { turnId: string; reason: ConsultReportReason } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  // Do not accept a client copy of the question, answer, identity, or family as evidence.
  if (Object.keys(payload).some((key) => key !== "turnId" && key !== "reason")) return null;
  if (typeof payload.turnId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.turnId)
    || !CONSULT_REPORT_REASONS.includes(payload.reason as ConsultReportReason)) return null;
  return { turnId: payload.turnId.toLowerCase(), reason: payload.reason as ConsultReportReason };
}

function unavailable(): never {
  throw new ConsultReportError("report_unavailable", "報告の受付を確認できませんでした。時間をおいて再度お試しください。", 503);
}

function inaccessible(): never {
  // Deliberately use one response for a missing turn, another owner's turn, or revoked access.
  throw new ConsultReportError("report_not_available", "この回答を報告する権限を確認できませんでした。相談履歴を開き直してください。", 404);
}

function reportId(userId: string, turnId: string) {
  const hex = createHash("sha256").update(`${REPORT_ACTION}:v1\0${userId}\0${turnId}`).digest("hex");
  // UUIDv8 derived on the server. The existing PK makes concurrent retries insert-once.
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function persistConsultReport(
  supabase: ReportSupabase,
  userId: string,
  payload: { turnId: string; reason: ConsultReportReason }
): Promise<{ received: true; alreadyReported: boolean }> {
  const { data: turn, error: turnError } = await supabase.from("ai_consult_turns")
    .select("id,thread_id").eq("id", payload.turnId).maybeSingle();
  if (turnError) unavailable();
  if (!turn?.thread_id) inaccessible();
  const { data: thread, error: threadError } = await supabase.from("ai_consult_threads")
    .select("id,person_id").eq("id", turn.thread_id).eq("owner_user_id", userId).maybeSingle();
  if (threadError) unavailable();
  if (!thread?.person_id) inaccessible();
  const { data: person, error: personError } = await supabase.from("people")
    .select("id,family_id").eq("id", thread.person_id).maybeSingle();
  if (personError) unavailable();
  if (!person?.family_id) inaccessible();
  const { data: member, error: memberError } = await supabase.from("family_members")
    .select("family_id").eq("family_id", person.family_id).eq("user_id", userId).maybeSingle();
  if (memberError) unavailable();
  if (!member) inaccessible();

  const id = reportId(userId, payload.turnId);
  const { data: inserted, error } = await supabase.from("audit_logs").insert({
    id,
    actor_user_id: userId,
    action: REPORT_ACTION,
    target_type: REPORT_TARGET,
    target_id: payload.turnId,
    // Keep actor only in the FK, which is nulled by account erasure. No personal-data copy.
    metadata: { reason: payload.reason, consent_version: CONSENT_VERSION }
  }).select("id").maybeSingle();
  if (!error && inserted?.id === id) return { received: true, alreadyReported: false };
  if (error?.code !== "23505") unavailable();

  // A constraint error alone is not an acknowledgement: verify the same stored report.
  const { data: existing, error: readError } = await supabase.from("audit_logs")
    .select("id").eq("id", id).eq("actor_user_id", userId).eq("action", REPORT_ACTION)
    .eq("target_type", REPORT_TARGET).eq("target_id", payload.turnId).maybeSingle();
  if (readError || existing?.id !== id) unavailable();
  return { received: true, alreadyReported: true };
}
