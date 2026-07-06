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

  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "account_delete_requested",
    target_type: "profile",
    target_id: user.id,
    metadata: {
      contact_email: contactEmail,
      reason,
      requested_from: "mobile_app"
    }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
