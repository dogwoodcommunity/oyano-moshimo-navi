import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

async function getAuthenticatedUser(request: Request) {
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) return { error: "Authorization bearer token is required" as const, status: 401 as const };

  const supabase = getServerSupabase();
  if (!supabase) return { error: "Supabase is not configured" as const, status: 501 as const };

  const { data: userResult, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userResult.user) return { error: "Invalid bearer token" as const, status: 401 as const };

  await supabase.from("profiles").upsert({
    id: userResult.user.id,
    email: userResult.user.email ?? null,
    display_name: userResult.user.email ?? null,
    updated_at: new Date().toISOString()
  });

  return { supabase, user: userResult.user };
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.supabase
    .from("notification_preferences")
    .select("reminders_enabled, daily_digest_enabled, urgent_enabled")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    remindersEnabled: data?.reminders_enabled ?? true,
    dailyDigestEnabled: data?.daily_digest_enabled ?? true,
    urgentEnabled: data?.urgent_enabled ?? true
  });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json() as {
    remindersEnabled?: boolean;
    dailyDigestEnabled?: boolean;
    urgentEnabled?: boolean;
  };

  const values = {
    reminders_enabled: body.remindersEnabled ?? true,
    daily_digest_enabled: body.dailyDigestEnabled ?? true,
    urgent_enabled: body.urgentEnabled ?? true,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: readError } = await auth.supabase
    .from("notification_preferences")
    .select("id")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const query = existing?.id
    ? auth.supabase.from("notification_preferences").update(values).eq("id", existing.id)
    : auth.supabase.from("notification_preferences").insert({ user_id: auth.user.id, ...values });

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
