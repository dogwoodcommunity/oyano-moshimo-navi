import { NextResponse } from "next/server";
import type { ParentStatus } from "@oyano/shared";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  const rateLimited = await checkPublicRateLimit(request, {
    keyPrefix: "cases:create",
    limit: 20,
    windowSeconds: 60
  });
  if (rateLimited) return rateLimited;

  const body = await request.json() as { selectedStatus?: ParentStatus };
  const selectedStatus = body.selectedStatus;

  if (!selectedStatus) {
    return NextResponse.json({ error: "selectedStatus is required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const record = {
    id,
    selectedStatus,
    answers: { selectedStatus },
    status: "draft" as const,
    createdAt: new Date().toISOString(),
    supportPackStatus: "none" as const
  };

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ record, persisted: false });
  }

  const { error } = await supabase.from("cases").insert({
    id,
    selected_status: selectedStatus,
    answers: record.answers,
    status: "draft",
    anonymous_token: `anon_${id}`
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record, persisted: true });
}
