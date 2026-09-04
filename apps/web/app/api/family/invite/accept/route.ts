import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { messageForRpcError, resolveFamilyContext } from "@/lib/family";
import {
  isWellFormedFamilyInviteToken,
  parseFamilyInviteRole,
  parseFamilyMemberRole
} from "@/lib/familyInvitePermissions";

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

  let payload: { token?: unknown };
  try {
    payload = await request.json() as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "内容を読み取れませんでした。" }, { status: 400 });
  }

  const token = (typeof payload.token === "string" ? payload.token : "").trim();
  if (!isWellFormedFamilyInviteToken(token)) {
    return NextResponse.json({ error: "invalid_request", message: "招待リンクが正しくありません。" }, { status: 400 });
  }

  // 参加前の表示と同じ有効条件で、受け入れてよいロールだけに限定する。
  // メールアドレスの一致は引き続きaccept_family_invite内で確認する。
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingInvite, error: previewError } = await context.service
    .from("family_invites")
    .select("role")
    .eq("token", token)
    .eq("status", "pending")
    .gt("created_at", sevenDaysAgo)
    .maybeSingle();
  const pendingRole = parseFamilyInviteRole(pendingInvite?.role);

  if (previewError) {
    console.error("[family-invite-accept] failed to verify invite role", { code: previewError.code });
    return NextResponse.json(
      { error: "invite_check_failed", message: "いまは招待の内容を確認できません。時間をおいてお試しください。" },
      { status: 503 }
    );
  }
  if (!pendingRole) {
    return NextResponse.json(
      { error: "accept_failed", message: "この招待は使えなくなっています。招待した家族に、もう一度送ってもらってください。" },
      { status: 400 }
    );
  }

  const { data, error } = await context.user.rpc("accept_family_invite", { p_token: token });

  if (error) {
    const status = error.message?.includes("family_limit_reached") ? 402 : 400;
    return NextResponse.json({ error: "accept_failed", message: messageForRpcError(error) }, { status });
  }

  const member = Array.isArray(data) ? data[0] : data;
  const persistedRole = parseFamilyMemberRole(member?.role);
  if (!persistedRole) {
    console.error("[family-invite-accept] RPC returned an invalid member role");
    return NextResponse.json(
      { error: "accept_failed", message: "参加後の権限を確認できませんでした。画面を読み直してください。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, role: persistedRole });
}
