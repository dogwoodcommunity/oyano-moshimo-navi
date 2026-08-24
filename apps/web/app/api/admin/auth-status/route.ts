import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    authenticated: true,
    email: auth.admin.email ?? null,
    method: auth.admin.method
  });
}
