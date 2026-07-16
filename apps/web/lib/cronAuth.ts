import crypto from "crypto";
import { NextResponse } from "next/server";

export function verifyCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return null;

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const actual = token ? Buffer.from(token) : null;
  const expectedBuffer = Buffer.from(expected);

  if (!actual || actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
    return NextResponse.json({ error: "Invalid cron token" }, { status: 401 });
  }

  return null;
}
