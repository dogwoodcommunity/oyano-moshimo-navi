import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSupabase } from "./serverSupabase";

export type AdminAuthContext = {
  userId?: string;
  email?: string;
  method: "supabase_app_admin" | "static_token";
};

export type AdminAuthResult =
  | { ok: true; admin: AdminAuthContext }
  | { ok: false; response: NextResponse };

function safeTokenEqual(actualToken: string, expectedToken: string) {
  const actual = Buffer.from(actualToken);
  const expected = Buffer.from(expectedToken);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function verifySupabaseAppAdmin(request: Request): Promise<AdminAuthContext | null> {
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) return null;

  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: userResult, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userResult.user) return null;

  const { data: member } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", userResult.user.id)
    .eq("role", "admin")
    .eq("relationship", "app_admin")
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  return {
    userId: userResult.user.id,
    email: userResult.user.email ?? undefined,
    method: "supabase_app_admin"
  };
}

function verifyStaticAdminToken(request: Request): AdminAuthContext | null {
  const expectedToken = process.env.ADMIN_ACCESS_TOKEN;
  if (!expectedToken) return null;

  const actualToken = request.headers.get("x-admin-token");

  if (!actualToken || !safeTokenEqual(actualToken, expectedToken)) return null;

  return { method: "static_token" };
}

export async function verifyAdminRequest(request: Request): Promise<AdminAuthResult> {
  const appAdmin = await verifySupabaseAppAdmin(request);
  if (appAdmin) return { ok: true, admin: appAdmin };

  const staticAdmin = verifyStaticAdminToken(request);
  if (staticAdmin) return { ok: true, admin: staticAdmin };

  return {
    ok: false,
    response: NextResponse.json({ error: "Admin authorization is required" }, { status: 401 })
  };
}
