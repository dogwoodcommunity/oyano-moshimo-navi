import { NextResponse } from "next/server";
import {
  familySelectionErrorResponse,
  messageForRpcError,
  resolveFamilyId,
  resolveFamilyContext,
  statusForFamilyManagementRpcError
} from "@/lib/family";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await resolveFamilyContext(request);
  if (context instanceof NextResponse) return context;

  let familyId: string;
  try {
    const requestedFamilyId = new URL(request.url).searchParams.get("familyId");
    familyId = await resolveFamilyId(context, requestedFamilyId);
  } catch (error) {
    const selectionError = familySelectionErrorResponse(error);
    if (selectionError) return selectionError;
    // 握りつぶすと本番で原因が追えない。今回それで診断が遅れた。
    console.error("[family] failed to prepare family", error);
    return NextResponse.json(
      { error: "family_failed", message: "家族の情報を用意できませんでした。" },
      { status: 500 }
    );
  }

  const { data, error } = await context.user.rpc("get_family_management_summary", {
    p_family_id: familyId
  });

  if (error) {
    return NextResponse.json(
      { error: "family_summary_failed", message: messageForRpcError(error) },
      { status: statusForFamilyManagementRpcError(error) }
    );
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json(
      { error: "family_summary_failed", message: "家族の情報を読み込めませんでした。" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
