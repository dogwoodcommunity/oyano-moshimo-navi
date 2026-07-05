import { NextResponse } from "next/server";
import type { ParentStatus } from "@oyano/shared";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminCaseRow = {
  id: string;
  selectedStatus: ParentStatus;
  status: string;
  contactName?: string;
  contactEmail?: string;
  createdAt: string;
  supportPackStatus?: string;
};

type CaseRow = {
  id: string;
  selected_status: ParentStatus | null;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
  support_packs?: Array<{ status: string }> | null;
};

export async function GET(request: Request) {
  const unauthorized = verifyAdminRequest(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ cases: [], source: "not_configured" });
  }

  const { data, error } = await supabase
    .from("cases")
    .select("id, selected_status, status, contact_name, contact_email, created_at, support_packs(status)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cases: AdminCaseRow[] = ((data ?? []) as CaseRow[]).map((item) => ({
    id: item.id,
    selectedStatus: item.selected_status ?? "preparing",
    status: item.status,
    contactName: item.contact_name ?? undefined,
    contactEmail: item.contact_email ?? undefined,
    createdAt: item.created_at,
    supportPackStatus: item.support_packs?.[0]?.status ?? "none"
  }));

  return NextResponse.json({ cases, source: "supabase" });
}
