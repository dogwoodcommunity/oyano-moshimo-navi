import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

const REQUIRED_TEXT_FIELDS = [
  "crowdworksName",
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
  "firstStoppedAt",
  "returnIntent",
  "familyShare",
  "willingnessToPay",
  "priceReaction"
] as const;

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function participantKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
}

function allowedParticipantKeys() {
  const raw = process.env.MONITOR_ALLOWED_CROWDWORKS_NAMES?.trim();
  if (!raw) return null;
  return new Set(raw.split(",").map((value) => participantKey(value.trim())).filter(Boolean));
}

function safeIsoDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function safeNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeOptionalInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function safeUsageMetrics(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const metrics = value as Record<string, unknown>;
  if (metrics.version !== 1 || !safeIsoDate(metrics.capturedAt) || !safeIsoDate(metrics.monitorStartedAt)) return null;

  return {
    version: 1,
    capturedAt: safeIsoDate(metrics.capturedAt),
    monitorStartedAt: safeIsoDate(metrics.monitorStartedAt),
    reportDueAt: safeIsoDate(metrics.reportDueAt),
    notebookCreatedAt: safeIsoDate(metrics.notebookCreatedAt),
    registrationDurationSeconds: safeOptionalInteger(metrics.registrationDurationSeconds),
    appOpenCount: safeNonNegativeInteger(metrics.appOpenCount),
    appOpenDistinctDayCount: safeNonNegativeInteger(metrics.appOpenDistinctDayCount),
    storedDiaryEntryCount: safeNonNegativeInteger(metrics.storedDiaryEntryCount),
    storedDiaryDistinctDateCount: safeNonNegativeInteger(metrics.storedDiaryDistinctDateCount),
    manualRecordSaveCount: safeNonNegativeInteger(metrics.manualRecordSaveCount),
    manualRecordDistinctDayCount: safeNonNegativeInteger(metrics.manualRecordDistinctDayCount),
    lastManualRecordDayNumber: safeOptionalInteger(metrics.lastManualRecordDayNumber),
    taskUpdateCount: safeNonNegativeInteger(metrics.taskUpdateCount),
    diaryHistoryOpened: metrics.diaryHistoryOpened === true,
    checklistOpened: metrics.checklistOpened === true,
    documentMemoSaved: metrics.documentMemoSaved === true,
    familyInviteOpened: metrics.familyInviteOpened === true,
    aiConsultCompleted: metrics.aiConsultCompleted === true,
    cloudBackupConfirmed: metrics.cloudBackupConfirmed === true
  };
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

  const crowdworksName = safeText(body.crowdworksName ?? body.monitorCode, 40);
  const crowdworksNameKey = participantKey(crowdworksName);
  const allowedKeys = allowedParticipantKeys();
  if (!allowedKeys) {
    return NextResponse.json({ message: "モニター回答の受付準備中です。運営へご連絡ください。" }, { status: 503 });
  }
  if (!allowedKeys.has(crowdworksNameKey)) {
    return NextResponse.json({ message: "クラウドワークスで使っている名前を確認してください。" }, { status: 400 });
  }
  if (body.validateOnly === true) {
    return NextResponse.json({ ok: true });
  }

  const metadata: Record<string, unknown> = {
    // `monitorCode` is accepted for already-open pages from the previous form version.
    crowdworksName,
    crowdworksNameKey,
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
    firstStoppedAt: safeText(body.firstStoppedAt, 80),
    returnIntent: safeText(body.returnIntent, 80),
    familyShare: safeText(body.familyShare, 80),
    willingnessToPay: safeText(body.willingnessToPay, 80),
    priceReaction: safeText(body.priceReaction, 80),
    confusingPoint: safeText(body.confusingPoint, 1000),
    usefulPoint: safeText(body.usefulPoint, 1000),
    missingPoint: safeText(body.missingPoint, 1000),
    screenshotPaths: Array.isArray(body.screenshotPaths)
      ? body.screenshotPaths
          .filter((value): value is string => typeof value === "string" && value.startsWith("monitor-feedback/"))
          .slice(0, 3)
          .map((value) => value.slice(0, 300))
      : [],
    usageMetrics: safeUsageMetrics(body.usageMetrics),
    submittedAt: new Date().toISOString(),
    formVersion: "2026-08-25-monitor-review-v2"
  };

  if (REQUIRED_TEXT_FIELDS.some((field) => !metadata[field])) {
    return NextResponse.json({ message: "必須項目を確認してください。" }, { status: 400 });
  }
  if (!metadata.usageMetrics) {
    return NextResponse.json({ message: "利用状況を確認できませんでした。画面を更新してもう一度お試しください。" }, { status: 400 });
  }
  if (!Array.isArray(metadata.screenshotPaths) || metadata.screenshotPaths.length < 1 || metadata.screenshotPaths.length > 3) {
    return NextResponse.json({ message: "スクリーンショットを1〜3枚添付してください。" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development" && process.env.MONITOR_E2E_MODE === "1") {
    return NextResponse.json({ ok: true, replacedPreviousResponse: false, simulated: true });
  }

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ message: "現在、回答を保存できません。時間をおいて再度お試しください。" }, { status: 503 });

  const { data: existing, error: findError } = await supabase
    .from("audit_logs")
    .select("id, metadata")
    .eq("action", "monitor_feedback_submitted")
    .contains("metadata", { crowdworksNameKey })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ message: "回答を確認できませんでした。時間をおいて再度お試しください。" }, { status: 503 });
  }

  const previousMetadata = (existing?.metadata ?? {}) as Record<string, unknown>;
  metadata.firstSubmittedAt = safeIsoDate(previousMetadata.firstSubmittedAt)
    ?? safeIsoDate(previousMetadata.submittedAt)
    ?? metadata.submittedAt;
  metadata.resubmissionCount = existing
    ? safeNonNegativeInteger(previousMetadata.resubmissionCount) + 1
    : 0;

  const { error } = existing
    ? await supabase.from("audit_logs").update({ metadata }).eq("id", existing.id)
    : await supabase.from("audit_logs").insert({
        action: "monitor_feedback_submitted",
        target_type: "monitor_test",
        metadata
      });

  if (error) {
    return NextResponse.json({ message: "回答を保存できませんでした。時間をおいて再度お試しください。" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, replacedPreviousResponse: Boolean(existing) });
}
