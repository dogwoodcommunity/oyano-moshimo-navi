import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
};

type LocalBucket = {
  count: number;
  resetAt: number;
};

const localBuckets = new Map<string, LocalBucket>();

function clientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent") ?? "";
  const source = `${forwardedFor || realIp || "unknown"}:${userAgent}`;
  return createHash("sha256").update(source).digest("hex").slice(0, 32);
}

function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limit_exceeded", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfter))
      }
    }
  );
}

function localRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const current = localBuckets.get(key);

  if (!current || current.resetAt <= now) {
    localBuckets.set(key, {
      count: 1,
      resetAt: now + options.windowSeconds * 1000
    });
    return null;
  }

  current.count += 1;
  if (current.count <= options.limit) return null;

  return rateLimitResponse(Math.ceil((current.resetAt - now) / 1000));
}

export async function checkPublicRateLimit(request: Request, options: RateLimitOptions) {
  const key = `${options.keyPrefix}:${clientKey(request)}`;
  const supabase = getServerSupabase();

  if (!supabase) {
    return localRateLimit(key, options);
  }

  const { data, error } = await supabase.rpc("check_public_api_rate_limit", {
    p_key: key,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds
  });

  if (error) {
    return localRateLimit(key, options);
  }

  const result = data as { allowed?: boolean; retry_after?: number } | null;
  if (result?.allowed !== false) return null;

  return rateLimitResponse(result.retry_after ?? options.windowSeconds);
}
