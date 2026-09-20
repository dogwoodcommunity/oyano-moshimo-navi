import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";
import { ConsultReportError, parseConsultReport, persistConsultReport } from "@/lib/consultReport";

export const dynamic = "force-dynamic";

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return json({ error: "login_required", message: "報告するにはログインしてください。" }, 401);
  try {
    const supabase = getServerSupabase();
    if (!supabase) return json({ error: "report_unavailable", message: "いまは報告を受け付けられません。" }, 503);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return json({ error: "login_required", message: "ログインを確認できませんでした。" }, 401);
    const payload = parseConsultReport(await request.json().catch(() => null));
    if (!payload) return json({ error: "invalid_request", message: "報告する回答と理由を選び直してください。" }, 400);
    return json(await persistConsultReport(supabase, data.user.id, payload), 200);
  } catch (error) {
    if (error instanceof ConsultReportError) return json({ error: error.code, message: error.message }, error.status);
    // Never include tokens, consultation content, or database error details in the response/log.
    return json({ error: "report_unavailable", message: "報告の受付を確認できませんでした。時間をおいて再度お試しください。" }, 503);
  }
}
