import { NextResponse } from "next/server";
import { verifyAccountDeleteOperatorRequest } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const auth = await verifyAccountDeleteOperatorRequest(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    authenticated: true,
    email: auth.admin.email ?? null,
    method: auth.admin.method,
    aal: auth.admin.aal
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
