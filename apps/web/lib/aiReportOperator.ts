import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export class AiReportOperatorError extends Error {
  constructor(readonly code: string, message: string, readonly status = 503) { super(message); }
}
export const operatorJson = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
});
export function operatorErrorResponse(error: unknown) {
  return error instanceof AiReportOperatorError
    ? operatorJson({ error: error.code, message: error.message }, error.status)
    : operatorJson({ error: "report_review_unavailable", message: "通報を確認できませんでした。時間をおいて再度お試しください。" }, 503);
}

/** Existing app_admins allowlist only; no static token or deletion-only executor. */
export async function authorizeAiReportOperator(request: Request, requireMfa = true) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) throw new AiReportOperatorError("login_required", "管理者本人のログインが必要です。", 401);
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) throw new AiReportOperatorError("operator_required", "管理者の権限を確認できませんでした。", auth.response.status);
  if (auth.admin.method !== "supabase_app_admin" || !auth.admin.userId) {
    throw new AiReportOperatorError("operator_required", "登録された管理者本人の認証が必要です。", 403);
  }
  // getUser within verifyAdminRequest has already verified this Bearer's signature and expiry.
  let aal: unknown;
  try { aal = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).aal; } catch { /* Fail closed. */ }
  if (aal !== "aal1" && aal !== "aal2") throw new AiReportOperatorError("login_required", "本人確認をやり直してください。", 401);
  if (requireMfa && aal !== "aal2") throw new AiReportOperatorError("mfa_required", "通報の確認・対応には多要素認証が必要です。", 403);
  const supabase = getServerSupabase();
  if (!supabase) throw new AiReportOperatorError("report_review_unavailable", "管理画面の接続先を確認できませんでした。");
  return { supabase, userId: auth.admin.userId, email: auth.admin.email, aal };
}
