import { NextResponse } from "next/server";
import { getServerSupabase } from "./serverSupabase";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const token = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,256}\]$/;
const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function applyPushInstallation(request: Request, action: "register" | "revoke") {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return response({ error: "unauthorized" }, 401);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return response({ error: "invalid_request" }, 400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return response({ error: "invalid_request" }, 400); }
    if (!body || typeof body !== "object" || body.protocol !== 2) return response({ error: "upgrade_required" }, 426);
    if (typeof body.installationId !== "string" || !uuid.test(body.installationId)
      || typeof body.requestId !== "string" || !uuid.test(body.requestId)
      || typeof body.secret !== "string" || !/^[a-f0-9]{64}$/.test(body.secret)
      || !Number.isSafeInteger(body.revision) || (body.revision as number) < 1
      || (action === "register" && (typeof body.expoPushToken !== "string" || !token.test(body.expoPushToken)
        || !["ios", "android"].includes(body.platform as string)))
      || (action === "revoke" && (body.expoPushToken !== undefined || body.platform !== undefined))) {
      return response({ error: "invalid_request" }, 400);
    }
    // Enable only after reviewed legacy inventory, migration and erasure tests.
    if (process.env.PUSH_INSTALLATION_V2_ENABLED !== "true") return response({ error: "push_upgrade_pending" }, 503);
    const client = getServerSupabase();
    if (!client) return response({ error: "unavailable" }, 503);
    const { data: auth, error: authError } = await client.auth.getUser(bearer);
    if (authError || !auth.user) return response({ error: "unauthorized" }, 401);
    // Preserve the former route's first-login profile creation, without
    // overwriting existing names/email. The erasure recreation guard remains
    // authoritative if this Auth user was already erased.
    const { error: profileError } = await client.from("profiles").upsert({ id: auth.user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) return response({ error: "profile_unavailable" }, 409);
    const { data, error } = await client.rpc("apply_push_installation_operation_v2", {
      p_user_id: auth.user.id, p_installation_id: body.installationId, p_secret: body.secret,
      p_revision: body.revision, p_request_id: body.requestId, p_action: action,
      p_token: action === "register" ? body.expoPushToken : null,
      p_platform: action === "register" ? body.platform : null
    });
    if (error || !data || typeof data !== "object") return response({ error: "unavailable" }, 503);
    const result = data as Record<string, unknown>;
    if (result.ok === true && result.installationId === body.installationId && result.revision === body.revision
      && result.requestId === body.requestId && ["active", "revoked"].includes(result.state as string)) {
      return response({ ok: true, installationId: result.installationId, revision: result.revision, requestId: result.requestId, state: result.state });
    }
    const known = ["invalid_request", "profile_unavailable", "installation_retired", "installation_conflict", "stale_revision", "revision_conflict", "token_conflict"];
    return typeof result.error === "string" && known.includes(result.error)
      ? response({ error: result.error }, 409)
      : response({ error: "unavailable" }, 503);
  } catch { return response({ error: "unavailable" }, 503); }
}

export type DeliverablePushToken = {
  id: string; user_id: string; expo_push_token: string;
  installation_id: string | null; installation_revision: number | null;
};

export async function invalidatePushDelivery(client: NonNullable<ReturnType<typeof getServerSupabase>>, rows: DeliverablePushToken[], tokens: string[]) {
  const invalid = new Set(tokens);
  await Promise.all(rows.filter((row) => invalid.has(row.expo_push_token)).map((row) => client.rpc("invalidate_push_delivery_v2", {
    p_id: row.id, p_revision: row.installation_revision, p_token: row.expo_push_token
  })));
}
