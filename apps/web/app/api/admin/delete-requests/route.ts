import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminDeleteRequestRow = {
  id: string;
  userId?: string;
  contactEmail?: string;
  reason?: string;
  status: "requested" | "reviewing" | "completed" | "needs_followup";
  dueAt: string;
  isOverdue: boolean;
  daysRemaining: number;
  handledAt?: string;
  handledNote?: string;
  handledBy?: string;
  createdAt: string;
};

type AccountDeleteRequestRow = {
  id: string;
  user_id: string | null;
  contact_email: string | null;
  reason: string | null;
  status: AdminDeleteRequestRow["status"];
  due_at: string;
  handled_at: string | null;
  handled_note: string | null;
  handled_by_email: string | null;
  handled_by: string | null;
  handled_by_method: string | null;
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
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ deleteRequests: [], source: "not_configured" });
  }

  const { data, error } = await supabase
    .from("account_delete_requests")
    .select("id, user_id, contact_email, reason, status, due_at, handled_at, handled_note, handled_by_email, handled_by, handled_by_method, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const deleteRequests: AdminDeleteRequestRow[] = ((data ?? []) as AccountDeleteRequestRow[]).map((item) => {
    const dueTime = new Date(item.due_at).getTime();
    const daysRemaining = Math.ceil((dueTime - now) / (1000 * 60 * 60 * 24));

    return {
      id: item.id,
      userId: item.user_id ?? undefined,
      contactEmail: item.contact_email ?? undefined,
      reason: item.reason ?? undefined,
      status: item.status,
      dueAt: item.due_at,
      isOverdue: item.status !== "completed" && dueTime < now,
      daysRemaining,
      handledAt: item.handled_at ?? undefined,
      handledNote: item.handled_note ?? undefined,
      handledBy: item.handled_by_email ?? item.handled_by_method ?? item.handled_by ?? undefined,
      createdAt: item.created_at
    };
  });

  return NextResponse.json({ deleteRequests, source: "supabase" });
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ updated: false, source: "not_configured" });
  }

  const body = await request.json().catch(() => ({})) as PatchBody;
  if (!body.id || !body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "id and valid status are required" }, { status: 400 });
  }

  const { data: existing, error: readError } = await supabase
    .from("account_delete_requests")
    .select("id, status")
    .eq("id", body.id)
    .single();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const handledAt = body.status === "completed" ? now : null;

  const { error } = await supabase
    .from("account_delete_requests")
    .update({
      status: body.status,
      last_status_changed_at: now,
      handled_at: handledAt,
      handled_note: body.note?.trim() || null,
      handled_by: auth.admin.userId ?? null,
      handled_by_email: auth.admin.email ?? null,
      handled_by_method: auth.admin.method
    })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: auth.admin.userId ?? null,
    action: "account_delete_status_updated",
    target_type: "account_delete_request",
    target_id: body.id,
    metadata: {
      previous_status: existing.status,
      status: body.status,
      handled_note: body.note?.trim() || null,
      handled_by_user_id: auth.admin.userId ?? null,
      handled_by_email: auth.admin.email ?? null,
      handled_by_method: auth.admin.method
    }
  });

  return NextResponse.json({ updated: true });
}
