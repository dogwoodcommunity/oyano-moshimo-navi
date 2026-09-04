import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import {
  isWellFormedFamilyInviteToken,
  parseFamilyInviteRole
} from "@/lib/familyInvitePermissions";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

const unavailableResponse = () => NextResponse.json(
  {
    error: "invite_unavailable",
    message: "この招待は使えなくなっています。招待した家族に、もう一度送ってもらってください。"
  },
  { status: 404, headers: { "Cache-Control": "no-store" } }
);

export async function GET(request: Request) {
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "family-invite-preview",
    limit: 60,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!isWellFormedFamilyInviteToken(token)) return unavailableResponse();

  const service = getServerSupabase();
  if (!service) {
    return NextResponse.json(
      { error: "cloud_unavailable", message: "いまは招待の内容を確認できません。時間をおいてお試しください。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 招待を持つ人へ参加前に必要な権限だけを返す。招待先メール、family_id、
  // tokenそのものはselectもresponseもしない。
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("family_invites")
    .select("role")
    .eq("token", token)
    .eq("status", "pending")
    .gt("created_at", sevenDaysAgo)
    .maybeSingle();

  if (error) {
    console.error("[family-invite-preview] failed to read invite role", { code: error.code });
    return NextResponse.json(
      { error: "invite_check_failed", message: "いまは招待の内容を確認できません。時間をおいてお試しください。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const role = parseFamilyInviteRole(data?.role);
  if (!role) return unavailableResponse();

  return NextResponse.json(
    { role },
    { headers: { "Cache-Control": "no-store" } }
  );
}
