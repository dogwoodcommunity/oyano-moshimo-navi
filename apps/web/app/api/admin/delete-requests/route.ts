import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminDeleteRequestRow = {
  id: string;
  userId?: string;
  contactEmail?: string;
  reason?: string;
  status: "requested" | "reviewing" | "completed" | "needs_followup";
  handledAt?: string;
  handledNote?: string;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  metadata: {
    contact_email?: string | null;
    reason?: string | null;
    status?: AdminDeleteRequestRow["status"] | null;
    handled_at?: string | null;
    handled_note?: string | null;
  } | null;
  created_at: string;
};

type PatchBody = {
  id?: string;
  status?: AdminDeleteRequestRow["status"];
  note?: string;
};

const allowedStatuses = new Set<AdminDeleteRequestRow["status"]>([
  "requested",
  "reviewing",
  "completed",
  "needs_followup"
]);

export async function GET(request: Request) {
  const unauthorized = verifyAdminRequest(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ deleteRequests: [], source: "not_configured" });
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_user_id, metadata, created_at")
    .eq("action", "account_delete_requested")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleteRequests: AdminDeleteRequestRow[] = ((data ?? []) as AuditLogRow[]).map((item) => ({
    id: item.id,
    userId: item.actor_user_id ?? undefined,
    contactEmail: item.metadata?.contact_email ?? undefined,
    reason: item.metadata?.reason ?? undefined,
    status: item.metadata?.status ?? "requested",
    handledAt: item.metadata?.handled_at ?? undefined,
    handledNote: item.metadata?.handled_note ?? undefined,
    createdAt: item.created_at
  }));

  return NextResponse.json({ deleteRequests, source: "supabase" });
}

export async function PATCH(request: Request) {
  const unauthorized = verifyAdminRequest(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ updated: false, source: "not_configured" });
  }

  const body = await request.json().catch(() => ({})) as PatchBody;
  if (!body.id || !body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "id and valid status are required" }, { status: 400 });
  }

  const { data: existing, error: readError } = await supabase
    .from("audit_logs")
    .select("metadata")
    .eq("id", body.id)
    .eq("action", "account_delete_requested")
    .single();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const currentMetadata = (existing?.metadata ?? {}) as Record<string, unknown>;
  const nextMetadata = {
    ...currentMetadata,
    status: body.status,
    handled_at: new Date().toISOString(),
    handled_note: body.note?.trim() || null
  };

  const { error } = await supabase
    .from("audit_logs")
    .update({ metadata: nextMetadata })
    .eq("id", body.id)
    .eq("action", "account_delete_requested");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}
