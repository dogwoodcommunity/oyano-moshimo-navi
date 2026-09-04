import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminDeleteRequestRow = {
  id: string;
  userId?: string;
  erasureStatus?: "prepared" | "blocked" | "database_erased" | "completed";
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

type AccountErasureJobRow = {
  request_id: string;
  target_user_id: string | null;
  status: NonNullable<AdminDeleteRequestRow["erasureStatus"]>;
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

  const requestRows = (data ?? []) as AccountDeleteRequestRow[];
  const requestIds = requestRows.map((item) => item.id);
  const erasureJobs = new Map<string, AccountErasureJobRow>();
  if (requestIds.length > 0) {
    const { data: jobData, error: jobError } = await supabase
      .from("account_erasure_jobs")
      .select("request_id, target_user_id, status")
      .in("request_id", requestIds);

    // Keep the legacy request list usable before the additive migration is
    // installed. Any other failure is fail-closed: losing an in-progress
    // target UUID from this response could make a partial erasure impossible
    // to resume after the profile FK has nulled request.user_id.
    const migrationMissing = jobError
      && (jobError.code === "42P01" || jobError.code === "PGRST205");
    if (jobError && !migrationMissing) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }
    for (const job of (jobData ?? []) as AccountErasureJobRow[]) {
      erasureJobs.set(job.request_id, job);
    }
  }

  const now = Date.now();
  const deleteRequests: AdminDeleteRequestRow[] = requestRows.map((item) => {
    const dueTime = new Date(item.due_at).getTime();
    const daysRemaining = Math.ceil((dueTime - now) / (1000 * 60 * 60 * 24));
    const erasureJob = erasureJobs.get(item.id);

    return {
      id: item.id,
      // During a retryable partial erasure the profile cascade has already
      // nulled request.user_id. The service-only job deliberately retains the
      // target UUID until Auth and Storage have both been verified absent.
      userId: item.user_id ?? erasureJob?.target_user_id ?? undefined,
      erasureStatus: erasureJob?.status,
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

  // A free-text note is not proof that Auth, database rows, and Storage
  // objects were actually removed. Completion is reserved for the verified
  // erasure pipeline so this status-only endpoint cannot create a false
  // deletion receipt.
  if (body.status === "completed") {
    return NextResponse.json(
      {
        error: "verified_account_erasure_required",
        message: "実データ・認証・写真の削除確認が完了するまで、削除依頼を完了にはできません。"
      },
      { status: 409 }
    );
  }

  const note = body.note?.trim() || null;

  const { data: existing, error: readError } = await supabase
    .from("account_delete_requests")
    .select("id, status")
    .eq("id", body.id)
    .single();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const handledAt = null;

  const { error } = await supabase
    .from("account_delete_requests")
    .update({
      status: body.status,
      last_status_changed_at: now,
      handled_at: handledAt,
      handled_note: note,
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
      handled_note: note,
      handled_by_user_id: auth.admin.userId ?? null,
      handled_by_email: auth.admin.email ?? null,
      handled_by_method: auth.admin.method
    }
  });

  return NextResponse.json({ updated: true });
}
