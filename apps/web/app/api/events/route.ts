import { NextResponse } from "next/server";
import { FUNNEL_EVENTS, type FunnelEvent } from "@oyano/shared";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

const allowed = new Set<string>(FUNNEL_EVENTS);

/**
 * 匿名の行動記録だけを受ける。個人情報は受け取らないし、保存もしない。
 * 何も返さないのは、計測の失敗が利用者の操作を止めてはいけないため。
 */
export async function POST(request: Request) {
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "events",
    limit: 120,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: true, stored: false });

  let payload: { anonId?: string; event?: string; platform?: string };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    return NextResponse.json({ ok: true, stored: false });
  }

  const anonId = typeof payload.anonId === "string" ? payload.anonId.trim().slice(0, 64) : "";
  const event = typeof payload.event === "string" ? payload.event : "";
  const platform = payload.platform === "app" ? "app" : "web";

  if (anonId.length < 8 || !allowed.has(event)) {
    return NextResponse.json({ ok: true, stored: false });
  }

  const { error } = await supabase
    .from("funnel_events")
    .insert({ anon_id: anonId, event: event as FunnelEvent, platform });

  return NextResponse.json({ ok: true, stored: !error });
}
