import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type DeleteRequestBody = {
  reason?: string;
  contact_email?: string;
  requested_from?: "web" | "mobile_app";
};

type AuthenticatedRequest = {
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>;
  user: {
    id: string;
    email?: string;
  };
};

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

function looksLikeEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function authenticate(request: Request): Promise<AuthenticatedRequest | NextResponse> {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "account_deletion_unavailable", message: "削除依頼の受付を準備できていません。" },
      { status: 503 }
    );
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "authorization_required", message: "メール確認が必要です。" }, { status: 401 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) {
    return NextResponse.json({ error: "invalid_authorization", message: "ログインを確認できませんでした。" }, { status: 401 });
  }

  return { supabase, user };
}

export async function GET(request: Request) {
  const authenticated = await authenticate(request);
  if (authenticated instanceof NextResponse) return authenticated;

  const { data, error } = await authenticated.supabase
    .from("account_delete_requests")
    .select("id,status,due_at,created_at,last_status_changed_at")
    .eq("user_id", authenticated.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "delete_request_lookup_failed", message: "削除依頼の状態を確認できませんでした。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ request: data ?? null });
}

export async function POST(request: Request) {
  const authenticated = await authenticate(request);
  if (authenticated instanceof NextResponse) return authenticated;
  const { supabase, user } = authenticated;

  const body = await request.json().catch(() => ({})) as DeleteRequestBody;
  const contactEmail = (body.contact_email?.trim() || user.email || "").toLowerCase();
  if (!looksLikeEmail(contactEmail)) {
    return NextResponse.json(
      { error: "invalid_contact_email", message: "連絡先メールアドレスを確認してください。" },
      { status: 422 }
    );
  }
  const reason = body.reason?.trim().slice(0, 1000) || null;
  const requestedFrom = body.requested_from === "web" ? "web" : "mobile_app";

  // メール確認だけ済ませ、まだ手帳をクラウド保存していない利用者にも
  // 削除依頼の入口を保証する。FKのためだけに必要な最小プロフィールを用意する。
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? contactEmail,
    updated_at: new Date().toISOString()
  });
  if (profileError) {
    return NextResponse.json(
      { error: "delete_request_profile_failed", message: "削除依頼の本人情報を確認できませんでした。" },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const { data: existingRequest, error: existingError } = await supabase
    .from("account_delete_requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["requested", "reviewing", "needs_followup"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const requestPayload = {
    user_id: user.id,
    contact_email: contactEmail,
    reason,
    requested_from: requestedFrom,
    last_status_changed_at: now
  };

  const { data: deleteRequest, error: requestError } = existingRequest?.id
    ? await supabase
      .from("account_delete_requests")
      .update(requestPayload)
      .eq("id", existingRequest.id)
      .select("id")
      .single()
    : await supabase
      .from("account_delete_requests")
      .insert(requestPayload)
      .select("id")
      .single();

  if (requestError) {
    return NextResponse.json({ error: requestError.message }, { status: 500 });
  }

  const { data: auditLog, error: auditError } = await supabase.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "account_delete_requested",
    target_type: "account_delete_request",
    target_id: deleteRequest.id,
    metadata: {
      requested_from: requestedFrom,
      request_id: deleteRequest.id,
      duplicate_request_updated: Boolean(existingRequest?.id)
    }
  }).select("id").single();

  if (auditError) {
    console.error("[account-delete] request saved but audit log failed", auditError);
    return NextResponse.json({ received: true, requestId: deleteRequest.id, auditPending: true });
  }

  await supabase
    .from("account_delete_requests")
    .update({ audit_log_id: auditLog.id })
    .eq("id", deleteRequest.id);

  return NextResponse.json({ received: true, requestId: deleteRequest.id });
}
