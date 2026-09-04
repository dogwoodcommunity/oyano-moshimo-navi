import { NextResponse } from "next/server";
import { FREE_PLAN_MEMBER_LIMIT } from "@oyano/shared";
import { getServerSupabase, getUserSupabase } from "@/lib/serverSupabase";

// 数字の定義は packages/shared/src/plan.ts にある。SQLの create_family_invite も同じ値。
export { FREE_PLAN_MEMBER_LIMIT };

type ServiceClient = NonNullable<ReturnType<typeof getServerSupabase>>;
type UserClient = NonNullable<ReturnType<typeof getUserSupabase>>;

export type FamilyContext = {
  service: ServiceClient;
  user: UserClient;
  userId: string;
  email: string | null;
};

export type FamilySelectionErrorCode = "family_selection_required" | "family_access_denied" | "family_not_ready";

export class FamilySelectionError extends Error {
  code: FamilySelectionErrorCode;

  constructor(code: FamilySelectionErrorCode) {
    super(code);
    this.name = "FamilySelectionError";
    this.code = code;
  }
}

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
 * 手帳のクラウド控えと同じ family を使う。
 * 複数の手帳へ参加している場合は、呼び出し側が familyId を明示しない限り
 * 決して先頭の手帳を選ばない。別家族の招待や課金につながるためである。
 */
export async function resolveFamilyId(
  context: FamilyContext,
  requestedFamilyId?: string | null
): Promise<string> {
  const { data: memberships, error: membershipError } = await context.service
    .from("family_members")
    .select("family_id, created_at")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: true });

  if (membershipError) throw membershipError;

  const familyIds = Array.from(new Set(
    (memberships ?? [])
      .map((membership) => typeof membership.family_id === "string" ? membership.family_id : "")
      .filter(Boolean)
  ));
  const requested = requestedFamilyId?.trim() || null;

  if (requested) {
    if (!familyIds.includes(requested)) {
      throw new FamilySelectionError("family_access_denied");
    }
    return requested;
  }

  if (familyIds.length === 1) return familyIds[0];
  if (familyIds.length > 1) {
    throw new FamilySelectionError("family_selection_required");
  }
  // GET /api/family や決済確認を開いただけで空の家族を作ると、再読込や
  // 同時リクエストで複数familyが生まれる。作成は手帳の原子的sync RPCだけに限定する。
  throw new FamilySelectionError("family_not_ready");
}

export function familySelectionErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FamilySelectionError)) return null;

  if (error.code === "family_selection_required") {
    return NextResponse.json(
      {
        error: error.code,
        message: "複数の手帳があります。手帳画面で使う人を選んでから、もう一度開いてください。"
      },
      { status: 409 }
    );
  }

  if (error.code === "family_not_ready") {
    return NextResponse.json(
      {
        error: error.code,
        message: "先に手帳画面でクラウド保存を完了してください。保存した手帳を確認してから家族共有を開けます。"
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { error: error.code, message: "選んだ手帳に参加していません。手帳画面から選び直してください。" },
    { status: 403 }
  );
}

const rpcMessages: Record<string, string> = {
  not_authenticated: "本人確認が切れています。もう一度メール確認をしてください。",
  family_id_required: "操作する家族手帳を選び直してください。",
  member_id_required: "操作する家族を選び直してください。",
  invite_id_required: "取り消す招待を選び直してください。",
  invited_email_required: "招待するメールアドレスを入れてください。",
  invalid_invite_role: "招待の種類が正しくありません。",
  reserved_relationship: "この関係名は使えません。",
  not_a_family_member: "この手帳の家族に、まだ参加していません。",
  invite_requires_family_admin: "招待できるのは、手帳を作った人だけです。",
  admin_invite_requires_owner: "管理者として招待できるのは、手帳を作った人だけです。",
  family_not_found: "家族の情報が見つかりませんでした。",
  family_owner_missing: "手帳の所有者情報を確認できないため操作を止めました。サポートへご連絡ください。",
  free_plan_limit_reached: `現在、無料で一緒に見られるのは、あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人までです。追加の家族枠は受付準備中です。`,
  invite_invalid_or_expired: "この招待は使えなくなっています。招待した家族に、もう一度送ってもらってください。",
  invite_has_reserved_role: "この招待は使えません。もう一度送ってもらってください。",
  invite_email_mismatch: "招待されたメールアドレスと、いまログインしているアドレスが違います。招待メールが届いたアドレスで確認してください。",
  family_limit_reached: `この手帳の無料の枠（あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人）は埋まっています。追加の家族枠は現在準備中です。`,
  member_not_found: "選んだ家族は、この手帳に参加していません。画面を読み直してください。",
  member_not_joined: "招待中の人には所有権を移せません。参加後にもう一度お試しください。",
  invite_not_found: "選んだ招待は、この手帳にありません。画面を読み直してください。",
  invite_not_pending: "この招待はすでに参加済みか、取り消されています。",
  not_family_admin: "この操作は、手帳の所有者または管理者だけができます。",
  ownership_transfer_requires_current_owner: "所有権を移せるのは、現在の手帳の所有者だけです。",
  ownership_transfer_target_must_differ: "所有権は、あなた以外の参加済み家族を選んで移してください。",
  cannot_remove_family_owner: "手帳の所有者は削除できません。先に別の参加済み家族へ所有権を移してください。",
  remove_self_use_leave_family: "自分自身は「この家族手帳から抜ける」から操作してください。",
  member_has_notebook_photos: "この人が追加した写真が手帳に残っています。写真を残したまま外すと見られなくなるため、先に該当する写真を手帳から削除してください。",
  owner_must_transfer_before_leaving: "手帳の所有者はそのまま抜けられません。先に別の参加済み家族へ所有権を移してください。"
};

export function messageForRpcError(error: { message?: string } | null | undefined): string {
  const raw = error?.message ?? "";
  const matched = Object.keys(rpcMessages).find((key) => raw.includes(key));
  return matched ? rpcMessages[matched] : "処理できませんでした。時間をおいてもう一度お試しください。";
}

export function statusForFamilyManagementRpcError(
  error: { message?: string } | null | undefined
): number {
  const raw = error?.message ?? "";
  if (raw.includes("not_authenticated")) return 401;
  if (/(family_not_found|member_not_found|invite_not_found)/.test(raw)) return 404;
  if (/(not_a_family_member|not_family_admin|ownership_transfer_requires_current_owner)/.test(raw)) return 403;
  if (/(family_owner_missing|member_not_joined|invite_not_pending|ownership_transfer_target_must_differ|cannot_remove_family_owner|remove_self_use_leave_family|member_has_notebook_photos|owner_must_transfer_before_leaving)/.test(raw)) return 409;
  if (/(family_id_required|member_id_required|invite_id_required)/.test(raw)) return 400;
  return 500;
}

export function inviteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/invite/${encodeURIComponent(token)}`;
}
