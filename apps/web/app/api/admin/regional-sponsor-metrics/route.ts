import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";
import { PREFECTURES, SPONSOR_CATEGORIES, publicPrefectureUsageThreshold } from "@/lib/prefectures";

export const dynamic = "force-dynamic";

export type AdminRegionalSponsorMetricRow = {
  prefecture: string;
  category: string;
  activeFamilies: number;
  previousMonthFamilies: number;
  monthOverMonthFamilies: number;
  publicStatus: "visible" | "hidden";
  partnerCompany?: string;
  partnerStatus?: string;
  pageViews: number;
  taps: number;
  inquiries: number;
};

type CountRow = {
  prefecture: string | null;
  active_families: number | null;
  previous_month_families: number | null;
  month_over_month_families: number | null;
};

type PartnerRow = {
  prefecture: string | null;
  category: string | null;
  company_name: string | null;
  status: string | null;
  page_views: number | null;
  taps: number | null;
  inquiries: number | null;
};

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildRows(
  threshold: number,
  countRows: CountRow[] = [],
  partnerRows: PartnerRow[] = []
): AdminRegionalSponsorMetricRow[] {
  const counts = new Map(
    countRows
      .filter((row) => row.prefecture)
      .map((row) => [row.prefecture as string, row])
  );
  const partners = new Map(
    partnerRows
      .filter((row) => row.prefecture && row.category)
      .map((row) => [`${row.prefecture}::${row.category}`, row])
  );

  return PREFECTURES.flatMap((prefecture) =>
    SPONSOR_CATEGORIES.map((category) => {
      const count = counts.get(prefecture);
      const partner = partners.get(`${prefecture}::${category}`);
      const activeFamilies = numeric(count?.active_families);

      return {
        prefecture,
        category,
        activeFamilies,
        previousMonthFamilies: numeric(count?.previous_month_families),
        monthOverMonthFamilies: numeric(count?.month_over_month_families),
        publicStatus: activeFamilies >= threshold ? "visible" : "hidden",
        partnerCompany: partner?.company_name ?? undefined,
        partnerStatus: partner?.status ?? undefined,
        pageViews: numeric(partner?.page_views),
        taps: numeric(partner?.taps),
        inquiries: numeric(partner?.inquiries)
      };
    })
  );
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const threshold = publicPrefectureUsageThreshold();
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({
      rows: buildRows(threshold),
      threshold,
      source: "not_configured"
    });
  }

  const { data: countData, error: countError } = await supabase
    .from("prefecture_active_family_counts")
    .select("prefecture, active_families, previous_month_families, month_over_month_families");

  if (countError) {
    return NextResponse.json({
      rows: buildRows(threshold),
      threshold,
      source: "not_ready",
      message: countError.message
    });
  }

  const { data: partnerData, error: partnerError } = await supabase
    .from("partners")
    .select("prefecture, category, company_name, status, page_views, taps, inquiries");

  return NextResponse.json({
    rows: buildRows(threshold, (countData ?? []) as CountRow[], (partnerData ?? []) as PartnerRow[]),
    threshold,
    source: "supabase",
    ...(partnerError ? { partnerMessage: partnerError.message } : {})
  });
}
