import { NextResponse } from "next/server";
import { getServerSupabase, getUserSupabase } from "@/lib/serverSupabase";

/** 無料プランで、オーナー以外に受け入れられる人数。SQL側の create_family_invite と同じ値。 */
export const FREE_PLAN_MEMBER_LIMIT = 2;

type ServiceClient = NonNullable<ReturnType<typeof getServerSupabase>>;
type UserClient = NonNullable<ReturnType<typeof getUserSupabase>>;

export type FamilyContext = {
  service: ServiceClient;
  user: UserClient;
  userId: string;
  email: string | null;
};

export function unauthorized() {
  return NextResponse.json(
    { error: "not_authenticated", message: "本人確認が切れています。手帳の画面からメール確認をやり直してください。" },
    { status: 401 }
  );
}

export function cloudUnavailable() {
  return NextResponse.json(
    { error: "cloud_unavailable", message: "いまは家族共有を使えません。" },
    { status: 503 }
  );
}

export async function resolveFamilyContext(request: Request): Promise<FamilyContext | NextResponse> {
  const service = getServerSupabase();
  if (!service) return cloudUnavailable();

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return unauthorized();

  const { data, error } = await service.auth.getUser(token);
  if (error || !data?.user) return unauthorized();

  const user = getUserSupabase(token);
  if (!user) return cloudUnavailable();

  return { service, user, userId: data.user.id, email: data.user.email ?? null };
}

/**
 * 手帳のクラウド控えと同じ考え方で、その人の家族を1つに決める。
 * まだ無い場合は作る。
 */
export async function getOrCreateFamilyId(context: FamilyContext): Promise<string> {
  const { data: memberships } = await context.service
    .from("family_members")
    .select("family_id")
    .eq("user_id", context.userId)
    .limit(1);

  const existing = Array.isArray(memberships) ? memberships[0]?.family_id : undefined;
  if (existing) return existing as string;

  const familyName = context.email ? `${context.email.split("@")[0]}さんの家族` : "親のもしもナビの家族";
  const { data: family, error } = await context.service
    .from("families")
    .insert({ name: familyName, owner_user_id: context.userId, plan: "free" })
    .select("id")
    .single();

  if (error || !family) throw error ?? new Error("family_create_failed");

  await context.service
    .from("family_members")
    .insert({ family_id: family.id, user_id: context.userId, role: "owner", relationship: "本人" });

  return family.id as string;
}

const rpcMessages: Record<string, string> = {
  not_authenticated: "本人確認が切れています。もう一度メール確認をしてください。",
  invited_email_required: "招待するメールアドレスを入れてください。",
  invalid_invite_role: "招待の種類が正しくありません。",
  reserved_relationship: "この関係名は使えません。",
  not_a_family_member: "この手帳の家族に、まだ参加していません。",
  invite_requires_family_admin: "招待できるのは、手帳を作った人だけです。",
  admin_invite_requires_owner: "管理者として招待できるのは、手帳を作った人だけです。",
  family_not_found: "家族の情報が見つかりませんでした。",
  free_plan_limit_reached: `無料で共有できるのは、あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人までです。3人目以降はPlusで広げられます。`,
  invite_invalid_or_expired: "この招待は使えなくなっています。招待した家族に、もう一度送ってもらってください。",
  invite_has_reserved_role: "この招待は使えません。もう一度送ってもらってください。",
  invite_email_mismatch: "招待されたメールアドレスと、いまログインしているアドレスが違います。招待メールが届いたアドレスで確認してください。",
  family_limit_reached: `この手帳は、無料で共有できる${FREE_PLAN_MEMBER_LIMIT}人分が埋まっています。招待した家族にPlusを検討してもらってください。`
};

export function messageForRpcError(error: { message?: string } | null | undefined): string {
  const raw = error?.message ?? "";
  const matched = Object.keys(rpcMessages).find((key) => raw.includes(key));
  return matched ? rpcMessages[matched] : "処理できませんでした。時間をおいてもう一度お試しください。";
}

export function inviteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/invite/${encodeURIComponent(token)}`;
}
