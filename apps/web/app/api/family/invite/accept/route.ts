import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { messageForRpcError, resolveFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "family-invite-accept",
    limit: 20,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const context = await resolveFamilyContext(request);
  if (context instanceof NextResponse) return context;

  let payload: { token?: string };
  try {
    payload = await request.json() as { token?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "内容を読み取れませんでした。" }, { status: 400 });
  }

  const token = (payload.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "invalid_request", message: "招待リンクが正しくありません。" }, { status: 400 });
  }

  const { data, error } = await context.user.rpc("accept_family_invite", { p_token: token });

  if (error) {
    const status = error.message?.includes("family_limit_reached") ? 402 : 400;
    return NextResponse.json({ error: "accept_failed", message: messageForRpcError(error) }, { status });
  }

  const member = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, role: member?.role ?? "member" });
}
