import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

const reply = (body: object, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" }
});

/** Deactivate one authenticated owner's token, or check for legacy registrations. */
export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply({ error: "unauthorized" }, 401);
  try {
    const raw = await request.text();
    if (raw.length > 1024) return reply({ error: "invalid_request" }, 400);
    let body: { mode?: unknown; expoPushToken?: unknown };
    try { body = JSON.parse(raw); } catch { return reply({ error: "invalid_request" }, 400); }
    if (!body || (body.mode !== "check" && body.mode !== "revoke")
      || (body.mode === "check" && body.expoPushToken !== undefined)
      || (body.mode === "revoke" && (typeof body.expoPushToken !== "string"
        || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,256}\]$/.test(body.expoPushToken)))) {
      return reply({ error: "invalid_request" }, 400);
    }
    const supabase = getServerSupabase();
    if (!supabase) return reply({ error: "unavailable" }, 503);
    const { data, error: authError } = await supabase.auth.getUser(bearer);
    if (authError || !data.user) return reply({ error: "unauthorized" }, 401);
    const userId = data.user.id;
    if (body.mode === "revoke") {
      const { error } = await supabase.from("push_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId).eq("expo_push_token", body.expoPushToken as string);
      if (error) return reply({ error: "unavailable" }, 503);
    }
    let query = supabase.from("push_tokens").select("id").eq("is_active", true);
    // An older login can have registered this physical token under another
    // owner. Do not modify that owner's row, but do not claim delivery stopped.
    query = body.mode === "revoke"
      ? query.eq("expo_push_token", body.expoPushToken as string)
      : query.eq("user_id", userId);
    const { data: active, error } = await query.limit(1);
    if (error || !Array.isArray(active)) return reply({ error: "unavailable" }, 503);
    if (active.length) return reply({ error: body.mode === "check" ? "legacy_registration_unknown" : "revoke_unverified" }, 409);
    return reply({ ok: true });
  } catch {
    // Provider messages can contain token values; never return or log them.
    return reply({ error: "unavailable" }, 503);
  }
}
