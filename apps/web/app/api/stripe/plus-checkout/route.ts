import { NextResponse } from "next/server";
import { familySelectionErrorResponse, resolveFamilyContext, resolveFamilyId } from "@/lib/family";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { plusSalesReady } from "@/lib/commercialReadiness";

export const dynamic = "force-dynamic";

type StripeCheckoutResponse = {
  id: string;
  url: string | null;
};

/**
 * Plusは家族単位の継続課金。誰が払ったかではなく、どの家族が広がるかで持つ。
 *
 * 注意: これはWebで契約する人向けの導線。iOSアプリ内から同じものを売る場合は
 * App内課金の対象になるため、この経路をそのまま使うことはできない。
 */
export async function POST(request: Request) {
  if (!plusSalesReady()) {
    return NextResponse.json(
      { error: "plus_not_configured", message: "Plusはまだ受付を始めていません。" },
      { status: 503 }
    );
  }

  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "stripe:plus",
    limit: 8,
    windowSeconds: 600
  });
  if (limited) return limited;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;
  const priceId = process.env.STRIPE_PLUS_PRICE_ID as string;

  const context = await resolveFamilyContext(request);
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => ({})) as { familyId?: string };

  let familyId: string;
  try {
    familyId = await resolveFamilyId(context, body.familyId);
  } catch (error) {
    const selectionError = familySelectionErrorResponse(error);
    if (selectionError) return selectionError;
    // 握りつぶすと本番で原因が追えない。今回それで診断が遅れた。
    console.error("[family] failed to prepare family", error);
    return NextResponse.json({ error: "family_failed", message: "家族の情報を用意できませんでした。" }, { status: 500 });
  }

  const { data: family } = await context.service
    .from("families")
    .select("plan, owner_user_id")
    .eq("id", familyId)
    .single();

  if (!family || family.owner_user_id !== context.userId) {
    return NextResponse.json(
      { error: "plus_requires_family_owner", message: "Plusの手続きは、手帳を作った人だけが行えます。" },
      { status: 403 }
    );
  }

  if (family?.plan === "plus") {
    return NextResponse.json(
      { error: "already_plus", message: "この手帳はすでにPlusです。" },
      { status: 409 }
    );
  }

  const origin = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? request.headers.get("origin") ?? "http://localhost:3000";
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/plans?plus=success`,
    cancel_url: `${origin}/plans?plus=cancel`,
    "metadata[familyId]": familyId,
    "subscription_data[metadata][familyId]": familyId
  });

  if (context.email) {
    params.set("customer_email", context.email);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "stripe_failed", message: "決済画面を開けませんでした。時間をおいてお試しください。" },
      { status: 502 }
    );
  }

  const session = await response.json() as StripeCheckoutResponse;
  if (!session.url) {
    return NextResponse.json(
      { error: "stripe_failed", message: "決済画面を開けませんでした。" },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: session.url });
}
