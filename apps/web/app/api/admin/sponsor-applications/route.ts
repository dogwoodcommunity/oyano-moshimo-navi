import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

export type AdminSponsorApplicationRow = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  prefecture: string;
  city?: string;
  category: string;
  slotType: string;
  budgetNote?: string;
  website?: string;
  message?: string;
  status: string;
  createdAt: string;
};

type SponsorApplicationRow = {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  prefecture: string;
  city: string | null;
  category: string;
  slot_type: string;
  budget_note: string | null;
  website: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ sponsorApplications: [], source: "not_configured" });
  }

  const { data, error } = await supabase
    .from("sponsor_applications")
    .select("id, company_name, contact_name, contact_email, contact_phone, prefecture, city, category, slot_type, budget_note, website, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sponsorApplications: AdminSponsorApplicationRow[] = ((data ?? []) as SponsorApplicationRow[]).map((item) => ({
    id: item.id,
    companyName: item.company_name,
    contactName: item.contact_name,
    contactEmail: item.contact_email,
    contactPhone: item.contact_phone ?? undefined,
    prefecture: item.prefecture,
    city: item.city ?? undefined,
    category: item.category,
    slotType: item.slot_type,
    budgetNote: item.budget_note ?? undefined,
    website: item.website ?? undefined,
    message: item.message ?? undefined,
    status: item.status,
    createdAt: item.created_at
  }));

  return NextResponse.json({ sponsorApplications, source: "supabase" });
}
