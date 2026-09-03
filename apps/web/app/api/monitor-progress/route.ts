import { NextResponse } from "next/server";
import {
  isMonitorCampaignSubmissionOpen,
  MONITOR_CAMPAIGN_CLOSED_CODE,
  MONITOR_CAMPAIGN_CLOSED_MESSAGE,
  MONITOR_CAMPAIGN_ID
} from "@/lib/monitorCampaign";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 16_384;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DAY_MS = 24 * 60 * 60 * 1000;

type SanitizedUsageMetrics = {
  appOpenCount: number;
  appOpenDistinctDayCount: number;
  manualRecordSaveCount: number;
  manualRecordDistinctDayCount: number;
  lastManualRecordDayNumber: number | null;
  diaryHistoryOpened: boolean;
  checklistOpened: boolean;
  documentMemoSaved: boolean;
  familyInviteOpened: boolean;
  aiConsultCompleted: boolean;
  cloudBackupConfirmed: boolean;
};

type SanitizedProgress = {
  campaignId: string;
  sessionId: string;
  startedAt: string;
  reportDueAt: string;
  clientCapturedAt: string;
  dayNumber: number;
  usageMetrics: SanitizedUsageMetrics;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isoDate(value: unknown) {
  if (typeof value !== "string" || value.length > 40 || !ISO_DATE_PATTERN.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function integer(value: unknown, maximum: number) {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximum
    ? value
    : null;
}

function optionalMonitorDay(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Math.abs(value) > 365) return undefined;
  return Math.min(7, Math.max(1, value));
}

function usageMetrics(value: unknown): SanitizedUsageMetrics | null {
  const metrics = objectValue(value);
  if (!metrics) return null;

  const appOpenCount = integer(metrics.appOpenCount, 10_000);
  const appOpenDistinctDayCount = integer(metrics.appOpenDistinctDayCount, 7);
  const manualRecordSaveCount = integer(metrics.manualRecordSaveCount, 10_000);
  const manualRecordDistinctDayCount = integer(metrics.manualRecordDistinctDayCount, 7);
  const lastManualRecordDayNumber = optionalMonitorDay(metrics.lastManualRecordDayNumber);
  const booleans = [
    metrics.diaryHistoryOpened,
    metrics.checklistOpened,
    metrics.documentMemoSaved,
    metrics.familyInviteOpened,
    metrics.aiConsultCompleted,
    metrics.cloudBackupConfirmed
  ];

  if (
    appOpenCount === null
    || appOpenDistinctDayCount === null
    || manualRecordSaveCount === null
    || manualRecordDistinctDayCount === null
    || lastManualRecordDayNumber === undefined
    || appOpenDistinctDayCount > appOpenCount
    || manualRecordDistinctDayCount > manualRecordSaveCount
    || booleans.some((value) => typeof value !== "boolean")
  ) {
    return null;
  }

  return {
    appOpenCount,
    appOpenDistinctDayCount,
    manualRecordSaveCount,
    manualRecordDistinctDayCount,
    lastManualRecordDayNumber,
    diaryHistoryOpened: metrics.diaryHistoryOpened as boolean,
    checklistOpened: metrics.checklistOpened as boolean,
    documentMemoSaved: metrics.documentMemoSaved as boolean,
    familyInviteOpened: metrics.familyInviteOpened as boolean,
    aiConsultCompleted: metrics.aiConsultCompleted as boolean,
    cloudBackupConfirmed: metrics.cloudBackupConfirmed as boolean
  };
}

function mergeUsageMetrics(
  previous: SanitizedUsageMetrics | null,
  current: SanitizedUsageMetrics
): SanitizedUsageMetrics {
  if (!previous) return current;
  const previousLastDay = previous.lastManualRecordDayNumber ?? 0;
  const currentLastDay = current.lastManualRecordDayNumber ?? 0;

  return {
    appOpenCount: Math.max(previous.appOpenCount, current.appOpenCount),
    appOpenDistinctDayCount: Math.max(previous.appOpenDistinctDayCount, current.appOpenDistinctDayCount),
    manualRecordSaveCount: Math.max(previous.manualRecordSaveCount, current.manualRecordSaveCount),
    manualRecordDistinctDayCount: Math.max(previous.manualRecordDistinctDayCount, current.manualRecordDistinctDayCount),
    lastManualRecordDayNumber: Math.max(previousLastDay, currentLastDay) || null,
    diaryHistoryOpened: previous.diaryHistoryOpened || current.diaryHistoryOpened,
    checklistOpened: previous.checklistOpened || current.checklistOpened,
    documentMemoSaved: previous.documentMemoSaved || current.documentMemoSaved,
    familyInviteOpened: previous.familyInviteOpened || current.familyInviteOpened,
    aiConsultCompleted: previous.aiConsultCompleted || current.aiConsultCompleted,
    cloudBackupConfirmed: previous.cloudBackupConfirmed || current.cloudBackupConfirmed
  };
}

function progressPayload(value: unknown): SanitizedProgress | null {
  const body = objectValue(value);
  if (!body || body.version !== 1) return null;

  const campaignId = typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  const rawSessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const startedAt = isoDate(body.startedAt);
  const reportDueAt = isoDate(body.reportDueAt);
  const clientCapturedAt = isoDate(body.lastSeenAt);
  const dayNumber = integer(body.dayNumber, 7);
  const metrics = usageMetrics(body.usageMetrics);

  if (
    campaignId !== MONITOR_CAMPAIGN_ID
    || !UUID_PATTERN.test(rawSessionId)
    || !startedAt
    || !reportDueAt
    || !clientCapturedAt
    || dayNumber === null
    || dayNumber < 1
    || !metrics
    || (body.isReportDue !== undefined && typeof body.isReportDue !== "boolean")
  ) {
    return null;
  }

  const startedAtMs = Date.parse(startedAt);
  const reportDueAtMs = Date.parse(reportDueAt);
  const clientCapturedAtMs = Date.parse(clientCapturedAt);
  const now = Date.now();

  if (
    startedAtMs > now + DAY_MS
    || startedAtMs < now - 180 * DAY_MS
    || reportDueAtMs < startedAtMs + 5 * DAY_MS
    || reportDueAtMs > startedAtMs + 9 * DAY_MS
    || clientCapturedAtMs < startedAtMs
    || clientCapturedAtMs > now + DAY_MS
  ) {
    return null;
  }

  return {
    campaignId,
    sessionId: rawSessionId.toLowerCase(),
    startedAt,
    reportDueAt,
    clientCapturedAt,
    dayNumber,
    usageMetrics: metrics
  };
}

function failure(status: number) {
  return NextResponse.json({ ok: false }, { status });
}

/**
 * 7日間モニターの名前を含まない進捗だけを同期する。
 * 日記本文・名前・地域・写真など、許可していない入力は保存しない。
 */
export async function POST(request: Request) {
  if (!isMonitorCampaignSubmissionOpen()) {
    return NextResponse.json({
      code: MONITOR_CAMPAIGN_CLOSED_CODE,
      message: MONITOR_CAMPAIGN_CLOSED_MESSAGE
    }, { status: 410 });
  }

  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "monitor-progress",
    limit: 60,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_LENGTH) return failure(413);

  const rawBody = await request.text().catch(() => "");
  if (!rawBody || rawBody.length > MAX_BODY_LENGTH) return failure(rawBody.length > MAX_BODY_LENGTH ? 413 : 400);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return failure(400);
  }

  const progress = progressPayload(body);
  if (!progress) return failure(400);

  const source = objectValue(body);
  if (source?.validateOnly === true) {
    return NextResponse.json({ ok: true, stored: false, validated: true });
  }

  const supabase = getServerSupabase();
  if (!supabase) return failure(503);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: existing, error: findError } = await supabase
      .from("audit_logs")
      .select("id, action, target_type, metadata, created_at")
      .eq("id", progress.sessionId)
      .maybeSingle();

    if (findError) return failure(503);
    if (existing && (existing.action !== "monitor_progress_synced" || existing.target_type !== "monitor_test")) {
      return failure(409);
    }

    const now = new Date().toISOString();
    const previousMetadata = objectValue(existing?.metadata) ?? {};
    const existingStartedAt = isoDate(previousMetadata.startedAt);
    const existingReportDueAt = isoDate(previousMetadata.reportDueAt);
    const previousClientCapturedAt = isoDate(previousMetadata.clientCapturedAt);
    const previousDayNumber = integer(previousMetadata.dayNumber, 7);
    const previousMetrics = usageMetrics(previousMetadata.usageMetrics);
    const previousRevision = integer(previousMetadata.revision, 1_000_000_000);

    if (
      (existingStartedAt && existingStartedAt !== progress.startedAt)
      || (existingReportDueAt && existingReportDueAt !== progress.reportDueAt)
    ) {
      return failure(409);
    }

    const metadata = {
      version: 1,
      revision: (previousRevision ?? 0) + 1,
      campaignId: progress.campaignId,
      sessionId: progress.sessionId,
      firstSeenAt: isoDate(previousMetadata.firstSeenAt) ?? isoDate(existing?.created_at) ?? now,
      lastSeenAt: now,
      clientCapturedAt: previousClientCapturedAt && previousClientCapturedAt > progress.clientCapturedAt
        ? previousClientCapturedAt
        : progress.clientCapturedAt,
      startedAt: existingStartedAt ?? progress.startedAt,
      reportDueAt: existingReportDueAt ?? progress.reportDueAt,
      dayNumber: Math.max(previousDayNumber ?? 1, progress.dayNumber),
      isReportDue: Date.now() >= Date.parse(existingReportDueAt ?? progress.reportDueAt),
      usageMetrics: mergeUsageMetrics(previousMetrics, progress.usageMetrics)
    };

    if (!existing) {
      const { error: insertError } = await supabase.from("audit_logs").insert({
        id: progress.sessionId,
        action: "monitor_progress_synced",
        target_type: "monitor_test",
        target_id: progress.sessionId,
        metadata
      });
      if (!insertError) return NextResponse.json({ ok: true });
      if (insertError.code === "23505") continue;
      return failure(503);
    }

    let updateQuery = supabase
      .from("audit_logs")
      .update({ metadata })
      .eq("id", existing.id)
      .eq("action", "monitor_progress_synced")
      .eq("target_type", "monitor_test");
    updateQuery = previousRevision === null
      ? updateQuery.is("metadata->>revision", null)
      : updateQuery.eq("metadata->>revision", String(previousRevision));
    const { data: updated, error: updateError } = await updateQuery.select("id");
    if (updateError) return failure(503);
    if ((updated?.length ?? 0) === 1) return NextResponse.json({ ok: true });
  }

  return failure(503);
}
