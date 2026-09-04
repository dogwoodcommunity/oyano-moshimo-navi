import { NextResponse } from "next/server";
import {
  familySelectionErrorResponse,
  messageForRpcError,
  resolveFamilyContext,
  resolveFamilyId,
  statusForFamilyManagementRpcError
} from "@/lib/family";

export const dynamic = "force-dynamic";

type FamilyManagementAction = "transfer-ownership" | "remove-member" | "leave-family" | "cancel-invite";

type ManagementPayload = {
  action?: unknown;
  familyId?: unknown;
  memberId?: unknown;
  inviteId?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set<FamilyManagementAction>([
  "transfer-ownership",
  "remove-member",
  "leave-family",
  "cancel-invite"
]);

function uuidFrom(payload: ManagementPayload, key: "familyId" | "memberId" | "inviteId") {
  const value = payload[key];
  return typeof value === "string" && uuidPattern.test(value.trim()) ? value.trim() : null;
}

export async function POST(request: Request) {
  const context = await resolveFamilyContext(request);
  if (context instanceof NextResponse) return context;

  let payload: ManagementPayload;
  try {
    const parsed = await request.json() as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("family_management_payload_must_be_an_object");
    }
    payload = parsed as ManagementPayload;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "内容を読み取れませんでした。" },
      { status: 400 }
    );
  }

  const action = typeof payload.action === "string" && actions.has(payload.action as FamilyManagementAction)
    ? payload.action as FamilyManagementAction
    : null;
  const familyId = uuidFrom(payload, "familyId");

  if (!action || !familyId) {
    return NextResponse.json(
      { error: "invalid_request", message: "操作する家族手帳を選び直してください。" },
      { status: 400 }
    );
  }

  try {
    // This is intentionally the body familyId, not a first-membership fallback.
    // The RPC repeats the same membership check under the family row lock.
    await resolveFamilyId(context, familyId);
  } catch (error) {
    const selectionError = familySelectionErrorResponse(error);
    if (selectionError) return selectionError;
    console.error("[family] failed to verify management target", error);
    return NextResponse.json(
      { error: "family_failed", message: "家族の情報を確認できませんでした。" },
      { status: 500 }
    );
  }

  let result: { data: unknown; error: { message?: string } | null };
  if (action === "leave-family") {
    result = await context.user.rpc("leave_family", { p_family_id: familyId });
  } else if (action === "cancel-invite") {
    const inviteId = uuidFrom(payload, "inviteId");
    if (!inviteId) {
      return NextResponse.json(
        { error: "invalid_request", message: "取り消す招待を選び直してください。" },
        { status: 400 }
      );
    }
    result = await context.user.rpc("cancel_family_invite", {
      p_family_id: familyId,
      p_invite_id: inviteId
    });
  } else {
    const memberId = uuidFrom(payload, "memberId");
    if (!memberId) {
      return NextResponse.json(
        { error: "invalid_request", message: "操作する家族を選び直してください。" },
        { status: 400 }
      );
    }
    result = action === "transfer-ownership"
      ? await context.user.rpc("transfer_family_ownership", {
          p_family_id: familyId,
          p_target_member_id: memberId
        })
      : await context.user.rpc("remove_family_member", {
          p_family_id: familyId,
          p_member_id: memberId
        });
  }

  if (result.error) {
    return NextResponse.json(
      { error: "family_management_failed", message: messageForRpcError(result.error) },
      { status: statusForFamilyManagementRpcError(result.error) }
    );
  }

  return NextResponse.json({ ok: true, action, result: result.data });
}
