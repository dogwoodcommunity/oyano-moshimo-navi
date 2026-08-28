"use client";

import { monitorProgress, readMonitorActivity, type MonitorSession } from "@/lib/monitorSession";
import { exportNotebookData } from "@/lib/store";

export type MonitorUsageMetrics = {
  version: 1;
  capturedAt: string;
  monitorStartedAt: string;
  reportDueAt: string;
  notebookCreatedAt: string | null;
  registrationDurationSeconds: number | null;
  appOpenCount: number;
  appOpenDistinctDayCount: number;
  storedDiaryEntryCount: number;
  storedDiaryDistinctDateCount: number;
  manualRecordSaveCount: number;
  manualRecordDistinctDayCount: number;
  lastManualRecordDayNumber: number | null;
  taskUpdateCount: number;
  diaryHistoryOpened: boolean;
  checklistOpened: boolean;
  documentMemoSaved: boolean;
  familyInviteOpened: boolean;
  aiConsultCompleted: boolean;
  cloudBackupConfirmed: boolean;
};

function timestamp(value: string | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function localDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDayNumber(startedAt: string, occurredAt: string) {
  const start = new Date(startedAt);
  const occurred = new Date(occurredAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(occurred.getTime())) return null;
  const startOrdinal = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const occurredOrdinal = Date.UTC(occurred.getFullYear(), occurred.getMonth(), occurred.getDate());
  return Math.max(1, Math.floor((occurredOrdinal - startOrdinal) / (24 * 60 * 60 * 1000)) + 1);
}

export function collectMonitorUsageMetrics(session: MonitorSession, now = new Date()): MonitorUsageMetrics {
  const notebook = exportNotebookData();
  const activity = readMonitorActivity();
  const startedAtMs = Date.parse(session.startedAt);
  const capturedAtMs = now.getTime();
  const progress = monitorProgress(session, now);
  const reportDueAtMs = progress.reportDueAt.getTime();
  const measurementEndMs = Math.min(capturedAtMs, reportDueAtMs - 1);
  const occurredDuringTest = (value: string) => {
    const occurredAt = timestamp(value);
    return occurredAt !== null && occurredAt >= startedAtMs && occurredAt <= measurementEndMs;
  };
  const casesDuringTest = notebook.cases
    .filter((item) => {
      const createdAt = timestamp(item.createdAt);
      return createdAt !== null && createdAt >= startedAtMs && createdAt <= measurementEndMs;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const entriesDuringTest = notebook.diaryEntries.filter((entry) => {
    const createdAt = timestamp(entry.createdAt);
    return createdAt !== null && createdAt >= startedAtMs && createdAt <= measurementEndMs;
  });
  const manualRecordOccurrences = activity.dailyRecordSaved?.occurrences
    .filter(occurredDuringTest) ?? [];
  const appOpenOccurrences = activity.appOpened?.occurrences
    .filter(occurredDuringTest) ?? [];
  const firstNotebookCreatedAt = casesDuringTest[0]?.createdAt ?? null;
  const registrationDurationSeconds = firstNotebookCreatedAt
    ? Math.max(0, Math.round((Date.parse(firstNotebookCreatedAt) - startedAtMs) / 1000))
    : null;
  const taskUpdateCount = notebook.cases.reduce((count, item) => count + (item.result?.tasks ?? []).filter((task) => {
    const updatedAt = timestamp(task.updatedAt);
    return updatedAt !== null && updatedAt >= startedAtMs && updatedAt <= measurementEndMs;
  }).length, 0);
  const lastManualOccurrence = manualRecordOccurrences.at(-1);
  const featureUsed = (name: keyof typeof activity) => (
    activity[name]?.occurrences.some(occurredDuringTest) ?? false
  );

  return {
    version: 1,
    capturedAt: now.toISOString(),
    monitorStartedAt: session.startedAt,
    reportDueAt: progress.reportDueAt.toISOString(),
    notebookCreatedAt: firstNotebookCreatedAt,
    registrationDurationSeconds,
    appOpenCount: appOpenOccurrences.length,
    appOpenDistinctDayCount: new Set(appOpenOccurrences.map(localDateKey).filter(Boolean)).size,
    storedDiaryEntryCount: entriesDuringTest.length,
    storedDiaryDistinctDateCount: new Set(entriesDuringTest.map((entry) => entry.date)).size,
    manualRecordSaveCount: manualRecordOccurrences.length,
    manualRecordDistinctDayCount: new Set(manualRecordOccurrences.map(localDateKey).filter(Boolean)).size,
    lastManualRecordDayNumber: lastManualOccurrence ? calendarDayNumber(session.startedAt, lastManualOccurrence) : null,
    taskUpdateCount,
    diaryHistoryOpened: featureUsed("diaryHistoryOpened"),
    checklistOpened: featureUsed("checklistOpened"),
    documentMemoSaved: featureUsed("documentMemoSaved"),
    familyInviteOpened: featureUsed("familyInviteOpened"),
    aiConsultCompleted: featureUsed("aiConsultCompleted"),
    cloudBackupConfirmed: featureUsed("cloudBackupConfirmed")
  };
}
