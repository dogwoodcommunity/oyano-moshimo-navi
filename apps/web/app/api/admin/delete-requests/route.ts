import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminDeleteRequestRow = {
  id: string;
  userId?: string;
  contactEmail?: string;
  reason?: string;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  metadata: {
    contact_email?: string | null;
    reason?: string | null;
  } | null;
  created_at: string;
};

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
    createdAt: item.created_at
  }));

  return NextResponse.json({ deleteRequests, source: "supabase" });
}
