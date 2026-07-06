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
      };
      payment_status?: string;
    };
  };
};

function verifyStripeSignature(payload: string, signatureHeader: string | null, webhookSecret: string): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const caseId = session.metadata?.caseId;
    const supabase = getServerSupabase();

    if (caseId && supabase) {
      const purchasePayload = {
        provider: "stripe",
        provider_checkout_id: session.id,
        amount_yen: session.amount_total ?? null,
        status: session.payment_status === "paid" ? "paid" : "pending",
        purchased_at: session.payment_status === "paid" ? new Date().toISOString() : null
      };

      const { data: existingPurchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("provider", "stripe")
        .eq("provider_checkout_id", session.id)
        .limit(1)
        .maybeSingle();

      const purchase = existingPurchase
        ? existingPurchase
        : (await supabase.from("purchases").insert(purchasePayload).select("id").single()).data;

      await supabase.from("support_packs")
        .update({
          status: session.payment_status === "paid" ? "paid" : "requested",
          purchase_id: purchase?.id ?? null
        })
        .eq("case_id", caseId)
        .in("status", ["requested"]);
    }
  }

  return NextResponse.json({ received: true });
}
