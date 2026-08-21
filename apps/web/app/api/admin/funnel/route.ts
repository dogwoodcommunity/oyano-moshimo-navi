import { NextResponse } from "next/server";
import type { FunnelSummary } from "@oyano/shared";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "not_configured", message: "Supabaseが設定されていません。" }, { status: 503 });
  }

  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const { data, error } = await supabase.rpc("funnel_summary", {
    p_days: Number.isFinite(days) ? Math.min(Math.max(days, 1), 365) : 30
  });

  if (error) {
    return NextResponse.json(
      { error: "funnel_failed", message: "集計できませんでした。supabase/funnel_events.sql を適用してください。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ summary: data as FunnelSummary });
}
