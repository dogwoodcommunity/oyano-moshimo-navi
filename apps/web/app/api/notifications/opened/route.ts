import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type OpenedBody = {
  scheduled_notification_id?: string;
  scheduled_notification_ids?: string[];
};

function uniq(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

export async function POST(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ updated: 0, skipped: true, reason: "Supabase is not configured" });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authorization bearer token is required" }, { status: 401 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  const userId = userResult.user?.id;

  if (userError || !userId) {
    return NextResponse.json({ error: "Invalid authorization token" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as OpenedBody;
  const ids = uniq([
    ...(body.scheduled_notification_ids ?? []),
    body.scheduled_notification_id ?? ""
  ]);

  if (ids.length === 0) {
    return NextResponse.json({ error: "scheduled notification id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scheduled_notifications")
    .update({ opened_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", userId)
    .is("opened_at", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requested: ids.length, updated: data?.length ?? 0 });
}
