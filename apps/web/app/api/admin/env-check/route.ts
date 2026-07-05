import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_ACCESS_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_SUPPORT_PACK_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
  "NEXT_PUBLIC_WEB_BASE_URL"
];

export async function GET(request: Request) {
  const unauthorized = verifyAdminRequest(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    env: requiredEnv.map((key) => ({
      key,
      configured: Boolean(process.env[key])
    }))
  });
}
