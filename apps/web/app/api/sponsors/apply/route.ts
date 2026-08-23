import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

const allowedCategories = new Set(["葬儀", "相続士業", "家族信託", "ホーム紹介", "保険", "遺品整理", "その他"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "sponsor-apply",
    limit: 12,
    windowSeconds: 3600
  });
  if (limited) return limited;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const companyName = text(payload.companyName, 120);
  const contactName = text(payload.contactName, 80);
  const email = text(payload.email, 160).toLowerCase();
  const phone = text(payload.phone, 40);
  const prefecture = text(payload.prefecture, 20);
  const city = text(payload.city, 80);
  const category = text(payload.category, 40);
  const slotType = text(payload.slotType, 80);
  const website = text(payload.website, 240);
  const budgetNote = text(payload.budgetNote, 120);
  const message = text(payload.message, 1200);
  const consent = payload.consent === "yes" || payload.consent === true;

  if (!companyName || !contactName || !emailPattern.test(email) || !prefecture || !allowedCategories.has(category) || !slotType || !consent) {
    return NextResponse.json({ error: "required_fields_missing" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "sponsor_applications_not_ready" }, { status: 503 });
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { error } = await supabase
    .from("sponsor_applications")
    .insert({
      company_name: companyName,
      contact_name: contactName,
      contact_email: email,
      contact_phone: phone || null,
      prefecture,
      city: city || null,
      category,
      slot_type: slotType,
      website: website || null,
      budget_note: budgetNote || null,
      message: message || null,
      consent_to_contact: consent,
      ip_address: ipAddress,
      user_agent: userAgent,
      status: "new"
    });

  if (error) {
    const status = error.message.includes("sponsor_applications") ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "sponsor_applications_not_ready" : "insert_failed" }, { status });
  }

  return NextResponse.json({ ok: true });
}
