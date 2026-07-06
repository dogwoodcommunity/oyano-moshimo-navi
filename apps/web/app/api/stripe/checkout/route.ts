import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type StripeCheckoutResponse = {
  id: string;
  url: string | null;
};

export async function POST(request: Request) {
  const body = await request.json() as { caseId?: string };

  if (!body.caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
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

  if (supabase) {
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
  }

  const origin = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? request.headers.get("origin") ?? "http://localhost:3000";
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/result/${body.caseId}?support_pack=success`,
    cancel_url: `${origin}/result/${body.caseId}?support_pack=cancel`,
    "metadata[caseId]": body.caseId,
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

  if (supabase) {
    const requestedScope = {
      source: "stripe_checkout",
      stripe_checkout_session_id: session.id
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
  }

  return NextResponse.json({ checkoutUrl: session.url, checkoutSessionId: session.id });
}
