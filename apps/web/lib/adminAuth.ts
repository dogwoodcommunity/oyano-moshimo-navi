import { NextResponse } from "next/server";

export function verifyAdminRequest(request: Request) {
  const expectedToken = process.env.ADMIN_ACCESS_TOKEN;
  if (!expectedToken) return null;

  const headerToken = request.headers.get("x-admin-token");
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("adminToken");
  const actualToken = headerToken ?? queryToken;

  if (actualToken !== expectedToken) {
    return NextResponse.json({ error: "Admin token is required" }, { status: 401 });
  }

  return null;
}
