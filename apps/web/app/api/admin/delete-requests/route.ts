import { NextResponse } from "next/server";
import { verifyAccountDeleteOperatorRequest } from "@/lib/adminAuth";
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
  "reviewing",
  "needs_followup"
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

function statusUpdateError(result: string) {
  if (result === "operator_forbidden") {
    return NextResponse.json(
      { error: result, message: "削除担当者の権限を確認できませんでした。" },
      { status: 403 }
    );
  }
  if (result === "request_not_found") {
    return NextResponse.json(
      { error: result, message: "削除依頼を確認できませんでした。" },
      { status: 404 }
    );
  }
  if (result === "verified_account_erasure_required" || result === "account_erasure_in_progress") {
    return NextResponse.json(
      { error: result, message: "完全削除の処理中または完了済みのため、状態だけを変更できません。" },
      { status: 409 }
    );
  }
  if (result === "note_too_long") {
    return NextResponse.json(
      { error: result, message: "処理メモは2000文字以内で入力してください。" },
      { status: 422 }
    );
  }
  if (result === "invalid_request" || result === "invalid_status") {
    return NextResponse.json(
      { error: result, message: "削除依頼IDと状態を正しく指定してください。" },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { error: "account_delete_status_update_failed", message: "削除依頼の状態を更新できませんでした。" },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  const auth = await verifyAccountDeleteOperatorRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { deleteRequests: [], source: "not_configured" },
      { headers: noStoreHeaders }
    );
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

  return NextResponse.json(
    { deleteRequests, source: "supabase" },
    { headers: noStoreHeaders }
  );
}

export async function PATCH(request: Request) {
  const auth = await verifyAccountDeleteOperatorRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ updated: false, source: "not_configured" });
  }

  const body = await request.json().catch(() => ({})) as PatchBody;
  if (!body.id || !uuidPattern.test(body.id) || !body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "id and valid status are required" }, { status: 400 });
  }

  const note = body.note?.trim() || null;
  if (note && note.length > 2000) {
    return NextResponse.json(
      { error: "note_too_long", message: "処理メモは2000文字以内で入力してください。" },
      { status: 422 }
    );
  }
  const { data, error } = await supabase.rpc("update_account_delete_request_status_v1", {
    p_request_id: body.id,
    p_status: body.status,
    p_note: note,
    p_operator_user_id: auth.admin.userId
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const resultCode = typeof result.result === "string" ? result.result : "invalid_rpc_response";
  if (resultCode !== "updated") return statusUpdateError(resultCode);

  return NextResponse.json({ updated: true, result });
}
