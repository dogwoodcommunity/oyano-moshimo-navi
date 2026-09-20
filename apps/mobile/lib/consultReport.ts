import { getSupabase } from "./supabase";

export const AI_REPORT_REASONS = [
  { value: "unsafe", label: "危険な行動を勧めている" },
  { value: "inappropriate", label: "不快・差別的な内容がある" },
  { value: "incorrect", label: "誤った情報がある" },
  { value: "other", label: "その他の問題がある" }
] as const;
export type AiReportReason = typeof AI_REPORT_REASONS[number]["value"];
type ReportResult = { ok: true; alreadyReported: boolean } | { ok: false; message: string };
const UNCONFIRMED = "報告の受付を確認できませんでした。もう一度お試しください。同じ回答を再送しても重複しません。";

export async function reportAiAnswer(turnId: string, reason: AiReportReason): Promise<ReportResult> {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return { ok: false, message: "報告の接続先が設定されていません。" };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(turnId)
    || !AI_REPORT_REASONS.some((item) => item.value === reason)) {
    return { ok: false, message: "保存済みの相談履歴から報告してください。" };
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, message: "報告するにはログインしてください。" };
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) return { ok: false, message: "ログインを確認できませんでした。ログインし直してください。" };
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(`${baseUrl}/api/consult/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ turnId, reason }),
      signal: controller.signal
    });
    const result = await response.json().catch(() => null) as {
      received?: unknown; alreadyReported?: unknown; message?: unknown;
    } | null;
    if (response.ok && result?.received === true && typeof result.alreadyReported === "boolean") {
      return { ok: true, alreadyReported: result.alreadyReported };
    }
    return { ok: false, message: !response.ok && typeof result?.message === "string" ? result.message : UNCONFIRMED };
  } catch {
    return { ok: false, message: UNCONFIRMED };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
