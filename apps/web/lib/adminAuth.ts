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

type SupabaseAppAdminVerification =
  | { status: "not_present" | "invalid" | "not_admin" | "unavailable" }
  | { status: "authorized"; admin: AdminAuthContext };

async function verifySupabaseAppAdmin(request: Request): Promise<SupabaseAppAdminVerification> {
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) return { status: "not_present" };

  const supabase = getServerSupabase();
  if (!supabase) return { status: "unavailable" };

  const { data: userResult, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userResult.user) return { status: "invalid" };

  const { data: member, error: memberError } = await supabase
    .from("app_admins")
    .select("id")
    .eq("user_id", userResult.user.id)
    .limit(1)
    .maybeSingle();

  if (memberError) return { status: "unavailable" };
  if (!member) return { status: "not_admin" };

  return {
    status: "authorized",
    admin: {
      userId: userResult.user.id,
      email: userResult.user.email ?? undefined,
      method: "supabase_app_admin"
    }
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
  if (appAdmin.status === "authorized") return { ok: true, admin: appAdmin.admin };

  const staticAdmin = verifyStaticAdminToken(request);
  if (staticAdmin) return { ok: true, admin: staticAdmin };

  if (appAdmin.status === "not_admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin authorization is forbidden" }, { status: 403 })
    };
  }

  if (appAdmin.status === "unavailable") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin authorization could not be verified" },
        { status: 503 }
      )
    };
  }

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
  const { data: operatorData, error: operatorError } = await supabase.rpc(
    "verify_account_delete_operator_v2",
    { p_operator_user_id: userId }
  );
  if (operatorError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Account deletion operator authorization could not be verified" },
        { status: 503 }
      )
    };
  }

  const operator = operatorData && typeof operatorData === "object" && !Array.isArray(operatorData)
    ? operatorData as { result?: unknown; method?: unknown }
    : null;
  const common = {
    userId,
    email: userResult.user.email ?? undefined,
    aal
  };
  if (operator?.result === "authorized" && operator.method === "supabase_app_admin") {
    return { ok: true, admin: { ...common, method: "supabase_app_admin" } };
  }
  if (operator?.result === "authorized" && operator.method === "supabase_account_delete_executor") {
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
