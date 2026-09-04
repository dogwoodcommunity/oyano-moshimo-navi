import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { parseFamilyInviteRole } from "@/lib/familyInvitePermissions";
import {
  familySelectionErrorResponse,
  resolveFamilyId,
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

  let payload: { email?: unknown; relationship?: unknown; familyId?: unknown; role?: unknown };
  try {
    payload = await request.json() as { email?: unknown; relationship?: unknown; familyId?: unknown; role?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "内容を読み取れませんでした。" }, { status: 400 });
  }

  const email = (typeof payload.email === "string" ? payload.email : "").trim().toLowerCase();
  const relationship = (typeof payload.relationship === "string" ? payload.relationship : "").trim().slice(0, 40) || null;
  const role = parseFamilyInviteRole(payload.role);

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
  if (!role) {
    return NextResponse.json(
      {
        error: payload.role === undefined || payload.role === "" ? "invite_role_required" : "invalid_invite_role",
        message: "招待する人が「見るだけ」か「一緒に編集」かを選んでください。"
      },
      { status: 400 }
    );
  }

  let familyId: string;
  try {
    familyId = await resolveFamilyId(context, typeof payload.familyId === "string" ? payload.familyId : undefined);
  } catch (error) {
    const selectionError = familySelectionErrorResponse(error);
    if (selectionError) return selectionError;
    // 握りつぶすと本番で原因が追えない。今回それで診断が遅れた。
    console.error("[family] failed to prepare family", error);
    return NextResponse.json({ error: "family_failed", message: "家族の情報を用意できませんでした。" }, { status: 500 });
  }

  const { data, error } = await context.user.rpc("create_family_invite", {
    p_family_id: familyId,
    p_invited_email: email,
    p_role: role,
    p_relationship: relationship
  });

  if (error) {
    const status = error.message?.includes("free_plan_limit_reached") ? 402 : 400;
    return NextResponse.json({ error: "invite_failed", message: messageForRpcError(error) }, { status });
  }

  const invite = Array.isArray(data) ? data[0] : data;
  const token = invite?.token as string | undefined;
  const createdRole = parseFamilyInviteRole(invite?.role);

  if (!token || !createdRole) {
    return NextResponse.json(
      { error: "invite_failed", message: "招待リンクを作れませんでした。時間をおいてお試しください。" },
      { status: 500 }
    );
  }

  // 同じ宛先への有効な招待がすでにある場合、RPCは既存の招待を返す。
  // 希望した権限と違うリンクを誤送信しないよう、取消・再作成を促す。
  if (createdRole !== role) {
    return NextResponse.json(
      {
        error: "invite_role_conflict",
        message: "この人には別の権限の招待が残っています。招待中の一覧から取り消して、権限を選び直してください。"
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    invitedEmail: email,
    relationship,
    role: createdRole,
    url: inviteUrl(token),
    expiresInDays: 7
  });
}
