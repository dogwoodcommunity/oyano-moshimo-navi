import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cronAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET(request: Request) {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ purged: 0, skipped: true, reason: "Supabase is not configured" });
  }

  const retentionDays = Number(process.env.ANONYMOUS_CASE_RETENTION_DAYS ?? 30);
  const batchSize = Number(process.env.ANONYMOUS_CASE_PURGE_LIMIT ?? 100);

  const { data, error } = await supabase.rpc("purge_stale_anonymous_cases", {
    p_limit: Number.isFinite(batchSize) ? batchSize : 100,
    p_retention_days: Number.isFinite(retentionDays) ? retentionDays : 30
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purged: data ?? 0 });
}
