import { NextResponse } from "next/server";
import { verifyAccountDeleteOperatorRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminDeleteRequestRow = {
  id: string;
  userId?: string;
  erasureStatus?: "prepared" | "blocked" | "database_erased" | "completed";
  erasureJob?: {
    id: string;
    status: "prepared" | "blocked" | "database_erased" | "completed";
    manifestHash: string;
    storageObjectCount: number;
    storagePrefixCount: number;
    preparedAt?: string;
    preparedExpiresAt?: string;
    databaseErasedAt?: string;
  };
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
  id: string;
  request_id: string;
  target_user_id: string | null;
  status: NonNullable<AdminDeleteRequestRow["erasureStatus"]>;
  storage_manifest_hash: string;
  storage_objects: unknown;
  storage_prefixes: unknown;
  prepared_at: string | null;
  prepared_expires_at: string | null;
  database_erased_at: string | null;
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

  const includeRequestDetails = auth.admin.method === "supabase_app_admin";
  // A deletion-only executor needs the exact request/target/job evidence, but
  // not the contact address, free-text reason, or internal handling notes.
  // Select those fields only for app_admin so they never cross the API
  // boundary to the narrower role.
  const requestColumns = includeRequestDetails
    ? "id, user_id, contact_email, reason, status, due_at, handled_at, handled_note, handled_by_email, handled_by, handled_by_method, created_at"
    : "id, user_id, status, due_at, handled_at, handled_by_method, created_at";
  const openStatuses: AdminDeleteRequestRow["status"][] = [
    "requested",
    "reviewing",
    "needs_followup"
  ];
  const requestRows: AccountDeleteRequestRow[] = [];
  const openPageSize = 1000;

  // Never let a burst of completed or newer requests push an older unfinished
  // deletion request out of the operational queue. PostgREST commonly caps a
  // single response at 1,000 rows, so fetch every unfinished page explicitly,
  // oldest deadline first. Completed history remains bounded below.
  for (let from = 0; ; from += openPageSize) {
    const { data: openData, error: openError } = await supabase
      .from("account_delete_requests")
      .select(requestColumns)
      .in("status", openStatuses)
      .order("due_at", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + openPageSize - 1);

    if (openError) {
      return NextResponse.json({ error: openError.message }, { status: 500 });
    }

    const page = (openData ?? []) as unknown as AccountDeleteRequestRow[];
    requestRows.push(...page);
    if (page.length < openPageSize) break;
  }

  const { data: completedData, error: completedError } = await supabase
    .from("account_delete_requests")
    .select(requestColumns)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(100);

  if (completedError) {
    return NextResponse.json({ error: completedError.message }, { status: 500 });
  }

  // The selected shape is intentionally role-dependent; narrower rows omit
  // optional PII columns and are normalized below before serialization.
  requestRows.push(...((completedData ?? []) as unknown as AccountDeleteRequestRow[]));
  // A request can move to completed between the two reads. Keep one copy in
  // that rare race; the next no-store refresh will show its final ordering.
  const uniqueRequestRows = Array.from(
    new Map(requestRows.map((item) => [item.id, item])).values()
  );
  const requestIds = uniqueRequestRows.map((item) => item.id);
  const erasureJobs = new Map<string, AccountErasureJobRow>();
  const jobLookupBatchSize = 200;
  for (let offset = 0; offset < requestIds.length; offset += jobLookupBatchSize) {
    const requestIdBatch = requestIds.slice(offset, offset + jobLookupBatchSize);
    const { data: jobData, error: jobError } = await supabase
      .from("account_erasure_jobs")
      .select("id, request_id, target_user_id, status, storage_manifest_hash, storage_objects, storage_prefixes, prepared_at, prepared_expires_at, database_erased_at")
      .in("request_id", requestIdBatch);

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
  const deleteRequests: AdminDeleteRequestRow[] = uniqueRequestRows.map((item) => {
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
      erasureJob: erasureJob && /^[0-9a-f]{64}$/.test(erasureJob.storage_manifest_hash)
        ? {
            id: erasureJob.id,
            status: erasureJob.status,
            manifestHash: erasureJob.storage_manifest_hash,
            storageObjectCount: Array.isArray(erasureJob.storage_objects) ? erasureJob.storage_objects.length : 0,
            storagePrefixCount: Array.isArray(erasureJob.storage_prefixes) ? erasureJob.storage_prefixes.length : 0,
            preparedAt: erasureJob.prepared_at ?? undefined,
            preparedExpiresAt: erasureJob.prepared_expires_at ?? undefined,
            databaseErasedAt: erasureJob.database_erased_at ?? undefined
          }
        : undefined,
      ...(includeRequestDetails ? {
        contactEmail: item.contact_email ?? undefined,
        reason: item.reason ?? undefined
      } : {}),
      status: item.status,
      dueAt: item.due_at,
      isOverdue: item.status !== "completed" && dueTime < now,
      daysRemaining,
      handledAt: item.handled_at ?? undefined,
      ...(includeRequestDetails ? {
        handledNote: item.handled_note ?? undefined,
        handledBy: item.handled_by_email ?? item.handled_by_method ?? item.handled_by ?? undefined
      } : {}),
      createdAt: item.created_at
    };
  });

  return NextResponse.json(
    {
      deleteRequests,
      operatorMethod: auth.admin.method,
      source: "supabase"
    },
    { headers: noStoreHeaders }
  );
}

export async function PATCH(request: Request) {
  const auth = await verifyAccountDeleteOperatorRequest(request);
  if (!auth.ok) return auth.response;
  if (auth.admin.aal !== "aal2") {
    return NextResponse.json(
      {
        error: "account_delete_status_aal2_required",
        message: "削除依頼の状態や処理メモを変更するには、多要素認証を完了したログイン（AAL2）が必要です。"
      },
      { status: 403, headers: noStoreHeaders }
    );
  }
  if (auth.admin.method !== "supabase_app_admin") {
    return NextResponse.json(
      {
        error: "account_delete_status_app_admin_required",
        message: "削除依頼の状態と処理メモは、登録済み管理者だけが変更できます。"
      },
      { status: 403, headers: noStoreHeaders }
    );
  }

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
  const { data, error } = await supabase.rpc("update_account_delete_request_status_v2", {
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
