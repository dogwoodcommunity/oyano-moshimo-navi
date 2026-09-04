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
    .from("app_admins")
    .select("id")
    .eq("user_id", userResult.user.id)
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

export type VerifiedJwtAal = "aal1" | "aal2";

export type AccountDeleteOperatorAuthContext = {
  userId: string;
  email?: string;
  method: "supabase_app_admin" | "supabase_account_delete_executor";
  aal: VerifiedJwtAal;
};

export type AccountDeleteOperatorAuthResult =
  | { ok: true; admin: AccountDeleteOperatorAuthContext }
  | { ok: false; response: NextResponse };

function verifiedJwtAal(bearerToken: string): VerifiedJwtAal | null {
  try {
    const payloadPart = bearerToken.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
      aal?: unknown;
    };
    return payload.aal === "aal1" || payload.aal === "aal2" ? payload.aal : null;
  } catch {
    return null;
  }
}

/**
 * Authorizes the account-deletion surface only. Unlike verifyAdminRequest,
 * this never accepts the emergency/static token and does not grant access to
 * any other Admin API. The AAL claim is read only after getUser has verified
 * the JWT signature and expiry.
 */
export async function verifyAccountDeleteOperatorRequest(
  request: Request
): Promise<AccountDeleteOperatorAuthResult> {
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Account deletion operator Bearer authorization is required" },
        { status: 401 }
      )
    };
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Account deletion operator authorization is not configured" },
        { status: 503 }
      )
    };
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userResult.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Account deletion operator Bearer authorization is invalid" },
        { status: 401 }
      )
    };
  }

  const aal = verifiedJwtAal(bearerToken);
  if (!aal) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "A verified authentication assurance level is required" },
        { status: 401 }
      )
    };
  }

  const userId = userResult.user.id;
  const { data: appAdmin, error: appAdminError } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (appAdminError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Account deletion operator authorization could not be verified" },
        { status: 503 }
      )
    };
  }

  const common = {
    userId,
    email: userResult.user.email ?? undefined,
    aal
  };
  if (appAdmin) {
    return { ok: true, admin: { ...common, method: "supabase_app_admin" } };
  }

  const { data: deleteExecutor, error: deleteExecutorError } = await supabase
    .from("account_delete_executors")
    .select("user_id")
    .eq("user_id", userId)
    .eq("active", true)
    .not("activated_at", "is", null)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  if (deleteExecutorError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Account deletion operator authorization could not be verified" },
        { status: 503 }
      )
    };
  }
  if (deleteExecutor) {
    return {
      ok: true,
      admin: { ...common, method: "supabase_account_delete_executor" }
    };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Account deletion operator authorization is required" },
      { status: 403 }
    )
  };
}
