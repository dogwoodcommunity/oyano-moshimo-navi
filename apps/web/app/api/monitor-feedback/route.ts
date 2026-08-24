import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

const REQUIRED_TEXT_FIELDS = [
  "monitorCode",
  "ageGroup",
  "careRelation",
  "careSituation",
  "device",
  "usagePeriod",
  "recordCount",
  "checklistTried",
  "documentMemoTried",
  "familyInviteTried",
  "savedRecord",
  "aiConsult",
  "returnIntent",
  "familyShare",
  "paymentIntent"
] as const;

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "monitor-feedback",
    limit: 5,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "回答を読み込めませんでした。" }, { status: 400 });

  const metadata: Record<string, unknown> = {
    monitorCode: safeText(body.monitorCode, 40),
    ageGroup: safeText(body.ageGroup, 20),
    careRelation: safeText(body.careRelation, 40),
    careSituation: safeText(body.careSituation, 80),
    device: safeText(body.device, 30),
    usagePeriod: safeText(body.usagePeriod, 30),
    recordCount: safeText(body.recordCount, 30),
    checklistTried: safeText(body.checklistTried, 80),
    documentMemoTried: safeText(body.documentMemoTried, 80),
    familyInviteTried: safeText(body.familyInviteTried, 80),
    stoppedAt: Array.isArray(body.stoppedAt)
      ? body.stoppedAt.filter((value): value is string => typeof value === "string").slice(0, 12).map((value) => value.slice(0, 80))
      : [],
    savedRecord: safeText(body.savedRecord, 80),
    aiConsult: safeText(body.aiConsult, 80),
    returnIntent: safeText(body.returnIntent, 80),
    familyShare: safeText(body.familyShare, 80),
    paymentIntent: safeText(body.paymentIntent, 80),
    confusingPoint: safeText(body.confusingPoint, 1000),
    usefulPoint: safeText(body.usefulPoint, 1000),
    missingPoint: safeText(body.missingPoint, 1000),
    screenshotPaths: Array.isArray(body.screenshotPaths)
      ? body.screenshotPaths
          .filter((value): value is string => typeof value === "string" && value.startsWith("monitor-feedback/"))
          .slice(0, 3)
          .map((value) => value.slice(0, 300))
      : [],
    formVersion: "2026-08-24-7day"
  };

  if (REQUIRED_TEXT_FIELDS.some((field) => !metadata[field])) {
    return NextResponse.json({ message: "必須項目を確認してください。" }, { status: 400 });
  }
  if (!Array.isArray(metadata.screenshotPaths) || metadata.screenshotPaths.length !== 3) {
    return NextResponse.json({ message: "スクリーンショットを3枚添付してください。" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ message: "現在、回答を保存できません。時間をおいて再度お試しください。" }, { status: 503 });

  const { error } = await supabase.from("audit_logs").insert({
    action: "monitor_feedback_submitted",
    target_type: "monitor_test",
    metadata
  });

  if (error) {
    return NextResponse.json({ message: "回答を保存できませんでした。時間をおいて再度お試しください。" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
