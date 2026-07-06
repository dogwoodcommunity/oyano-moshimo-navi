import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type OpenedBody = {
  scheduled_notification_id?: string;
  scheduled_notification_ids?: string[];
};

function uniq(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

export async function POST(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ updated: 0, skipped: true, reason: "Supabase is not configured" });
  }

  const body = await request.json().catch(() => ({})) as OpenedBody;
  const ids = uniq([
    ...(body.scheduled_notification_ids ?? []),
    body.scheduled_notification_id ?? ""
  ]);

  if (ids.length === 0) {
    return NextResponse.json({ error: "scheduled notification id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("scheduled_notifications")
    .update({ opened_at: new Date().toISOString() })
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: ids.length });
}
