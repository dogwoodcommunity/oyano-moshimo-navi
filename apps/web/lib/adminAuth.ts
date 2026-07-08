import { NextResponse } from "next/server";
import crypto from "crypto";

function safeTokenEqual(actualToken: string, expectedToken: string) {
  const actual = Buffer.from(actualToken);
  const expected = Buffer.from(expectedToken);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function verifyAdminRequest(request: Request) {
  const expectedToken = process.env.ADMIN_ACCESS_TOKEN;
  if (!expectedToken) return null;

  const actualToken = request.headers.get("x-admin-token");

  if (!actualToken || !safeTokenEqual(actualToken, expectedToken)) {
    return NextResponse.json({ error: "Admin token is required" }, { status: 401 });
  }

  return null;
}
