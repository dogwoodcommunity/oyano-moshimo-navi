import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type DeleteRequestBody = {
  reason?: string;
  contact_email?: string;
};

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

export async function POST(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ skipped: true, reason: "Supabase is not configured" });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authorization bearer token is required" }, { status: 401 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  const user = userResult.user;

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid authorization token" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as DeleteRequestBody;
  const contactEmail = body.contact_email?.trim() || user.email || null;
  const reason = body.reason?.trim() || null;

  const now = new Date().toISOString();
  const { data: existingRequest, error: existingError } = await supabase
    .from("account_delete_requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["requested", "reviewing", "needs_followup"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const requestPayload = {
    user_id: user.id,
    contact_email: contactEmail,
    reason,
    requested_from: "mobile_app",
    last_status_changed_at: now
  };

  const { data: deleteRequest, error: requestError } = existingRequest?.id
    ? await supabase
      .from("account_delete_requests")
      .update(requestPayload)
      .eq("id", existingRequest.id)
      .select("id")
      .single()
    : await supabase
      .from("account_delete_requests")
      .insert(requestPayload)
      .select("id")
      .single();

  if (requestError) {
    return NextResponse.json({ error: requestError.message }, { status: 500 });
  }

  const { data: auditLog, error: auditError } = await supabase.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "account_delete_requested",
    target_type: "account_delete_request",
    target_id: deleteRequest.id,
    metadata: {
      contact_email: contactEmail,
      reason,
      requested_from: "mobile_app",
      request_id: deleteRequest.id,
      duplicate_request_updated: Boolean(existingRequest?.id)
    }
  }).select("id").single();

  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  await supabase
    .from("account_delete_requests")
    .update({ audit_log_id: auditLog.id })
    .eq("id", deleteRequest.id);

  return NextResponse.json({ received: true, requestId: deleteRequest.id });
}
