import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  const body = await request.json() as {
    expoPushToken?: string;
    platform?: string;
    deviceName?: string;
  };

  if (!body.expoPushToken) {
    return NextResponse.json({ error: "expoPushToken is required" }, { status: 400 });
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

  await supabase.from("profiles").upsert({
    id: userResult.user.id,
    email: userResult.user.email ?? null,
    display_name: userResult.user.email ?? null,
    updated_at: new Date().toISOString()
  });

  const { error } = await supabase.from("push_tokens").upsert({
    user_id: userResult.user.id,
    expo_push_token: body.expoPushToken,
    platform: body.platform ?? null,
    device_name: body.deviceName ?? null,
    is_active: true,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,expo_push_token" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
