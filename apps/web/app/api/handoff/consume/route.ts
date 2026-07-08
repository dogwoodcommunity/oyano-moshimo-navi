import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDOFF_TOKEN_PATTERN = /^handoff_(?:[a-f0-9]{48}|[a-f0-9]{12}_[a-f0-9]{48})$/i;

export async function POST(request: Request) {
  const body = await request.json() as {
    caseId?: string;
    token?: string;
    displayName?: string;
  };

  if (!body.caseId || !body.token) {
    return NextResponse.json({ error: "caseId and token are required" }, { status: 400 });
  }

  if (!UUID_PATTERN.test(body.caseId) || !HANDOFF_TOKEN_PATTERN.test(body.token)) {
    return NextResponse.json({ error: "Invalid handoff token" }, { status: 404 });
  }

  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) {
    return NextResponse.json({ error: "Authorization bearer token is required" }, { status: 401 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 501 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userResult.user) {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("consume_case_handoff", {
    p_case_id: body.caseId,
    p_display_name: body.displayName || null,
    p_token: body.token,
    p_user_email: userResult.user.email ?? null,
    p_user_id: userResult.user.id
  });

  if (error) {
    const message = error.message ?? "Failed to consume handoff token";
    const status = /invalid_or_consumed_handoff_token|case_not_found/.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(data);
}
