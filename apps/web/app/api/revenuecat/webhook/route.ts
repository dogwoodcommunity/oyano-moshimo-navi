import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

/**
 * App内課金（iOS / Android）の受け口。
 *
 * Stripeと同じく、最終的に決めるのは families.plan の1か所だけにする。
 * どの決済経路から来ても、家族単位でPlusかどうかが決まる状態を保つ。
 *
 * RevenueCat側の設定:
 *   - Webhook URL: https://<web-domain>/api/revenuecat/webhook
 *   - Authorization header: REVENUECAT_WEBHOOK_SECRET と同じ値
 *   - app_user_id には、Supabaseのユーザーidを設定すること（アプリ側でログイン後にlogIn()する）
 */
type RevenueCatEvent = {
  event?: {
    type?: string;
    app_user_id?: string;
    original_app_user_id?: string;
    product_id?: string;
    expiration_at_ms?: number | null;
    store?: string;
  };
};

/** 解約直後はまだ期限まで使える。期限切れだけが失効。 */
function isActive(type: string, expirationMs: number | null): boolean {
  if (type === "EXPIRATION" || type === "SUBSCRIPTION_PAUSED") return false;
  if (expirationMs === null) return type !== "CANCELLATION";
  return expirationMs > Date.now();
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization.replace(/^Bearer\s+/i, ""), secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let payload: RevenueCatEvent;
  try {
    payload = await request.json() as RevenueCatEvent;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const event = payload.event ?? {};
  const type = event.type ?? "";
  const appUserId = (event.app_user_id ?? event.original_app_user_id ?? "").trim();

  if (!type || !appUserId) {
    return NextResponse.json({ received: true, applied: false });
  }

  // app_user_id は原則Supabaseのユーザーid。家族idが直接来た場合もそのまま使えるようにする。
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", appUserId)
    .limit(1)
    .maybeSingle();

  let familyId = membership?.family_id as string | undefined;

  if (!familyId) {
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("id", appUserId)
      .maybeSingle();
    familyId = family?.id as string | undefined;
  }

  if (!familyId) {
    // 課金は成立しているのに家族が見つからない状態。取りこぼしを後から追えるようにログへ残す。
    console.warn(`[revenuecat] family not found for app_user_id=${appUserId} type=${type}`);
    return NextResponse.json({ received: true, applied: false });
  }

  const expirationMs = typeof event.expiration_at_ms === "number" ? event.expiration_at_ms : null;
  const active = isActive(type, expirationMs);
  const periodEnd = expirationMs ? new Date(expirationMs).toISOString() : null;
  const subscriptionId = `revenuecat:${appUserId}`;

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("provider", "revenuecat")
    .eq("provider_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  const record = {
    family_id: familyId,
    provider: "revenuecat",
    provider_subscription_id: subscriptionId,
    status: active ? "active" : "canceled",
    current_period_end: periodEnd,
    updated_at: new Date().toISOString()
  };

  const written = existing?.id
    ? await supabase.from("subscriptions").update(record).eq("id", existing.id)
    : await supabase.from("subscriptions").insert(record);

  // 記録に失敗しても権利の反映は続ける。ただし黙って落とさない。
  if (written.error) {
    console.warn(`[revenuecat] subscription write failed family=${familyId}: ${written.error.message}`);
  }

  await supabase
    .from("families")
    .update({ plan: active ? "plus" : "free", updated_at: new Date().toISOString() })
    .eq("id", familyId);

  return NextResponse.json({ received: true, applied: true, plan: active ? "plus" : "free" });
}
