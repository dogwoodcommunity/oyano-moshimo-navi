import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  const body = await request.json() as { caseId?: string };

  if (!body.caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ persisted: false, supportPackStatus: "requested" });
  }

  const { error } = await supabase.from("support_packs").insert({
    case_id: body.caseId,
    status: "requested",
    requested_scope: { source: "web_result", stripe_checkout_pending: true }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ persisted: true, supportPackStatus: "requested" });
}
