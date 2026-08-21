import { NextResponse } from "next/server";
import {
  FREE_PLAN_MEMBER_LIMIT,
  getOrCreateFamilyId,
  resolveFamilyContext
} from "@/lib/family";

export const dynamic = "force-dynamic";

type MemberRow = {
  user_id: string | null;
  role: string | null;
  relationship: string | null;
  created_at: string | null;
};

type InviteRow = {
  invited_email: string | null;
  role: string | null;
  relationship: string | null;
  created_at: string | null;
  token: string | null;
};

export async function GET(request: Request) {
  const context = await resolveFamilyContext(request);
  if (context instanceof NextResponse) return context;

  let familyId: string;
  try {
    familyId = await getOrCreateFamilyId(context);
  } catch {
    return NextResponse.json(
      { error: "family_failed", message: "家族の情報を用意できませんでした。" },
      { status: 500 }
    );
  }

  const { data: family } = await context.service
    .from("families")
    .select("id, name, plan, owner_user_id")
    .eq("id", familyId)
    .single();

  const { data: memberRows } = await context.service
    .from("family_members")
    .select("user_id, role, relationship, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  const { data: inviteRows } = await context.service
    .from("family_invites")
    .select("invited_email, role, relationship, created_at, token")
    .eq("family_id", familyId)
    .eq("status", "pending")
    .gt("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("created_at", { ascending: true });

  const members = (memberRows ?? []) as MemberRow[];
  const invites = (inviteRows ?? []) as InviteRow[];
  const ownerUserId = family?.owner_user_id ?? null;
  const plan = family?.plan === "plus" ? "plus" : "free";

  const joinedOthers = members.filter((member) => member.user_id && member.user_id !== ownerUserId).length;
  const used = joinedOthers + invites.length;

  return NextResponse.json({
    plan,
    isOwner: ownerUserId === context.userId,
    limit: plan === "plus" ? null : FREE_PLAN_MEMBER_LIMIT,
    remaining: plan === "plus" ? null : Math.max(0, FREE_PLAN_MEMBER_LIMIT - used),
    members: members.map((member) => ({
      isYou: member.user_id === context.userId,
      isOwner: member.user_id === ownerUserId,
      role: member.role ?? "member",
      relationship: member.relationship ?? null,
      joinedAt: member.created_at
    })),
    pendingInvites: invites.map((invite) => ({
      invitedEmail: invite.invited_email,
      relationship: invite.relationship,
      role: invite.role ?? "member",
      createdAt: invite.created_at
    }))
  });
}
