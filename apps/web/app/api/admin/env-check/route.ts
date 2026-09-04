import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { isValidLegalEffectiveDate } from "@/lib/commercialReadiness";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_ACCESS_TOKEN",
  "ACCOUNT_ERASURE_EXECUTION_ENABLED",
  "COMMERCIAL_SUPPORT_PACK_SALES_ENABLED",
  "COMMERCIAL_PLUS_SALES_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_SUPPORT_PACK_PRICE_ID",
  "STRIPE_PLUS_PRICE_ID",
  "NEXT_PUBLIC_PLUS_PRICE_LABEL",
  "STRIPE_WEBHOOK_SECRET",
  "LEGAL_BUSINESS_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_ADDRESS",
  "LEGAL_PHONE",
  "LEGAL_PHONE_HOURS",
  "LEGAL_CONTACT",
  "LEGAL_CONTACT_RESPONSE_TARGET",
  "LEGAL_TERMS_EFFECTIVE_DATE",
  "LEGAL_PRIVACY_EFFECTIVE_DATE",
  "LEGAL_PRICE_DESCRIPTION",
  "LEGAL_SERVICE_DELIVERY",
  "LEGAL_CANCELLATION_POLICY",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "NOTIFICATION_EMAIL_FROM",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_WEB_BASE_URL"
];

function isConfigured(key: string) {
  const current = process.env[key]?.trim() ?? "";
  if (key === "LEGAL_TERMS_EFFECTIVE_DATE" || key === "LEGAL_PRIVACY_EFFECTIVE_DATE") {
    return isValidLegalEffectiveDate(current);
  }
  return Boolean(current);
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    env: requiredEnv.map((key) => ({
      key,
      configured: isConfigured(key)
    }))
  });
}
