import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

const rejected = (error: string, status: number) => NextResponse.json({
  error, registrationState: "not_written"
}, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  let body: {
    expoPushToken?: string;
    platform?: string;
    deviceName?: string;
  };
  try {
    const raw = await request.text();
    if (raw.length > 1024) return rejected("invalid_request", 400);
    body = JSON.parse(raw);
  } catch { return rejected("invalid_request", 400); }
  if (!body || typeof body.expoPushToken !== "string"
    || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,256}\]$/.test(body.expoPushToken)
    || (body.platform !== undefined && !["ios", "android"].includes(body.platform))
    || (body.deviceName !== undefined && (typeof body.deviceName !== "string" || body.deviceName.length > 100))) {
    return rejected("invalid_request", 400);
  }

  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) {
    return rejected("unauthorized", 401);
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return rejected("unavailable", 501);
  }

  let registrationAttempted = false;
  try {
    const { data: userResult, error: userError } = await supabase.auth.getUser(bearerToken);
    if (userError || !userResult.user) return rejected("unauthorized", 401);
    const { data: otherOwners, error: ownershipError } = await supabase.from("push_tokens").select("id")
      .eq("expo_push_token", body.expoPushToken).eq("is_active", true).neq("user_id", userResult.user.id).limit(1);
    if (ownershipError || !Array.isArray(otherOwners)) return rejected("unavailable", 503);
    if (otherOwners.length) return rejected("token_unavailable", 409);
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userResult.user.id,
      email: userResult.user.email ?? null,
      display_name: userResult.user.email ?? null,
      updated_at: new Date().toISOString()
    });
    if (profileError) return rejected("unavailable", 503);
    registrationAttempted = true;
    const { error } = await supabase.from("push_tokens").upsert({
      user_id: userResult.user.id,
      expo_push_token: body.expoPushToken,
      platform: body.platform ?? null,
      device_name: body.deviceName ?? null,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,expo_push_token" });

    if (error) return NextResponse.json({ error: "registration_unverified" }, { status: 503 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return registrationAttempted
      ? NextResponse.json({ error: "registration_unverified" }, { status: 503 })
      : rejected("unavailable", 503);
  }
}
