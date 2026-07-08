import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json() as { caseId?: string };

  if (!body.caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  return NextResponse.json({
    error: "support_pack_requests_require_checkout",
    checkoutPath: `/support-pack?caseId=${encodeURIComponent(body.caseId)}`
  }, { status: 410 });
}
