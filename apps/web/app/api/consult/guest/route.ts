import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkConsultGuestRateLimit, isConsultGuestRateLimitConfigured } from "@/lib/consultGuestRateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;
const MAX_CAPTCHA_LENGTH = 2048;

function json(body: Record<string, unknown>, status = 200, retryAfter?: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {})
    }
  });
}

function guestConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (process.env.CONSULT_GUEST_ENABLED !== "true" || !url || !anonKey || !captchaSiteKey
    || !isConsultGuestRateLimitConfigured()) return null;
  return { url, anonKey, captchaSiteKey };
}

function sameOrigin(request: Request) {
  try {
    const fetchSite = request.headers.get("sec-fetch-site");
    return request.headers.get("origin") === new URL(request.url).origin
      && (!fetchSite || fetchSite === "same-origin");
  } catch {
    return false;
  }
}

async function readCaptcha(request: Request): Promise<
  { captchaToken: string } | { status: number; error: string }
> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { status: 415, error: "invalid_content_type" };
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    return { status: 413, error: "request_too_large" };
  }
  if (!request.body) return { status: 400, error: "captcha_required" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return { status: 413, error: "request_too_large" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { status: 400, error: "invalid_request" };
    }
    const row = payload as Record<string, unknown>;
    const captchaToken = typeof row.captchaToken === "string" ? row.captchaToken.trim() : "";
    if (!captchaToken || captchaToken.length > MAX_CAPTCHA_LENGTH) {
      return { status: 400, error: "captcha_required" };
    }
    if (Object.keys(row).some((key) => key !== "captchaToken")) {
      return { status: 400, error: "invalid_request" };
    }
    return { captchaToken };
  } catch {
    return { status: 400, error: "invalid_request" };
  } finally {
    reader.releaseLock();
  }
}

// This is configuration discovery only. It must never create a guest identity.
export async function GET() {
  const config = guestConfig();
  return json(config ? { enabled: true, captchaSiteKey: config.captchaSiteKey } : { enabled: false });
}

export async function POST(request: Request) {
  const config = guestConfig();
  if (!config) return json({ error: "guest_unavailable", message: "メールなしの相談開始は、まだ準備中です。" }, 503);
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed", message: "相談画面からもう一度お試しください。" }, 403);
  const payload = await readCaptcha(request);
  if ("error" in payload) return json({ error: payload.error, message: "確認をやり直してから、もう一度お試しください。" }, payload.status);
  const limit = await checkConsultGuestRateLimit(request);
  if (!limit.allowed) {
    return json({
      error: limit.unavailable ? "guest_unavailable" : "guest_rate_limited",
      message: limit.unavailable ? "いまは相談の準備を確認できません。時間をおいてお試しください。" : "相談の開始が混み合っています。時間をおいてお試しください。"
    }, limit.unavailable ? 503 : 429, limit.retryAfter);
  }
  try {
    // Supabase Auth must have anonymous sign-in AND Turnstile verification
    // enabled before CONSULT_GUEST_ENABLED is enabled. A public client keeps
    // server-side CAPTCHA checks intact; admin/service-role creation is forbidden.
    const client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) }
    });
    const { data, error } = await client.auth.signInAnonymously({ options: { captchaToken: payload.captchaToken } });
    if (error) {
      if (error.status === 429) return json({ error: "guest_rate_limited", message: "時間をおいて、もう一度お試しください。" }, 429, 60);
      if (error.code === "captcha_failed") return json({ error: "captcha_failed", message: "確認が切れています。もう一度確認してください。" }, 400);
      return json({ error: "guest_unavailable", message: "相談を始められませんでした。時間をおいてお試しください。" }, 503);
    }
    if (!data.user?.is_anonymous || !data.session?.access_token || !data.session.refresh_token) {
      return json({ error: "guest_unavailable", message: "相談の準備を完了できませんでした。もう一度お試しください。" }, 503);
    }
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }, 201);
  } catch {
    return json({ error: "guest_unavailable", message: "相談を始められませんでした。時間をおいてお試しください。" }, 503);
  }
}
