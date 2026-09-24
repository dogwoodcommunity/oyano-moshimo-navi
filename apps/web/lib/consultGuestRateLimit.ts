import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getServerSupabase } from "@/lib/serverSupabase";

const DAY_SECONDS = 86400;
const PER_IP_DAILY_LIMIT = 3;
const SERVICE_DAILY_LIMIT = 50;

type GuestAdmissionResult =
  | { allowed: true }
  | { allowed: false; unavailable: boolean; retryAfter: number };

export function isConsultGuestRateLimitConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Signup must never fall back to a process-local bucket: separate serverless
 * instances would create fresh identities independently. The privileged client
 * is used only for the existing atomic rate-limit RPC, never Auth creation.
 * The deployment proxy must replace client-supplied forwarding headers.
 */
export async function checkConsultGuestRateLimit(request: Request): Promise<GuestAdmissionResult> {
  const unavailable: GuestAdmissionResult = { allowed: false, unavailable: true, retryAfter: 60 };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim() || "";
  if (!isIP(ip)) return unavailable;
  // User-agent changes cannot create a fresh per-IP bucket.
  const ipHash = createHash("sha256").update(ip.toLowerCase()).digest("hex");
  try {
    const supabase = getServerSupabase();
    if (!supabase) return unavailable;
    for (const [key, limit] of [
      [`consult-guest:ip:${ipHash}`, PER_IP_DAILY_LIMIT],
      ["consult-guest:service", SERVICE_DAILY_LIMIT]
    ] as const) {
      const { data, error } = await supabase.rpc("check_public_api_rate_limit", {
        p_key: key, p_limit: limit, p_window_seconds: DAY_SECONDS
      });
      if (error || !data || typeof data.allowed !== "boolean") return unavailable;
      if (!data.allowed) {
        const retryAfter = typeof data.retry_after === "number" && Number.isFinite(data.retry_after)
          ? Math.min(DAY_SECONDS, Math.max(1, Math.ceil(data.retry_after))) : DAY_SECONDS;
        return { allowed: false, unavailable: false, retryAfter };
      }
    }
    return { allowed: true };
  } catch {
    return unavailable;
  }
}
