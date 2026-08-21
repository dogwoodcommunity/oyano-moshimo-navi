import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      amount_total?: number;
      metadata?: {
        caseId?: string;
        familyId?: string;
      };
      payment_status?: string;
      mode?: string;
      subscription?: string;
      status?: string;
      current_period_end?: number;
    };
  };
};

type StripeCheckoutSession = StripeEvent["data"]["object"];

function verifyStripeSignature(payload: string, signatureHeader: string | null, webhookSecret: string): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const toleranceSeconds = 5 * 60;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function paymentStatusForEvent(eventType: string, session: StripeCheckoutSession) {
  if (eventType === "checkout.session.async_payment_succeeded") return "paid";
  if (eventType === "checkout.session.async_payment_failed") return "failed";
  return session.payment_status === "paid" ? "paid" : "pending";
}

async function persistCheckoutSession(eventType: string, session: StripeCheckoutSession) {
  const caseId = session.metadata?.caseId;
  const supabase = getServerSupabase();

  if (!caseId || !supabase) return;

  const paymentStatus = paymentStatusForEvent(eventType, session);
  const purchasePayload = {
    provider: "stripe",
    provider_checkout_id: session.id,
    amount_yen: session.amount_total ?? null,
    status: paymentStatus,
    purchased_at: paymentStatus === "paid" ? new Date().toISOString() : null
  };

  const { data: existingPurchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_checkout_id", session.id)
    .limit(1)
    .maybeSingle();

  const purchase = existingPurchase
    ? (await supabase.from("purchases").update(purchasePayload).eq("id", existingPurchase.id).select("id").single()).data
    : (await supabase.from("purchases").insert(purchasePayload).select("id").single()).data;

  await supabase.from("support_packs")
    .update({
      status: paymentStatus === "paid" ? "paid" : "requested",
      purchase_id: purchase?.id ?? null
    })
    .eq("case_id", caseId)
    .in("status", ["requested"]);
}

/**
 * Plusは家族単位。支払いが続いている間だけ families.plan を plus にする。
 * 解約や失敗で戻す経路が無いと、返金後もPlusのままになる。
 */
async function persistFamilyPlan(eventType: string, object: StripeCheckoutSession) {
  const familyId = object.metadata?.familyId;
  const supabase = getServerSupabase();
  if (!familyId || !supabase) return;

  const activeStatuses = ["active", "trialing"];
  const isActive = eventType === "checkout.session.completed"
    ? object.payment_status !== "unpaid"
    : activeStatuses.includes(object.status ?? "");

  const subscriptionId = eventType === "checkout.session.completed"
    ? object.subscription ?? null
    : object.id;

  const periodEnd = object.current_period_end
    ? new Date(object.current_period_end * 1000).toISOString()
    : null;

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  const payload = {
    family_id: familyId,
    provider: "stripe",
    provider_subscription_id: subscriptionId,
    status: isActive ? "active" : "canceled",
    current_period_end: periodEnd,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    await supabase.from("subscriptions").update(payload).eq("id", existing.id);
  } else if (subscriptionId) {
    await supabase.from("subscriptions").insert(payload);
  }

  await supabase
    .from("families")
    .update({ plan: isActive ? "plus" : "free", updated_at: new Date().toISOString() })
    .eq("id", familyId);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 501 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  if ([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed"
  ].includes(event.type)) {
    if (event.data.object.mode === "subscription" || event.data.object.metadata?.familyId) {
      await persistFamilyPlan(event.type, event.data.object);
    } else {
      await persistCheckoutSession(event.type, event.data.object);
    }
  }

  if ([
    "customer.subscription.updated",
    "customer.subscription.deleted"
  ].includes(event.type)) {
    await persistFamilyPlan(event.type, event.data.object);
  }

  return NextResponse.json({ received: true });
}
