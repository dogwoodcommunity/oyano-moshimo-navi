import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminSupportPackRow = {
  id: string;
  caseId?: string;
  status: string;
  contactName?: string;
  contactEmail?: string;
  createdAt: string;
};

type SupportPackRow = {
  id: string;
  case_id: string | null;
  status: string;
  created_at: string;
  cases?: {
    contact_name: string | null;
    contact_email: string | null;
  } | Array<{
    contact_name: string | null;
    contact_email: string | null;
  }> | null;
};

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ supportPacks: [], source: "not_configured" });
  }

  const { data, error } = await supabase
    .from("support_packs")
    .select("id, case_id, status, created_at, cases(contact_name, contact_email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const supportPacks: AdminSupportPackRow[] = ((data ?? []) as SupportPackRow[]).map((item) => {
    const caseRow = Array.isArray(item.cases) ? item.cases[0] : item.cases;
    return {
      id: item.id,
      caseId: item.case_id ?? undefined,
      status: item.status,
      contactName: caseRow?.contact_name ?? undefined,
      contactEmail: caseRow?.contact_email ?? undefined,
      createdAt: item.created_at
    };
  });

  return NextResponse.json({ supportPacks, source: "supabase" });
}
