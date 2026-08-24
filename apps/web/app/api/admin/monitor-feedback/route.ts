import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ message: "Supabaseが設定されていません。" }, { status: 503 });

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, metadata, created_at")
    .eq("action", "monitor_feedback_submitted")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ message: error.message }, { status: 503 });
  return NextResponse.json({ responses: data ?? [] });
}
