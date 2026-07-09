import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type StripeCheckoutResponse = {
  id: string;
  url: string | null;
};

type CheckoutBody = {
  caseId?: string;
  checkoutToken?: string;
  contactName?: string;
  contactEmail?: string;
  consentToContact?: boolean;
};

type CaseRow = {
  id: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  consent_to_contact: boolean | null;
};

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const body = await request.json() as CheckoutBody;

  if (!body.caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  if (!body.checkoutToken) {
    return NextResponse.json({ error: "checkout_token_required" }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_SUPPORT_PACK_PRICE_ID;

  if (!stripeSecretKey || !priceId) {
    return NextResponse.json({
      error: "Stripe is not configured",
      requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_SUPPORT_PACK_PRICE_ID"]
    }, { status: 501 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({
      error: "Supabase is required for Stripe checkout",
      requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    }, { status: 501 });
  }

  const tokenCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: tokenRow, error: tokenError } = await supabase
    .from("case_results")
    .select("id")
    .eq("case_id", body.caseId)
    .eq("app_handoff_token", body.checkoutToken)
    .gt("created_at", tokenCutoff)
    .limit(1)
    .maybeSingle();

  if (tokenError) {
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }

  if (!tokenRow) {
    return NextResponse.json({ error: "invalid_checkout_token" }, { status: 403 });
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, status, contact_name, contact_email, consent_to_contact")
    .eq("id", body.caseId)
    .maybeSingle();

  if (caseError) {
    return NextResponse.json({ error: caseError.message }, { status: 500 });
  }

  if (!caseRow) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }

  const typedCase = caseRow as CaseRow;
  if (!["result_ready", "converted"].includes(typedCase.status)) {
    return NextResponse.json({ error: "case_result_not_ready" }, { status: 409 });
  }

  const contactEmail = body.contactEmail?.trim() || typedCase.contact_email || "";
  const contactName = body.contactName?.trim() || typedCase.contact_name || "";
  const consentToContact = Boolean(body.consentToContact || typedCase.consent_to_contact);

  if (!contactEmail || !looksLikeEmail(contactEmail) || !consentToContact) {
    return NextResponse.json({ error: "contact_email_and_consent_required" }, { status: 422 });
  }

  const { data: existingPaid } = await supabase
    .from("support_packs")
    .select("id, status")
    .eq("case_id", body.caseId)
    .in("status", ["paid", "reviewing", "report_ready", "delivered", "closed"])
    .limit(1)
    .maybeSingle();

  if (existingPaid) {
    return NextResponse.json({
      error: "Support pack is already active for this case",
      supportPackStatus: existingPaid.status
    }, { status: 409 });
  }

  await supabase.from("cases").update({
    contact_name: contactName,
    contact_email: contactEmail,
    consent_to_contact: true
  }).eq("id", body.caseId);

  const origin = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? request.headers.get("origin") ?? "http://localhost:3000";
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/result/${body.caseId}?support_pack=success`,
    cancel_url: `${origin}/result/${body.caseId}?support_pack=cancel`,
    customer_email: contactEmail,
    "metadata[caseId]": body.caseId,
    "metadata[contactEmail]": contactEmail,
    "payment_intent_data[metadata][caseId]": body.caseId
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({ error: errorText }, { status: 502 });
  }

  const session = await response.json() as StripeCheckoutResponse;

  const requestedScope = {
    source: "stripe_checkout",
    stripe_checkout_session_id: session.id,
    contact_email: contactEmail
  };

  const { data: existingRequested } = await supabase
    .from("support_packs")
    .select("id")
    .eq("case_id", body.caseId)
    .eq("status", "requested")
    .limit(1)
    .maybeSingle();

  if (existingRequested) {
    await supabase
      .from("support_packs")
      .update({ requested_scope: requestedScope, updated_at: new Date().toISOString() })
      .eq("id", existingRequested.id);
  } else {
    await supabase.from("support_packs").insert({
      case_id: body.caseId,
      status: "requested",
      requested_scope: requestedScope
    });
  }

  return NextResponse.json({ checkoutUrl: session.url, checkoutSessionId: session.id });
}
