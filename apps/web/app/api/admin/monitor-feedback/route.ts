import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { MONITOR_CAMPAIGN_ID } from "@/lib/monitorCampaign";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  action: string;
  target_id: string | null;
  target_type?: string | null;
  metadata: unknown;
  created_at: string;
};

type FinalResponseMatch = {
  id: string;
  crowdworksName: string;
  submittedAt: string;
  sessionId: string | null;
  startedAt: string | null;
};

function record(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isoDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function text(value: unknown, maximum = 80) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function optionalInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

function sanitizedUsageMetrics(value: unknown) {
  const metrics = record(value);
  return {
    capturedAt: isoDate(metrics.capturedAt),
    monitorStartedAt: isoDate(metrics.monitorStartedAt),
    reportDueAt: isoDate(metrics.reportDueAt),
    notebookCreatedAt: isoDate(metrics.notebookCreatedAt),
    registrationDurationSeconds: optionalInteger(metrics.registrationDurationSeconds),
    appOpenCount: nonNegativeInteger(metrics.appOpenCount),
    appOpenDistinctDayCount: nonNegativeInteger(metrics.appOpenDistinctDayCount),
    storedDiaryEntryCount: nonNegativeInteger(metrics.storedDiaryEntryCount),
    storedDiaryDistinctDateCount: nonNegativeInteger(metrics.storedDiaryDistinctDateCount),
    manualRecordSaveCount: nonNegativeInteger(metrics.manualRecordSaveCount),
    manualRecordDistinctDayCount: nonNegativeInteger(metrics.manualRecordDistinctDayCount),
    lastManualRecordDayNumber: optionalInteger(metrics.lastManualRecordDayNumber),
    taskUpdateCount: nonNegativeInteger(metrics.taskUpdateCount),
    diaryHistoryOpened: metrics.diaryHistoryOpened === true,
    checklistOpened: metrics.checklistOpened === true,
    documentMemoSaved: metrics.documentMemoSaved === true,
    familyInviteOpened: metrics.familyInviteOpened === true,
    aiConsultCompleted: metrics.aiConsultCompleted === true,
    cloudBackupConfirmed: metrics.cloudBackupConfirmed === true
  };
}

function responseMatch(row: AuditRow): FinalResponseMatch {
  const metadata = record(row.metadata);
  const metrics = sanitizedUsageMetrics(metadata.usageMetrics);
  const sessionId = text(metadata.monitorSessionId, 80) || null;
  return {
    id: row.id,
    crowdworksName: text(metadata.crowdworksName, 40) || text(metadata.monitorCode, 40) || "名前未取得",
    submittedAt: isoDate(metadata.submittedAt) ?? isoDate(row.created_at) ?? new Date(0).toISOString(),
    sessionId,
    startedAt: metrics.monitorStartedAt
  };
}

function matchedResponse(
  targetId: string | null,
  startedAt: string | null,
  finalBySessionId: Map<string, FinalResponseMatch>,
  finalByStartedAt: Map<string, FinalResponseMatch>
) {
  return (targetId ? finalBySessionId.get(targetId) : null)
    ?? (startedAt ? finalByStartedAt.get(startedAt) : null)
    ?? null;
}

function sanitizedProgress(
  row: AuditRow,
  finalBySessionId: Map<string, FinalResponseMatch>,
  finalByStartedAt: Map<string, FinalResponseMatch>
) {
  const metadata = record(row.metadata);
  const metrics = sanitizedUsageMetrics(metadata.usageMetrics);
  const startedAt = isoDate(metadata.startedAt) ?? metrics.monitorStartedAt;
  const lastSeenAt = isoDate(metadata.lastSeenAt) ?? metrics.capturedAt ?? isoDate(row.created_at);
  const reportDueAt = isoDate(metadata.reportDueAt) ?? metrics.reportDueAt;
  const rawDayNumber = optionalInteger(metadata.dayNumber);
  const finalResponse = matchedResponse(row.target_id, startedAt, finalBySessionId, finalByStartedAt);

  return {
    id: row.id,
    source: "progress" as const,
    startedAt,
    firstSeenAt: isoDate(metadata.firstSeenAt) ?? isoDate(row.created_at),
    lastSeenAt,
    reportDueAt,
    reportSubmittedAt: finalResponse?.submittedAt ?? null,
    dayNumber: rawDayNumber === null ? null : Math.min(7, Math.max(1, rawDayNumber)),
    isReportDue: Boolean(reportDueAt && Date.now() >= Date.parse(reportDueAt)),
    finalResponseSubmitted: Boolean(finalResponse),
    finalResponseId: finalResponse?.id ?? null,
    finalResponseName: finalResponse?.crowdworksName ?? null,
    usageMetrics: metrics
  };
}

function progressFromFinalResponse(row: AuditRow, finalResponse: FinalResponseMatch) {
  const metadata = record(row.metadata);
  const metrics = sanitizedUsageMetrics(metadata.usageMetrics);
  const reportDueAt = metrics.reportDueAt;
  return {
    id: `response-${row.id}`,
    source: "final-response" as const,
    startedAt: metrics.monitorStartedAt,
    firstSeenAt: isoDate(row.created_at),
    lastSeenAt: finalResponse.submittedAt,
    reportDueAt,
    reportSubmittedAt: finalResponse.submittedAt,
    dayNumber: 7,
    isReportDue: Boolean(reportDueAt && Date.now() >= Date.parse(reportDueAt)),
    finalResponseSubmitted: true,
    finalResponseId: finalResponse.id,
    finalResponseName: finalResponse.crowdworksName,
    usageMetrics: metrics
  };
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ message: "Supabaseが設定されていません。" }, { status: 503 });

  const progressOnly = new URL(request.url).searchParams.get("progressOnly") === "1";
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, target_id, target_type, metadata, created_at")
    .in("action", ["monitor_feedback_submitted", "monitor_progress_synced"])
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ message: error.message }, { status: 503 });

  const auditRows = (data ?? []) as AuditRow[];
  const feedbackRows = auditRows.filter((row) => row.action === "monitor_feedback_submitted");
  const baseResponses = feedbackRows.map((row) => ({
    id: row.id,
    metadata: record(row.metadata),
    created_at: row.created_at,
    screenshotUrls: [] as string[]
  }));
  const matches = feedbackRows.map(responseMatch);
  const finalBySessionId = new Map<string, FinalResponseMatch>();
  const finalByStartedAt = new Map<string, FinalResponseMatch>();
  matches.forEach((match) => {
    if (match.sessionId && !finalBySessionId.has(match.sessionId)) finalBySessionId.set(match.sessionId, match);
    if (match.startedAt && !finalByStartedAt.has(match.startedAt)) finalByStartedAt.set(match.startedAt, match);
  });

  const latestProgressBySession = new Map<string, AuditRow>();
  auditRows.forEach((row) => {
    const metadata = record(row.metadata);
    if (
      row.action !== "monitor_progress_synced"
      || row.target_type !== "monitor_test"
      || metadata.campaignId !== MONITOR_CAMPAIGN_ID
      || !row.target_id
      || latestProgressBySession.has(row.target_id)
    ) return;
    latestProgressBySession.set(row.target_id, row);
  });

  const progress: Array<ReturnType<typeof sanitizedProgress> | ReturnType<typeof progressFromFinalResponse>> = Array.from(latestProgressBySession.values())
    .map((row) => sanitizedProgress(row, finalBySessionId, finalByStartedAt));
  const matchedFinalResponseIds = new Set(progress.flatMap((row) => row.finalResponseId ? [row.finalResponseId] : []));
  feedbackRows.forEach((row, index) => {
    if (!matchedFinalResponseIds.has(row.id)) progress.push(progressFromFinalResponse(row, matches[index]));
  });
  progress.sort((left, right) => Date.parse(right.lastSeenAt ?? "") - Date.parse(left.lastSeenAt ?? ""));

  if (progressOnly) {
    return NextResponse.json(
      { progress },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const responses = await Promise.all(baseResponses.map(async (row) => {
    const paths = Array.isArray(row.metadata.screenshotPaths)
      ? row.metadata.screenshotPaths.filter((value): value is string => typeof value === "string" && value.startsWith("monitor-feedback/"))
      : [];
    const screenshotUrls = (await Promise.all(paths.map(async (path) => {
      const { data: signed } = await supabase.storage.from("home-photos").createSignedUrl(path, 60 * 60);
      return signed?.signedUrl ?? null;
    }))).filter((value): value is string => Boolean(value));
    return { ...row, screenshotUrls };
  }));

  return NextResponse.json(
    { responses, progress },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
