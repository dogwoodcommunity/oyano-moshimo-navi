import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import {
  getOrCreateFamilyId,
  inviteUrl,
  messageForRpcError,
  resolveFamilyContext
} from "@/lib/family";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "family-invite",
    limit: 20,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const context = await resolveFamilyContext(request);
  if (context instanceof NextResponse) return context;

  let payload: { email?: string; relationship?: string };
  try {
    payload = await request.json() as { email?: string; relationship?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "内容を読み取れませんでした。" }, { status: 400 });
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  const relationship = (payload.relationship ?? "").trim().slice(0, 40) || null;

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "invalid_email", message: "メールアドレスの形を確認してください。" },
      { status: 400 }
    );
  }
  if (context.email && email === context.email.toLowerCase()) {
    return NextResponse.json(
      { error: "self_invite", message: "自分あてには招待できません。" },
      { status: 400 }
    );
  }

  let familyId: string;
  try {
    familyId = await getOrCreateFamilyId(context);
  } catch {
    return NextResponse.json({ error: "family_failed", message: "家族の情報を用意できませんでした。" }, { status: 500 });
  }

  const { data, error } = await context.user.rpc("create_family_invite", {
    p_family_id: familyId,
    p_invited_email: email,
    p_role: "member",
    p_relationship: relationship
  });

  if (error) {
    const status = error.message?.includes("free_plan_limit_reached") ? 402 : 400;
    return NextResponse.json({ error: "invite_failed", message: messageForRpcError(error) }, { status });
  }

  const invite = Array.isArray(data) ? data[0] : data;
  const token = invite?.token as string | undefined;

  if (!token) {
    return NextResponse.json(
      { error: "invite_failed", message: "招待リンクを作れませんでした。時間をおいてお試しください。" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    invitedEmail: email,
    relationship,
    url: inviteUrl(token),
    expiresInDays: 7
  });
}
