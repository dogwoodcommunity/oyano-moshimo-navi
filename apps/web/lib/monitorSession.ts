"use client";

import { isMonitorCampaignSubmissionOpen, MONITOR_CAMPAIGN_ID } from "@/lib/monitorCampaign";

export const MONITOR_SESSION_STORAGE_KEY = "oyano_monitor_session_v01";
export const MONITOR_ACTIVITY_STORAGE_KEY = "oyano_monitor_activity_v01";
export const MONITOR_PROGRESS_SYNC_STORAGE_KEY = "oyano_monitor_progress_sync_v01";
export const MONITOR_PROGRESS_CONSENT_STORAGE_KEY = "oyano_monitor_progress_consent_v01";
export const MONITOR_TEST_CALENDAR_DAYS = 7;
export const MONITOR_PROGRESS_SYNC_THROTTLE_MS = 15_000;

export type MonitorActivityName =
  | "appOpened"
  | "dailyRecordSaved"
  | "diaryHistoryOpened"
  | "checklistOpened"
  | "documentMemoSaved"
  | "familyInviteOpened"
  | "aiConsultCompleted"
  | "cloudBackupConfirmed";

export type MonitorActivityEvent = {
  count: number;
  firstAt: string;
  lastAt: string;
  occurrences: string[];
};

export type MonitorActivity = Partial<Record<MonitorActivityName, MonitorActivityEvent>>;

export type MonitorSession = {
  sessionId: string;
  startedAt: string;
  reportSubmittedAt?: string;
};

export type MonitorProgressUsageMetrics = {
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

export type MonitorProgressSyncPayload = {
  version: 1;
  campaignId: string;
  sessionId: string;
  startedAt: string;
  reportDueAt: string;
  lastSeenAt: string;
  dayNumber: number;
  isReportDue: boolean;
  usageMetrics: MonitorProgressUsageMetrics;
};

export type MonitorProgressSyncState = {
  sessionId: string;
  lastAttemptAt: string;
};

export type MonitorProgressConsent = "granted" | "declined" | null;

export type MonitorProgress = {
  dayNumber: number;
  daysRemaining: number;
  reportDueAt: Date;
  isReportDue: boolean;
};

export function monitorPeriodStatus(
  progress: Pick<MonitorProgress, "dayNumber" | "daysRemaining" | "isReportDue">
) {
  if (progress.isReportDue) return "7日間の記録期間は終了しました。";
  if (progress.dayNumber === MONITOR_TEST_CALENDAR_DAYS) return "今日が7日目（最終日）です。";
  return `今日を含めてあと${progress.daysRemaining}日です。`;
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readMonitorProgressConsent(): MonitorProgressConsent {
  const storage = getStorage();
  if (!storage) return null;
  const value = storage.getItem(MONITOR_PROGRESS_CONSENT_STORAGE_KEY);
  return value === "granted" || value === "declined" ? value : null;
}

export function grantMonitorProgressConsent() {
  if (stopClosedMonitorProgressSync()) return false;
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(MONITOR_PROGRESS_CONSENT_STORAGE_KEY, "granted");
    scheduleMonitorProgressSync({ force: true });
    return true;
  } catch {
    return false;
  }
}

export function declineMonitorProgressConsent() {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(MONITOR_PROGRESS_CONSENT_STORAGE_KEY, "declined");
    storage.removeItem(MONITOR_PROGRESS_SYNC_STORAGE_KEY);
    if (pendingMonitorProgressSync !== null) {
      window.clearTimeout(pendingMonitorProgressSync);
      pendingMonitorProgressSync = null;
    }
    return true;
  } catch {
    return false;
  }
}

function validDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createMonitorSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    // This fallback is only for older browsers without Web Crypto. The identifier is anonymous,
    // but still needs to be different enough to keep progress records from being merged.
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function normalizeMonitorSession(
  value: unknown,
  createSessionId: () => string = createMonitorSessionId
): { session: MonitorSession; upgraded: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MonitorSession>;
  if (!validDate(candidate.startedAt)) return null;
  const sessionId = validUuid(candidate.sessionId) ? candidate.sessionId : createSessionId();

  return {
    session: {
      sessionId,
      startedAt: candidate.startedAt!,
      reportSubmittedAt: validDate(candidate.reportSubmittedAt) ? candidate.reportSubmittedAt : undefined
    },
    upgraded: sessionId !== candidate.sessionId
  };
}

export function readMonitorSession(): MonitorSession | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const normalized = normalizeMonitorSession(JSON.parse(storage.getItem(MONITOR_SESSION_STORAGE_KEY) ?? "null"));
    if (!normalized) return null;
    if (normalized.upgraded) {
      try {
        storage.setItem(MONITOR_SESSION_STORAGE_KEY, JSON.stringify(normalized.session));
      } catch {
        // Keep the existing session usable even when storage cannot be updated.
      }
    }
    return normalized.session;
  } catch {
    return null;
  }
}

export function startMonitorSession(options: { restart?: boolean; now?: Date } = {}) {
  const current = readMonitorSession();
  if (current && !options.restart) {
    scheduleMonitorProgressSync({ now: options.now });
    return current;
  }

  const session: MonitorSession = {
    sessionId: createMonitorSessionId(),
    startedAt: (options.now ?? new Date()).toISOString()
  };
  const storage = getStorage();
  if (storage) {
    try {
      if (options.restart) {
        storage.removeItem(MONITOR_ACTIVITY_STORAGE_KEY);
        storage.removeItem(MONITOR_PROGRESS_SYNC_STORAGE_KEY);
      }
      storage.setItem(MONITOR_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // The test still works if browser storage is blocked; only the reminder is unavailable.
    }
  }
  scheduleMonitorProgressSync({ force: true, now: options.now });
  return session;
}

function validActivityEvent(value: unknown): value is MonitorActivityEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<MonitorActivityEvent>;
  return typeof event.count === "number"
    && event.count >= 1
    && validDate(event.firstAt)
    && validDate(event.lastAt)
    && (!event.occurrences || (Array.isArray(event.occurrences) && event.occurrences.every(validDate)));
}

export function readMonitorActivity(): MonitorActivity {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const parsed = JSON.parse(storage.getItem(MONITOR_ACTIVITY_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const activity: MonitorActivity = {};
    const names: MonitorActivityName[] = [
      "appOpened",
      "dailyRecordSaved",
      "diaryHistoryOpened",
      "checklistOpened",
      "documentMemoSaved",
      "familyInviteOpened",
      "aiConsultCompleted",
      "cloudBackupConfirmed"
    ];
    names.forEach((name) => {
      if (validActivityEvent(parsed[name])) {
        const event = parsed[name] as MonitorActivityEvent;
        activity[name] = {
          ...event,
          occurrences: Array.isArray(event.occurrences) ? event.occurrences.slice(-100) : [event.lastAt]
        };
      }
    });
    return activity;
  } catch {
    return {};
  }
}

export function markMonitorActivity(name: MonitorActivityName, now = new Date()) {
  if (stopClosedMonitorProgressSync()) return;
  const session = readMonitorSession();
  if (!session || session.reportSubmittedAt) return;
  const storage = getStorage();
  if (!storage) return;

  try {
    const activity = readMonitorActivity();
    const current = activity[name];
    const occurredAt = now.toISOString();
    activity[name] = current
      ? { ...current, count: current.count + 1, lastAt: occurredAt, occurrences: [...current.occurrences, occurredAt].slice(-100) }
      : { count: 1, firstAt: occurredAt, lastAt: occurredAt, occurrences: [occurredAt] };
    storage.setItem(MONITOR_ACTIVITY_STORAGE_KEY, JSON.stringify(activity));
    scheduleMonitorProgressSync({ now });
  } catch {
    // The survey still accepts self-report if browser storage is unavailable.
  }
}

export function markMonitorReportSubmitted(now = new Date()) {
  const current = readMonitorSession();
  if (!current) return;

  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      MONITOR_SESSION_STORAGE_KEY,
      JSON.stringify({ ...current, reportSubmittedAt: now.toISOString() } satisfies MonitorSession)
    );
    scheduleMonitorProgressSync({ force: true, now });
  } catch {
    // A successful server submission is authoritative even if this device cannot persist the marker.
  }
}

function localDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function occurrencesDuringTest(
  activity: MonitorActivity,
  name: MonitorActivityName,
  startedAt: string,
  reportDueAt: Date
) {
  const startTimestamp = Date.parse(startedAt);
  const dueTimestamp = reportDueAt.getTime();
  return (activity[name]?.occurrences ?? []).filter((value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp >= startTimestamp && timestamp < dueTimestamp;
  });
}

export function monitorCalendarDayNumber(startedAt: string, occurredAt: string) {
  const start = new Date(startedAt);
  const occurred = new Date(occurredAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(occurred.getTime())) return null;
  const startOrdinal = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const occurredOrdinal = Date.UTC(occurred.getFullYear(), occurred.getMonth(), occurred.getDate());
  return Math.max(1, Math.floor((occurredOrdinal - startOrdinal) / (24 * 60 * 60 * 1000)) + 1);
}

export function buildMonitorProgressSyncPayload(
  session: MonitorSession,
  activity: MonitorActivity,
  now = new Date()
): MonitorProgressSyncPayload {
  const progress = monitorProgress(session, now);
  const appOpenOccurrences = occurrencesDuringTest(activity, "appOpened", session.startedAt, progress.reportDueAt);
  const manualRecordOccurrences = occurrencesDuringTest(activity, "dailyRecordSaved", session.startedAt, progress.reportDueAt);
  const lastManualRecordOccurrence = manualRecordOccurrences.at(-1);
  const featureUsed = (name: MonitorActivityName) => (
    occurrencesDuringTest(activity, name, session.startedAt, progress.reportDueAt).length > 0
  );

  return {
    version: 1,
    campaignId: MONITOR_CAMPAIGN_ID,
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    reportDueAt: progress.reportDueAt.toISOString(),
    lastSeenAt: now.toISOString(),
    dayNumber: progress.dayNumber,
    isReportDue: progress.isReportDue,
    usageMetrics: {
      appOpenCount: appOpenOccurrences.length,
      appOpenDistinctDayCount: new Set(appOpenOccurrences.map(localDateKey).filter(Boolean)).size,
      manualRecordSaveCount: manualRecordOccurrences.length,
      manualRecordDistinctDayCount: new Set(manualRecordOccurrences.map(localDateKey).filter(Boolean)).size,
      lastManualRecordDayNumber: lastManualRecordOccurrence
        ? monitorCalendarDayNumber(session.startedAt, lastManualRecordOccurrence)
        : null,
      diaryHistoryOpened: featureUsed("diaryHistoryOpened"),
      checklistOpened: featureUsed("checklistOpened"),
      documentMemoSaved: featureUsed("documentMemoSaved"),
      familyInviteOpened: featureUsed("familyInviteOpened"),
      aiConsultCompleted: featureUsed("aiConsultCompleted"),
      cloudBackupConfirmed: featureUsed("cloudBackupConfirmed")
    }
  };
}

export function shouldSyncMonitorProgress(
  state: MonitorProgressSyncState | null,
  sessionId: string,
  now = new Date(),
  throttleMs = MONITOR_PROGRESS_SYNC_THROTTLE_MS
) {
  if (!state || state.sessionId !== sessionId || !validDate(state.lastAttemptAt)) return true;
  return now.getTime() - Date.parse(state.lastAttemptAt) >= throttleMs;
}

function readMonitorProgressSyncState(): MonitorProgressSyncState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(MONITOR_PROGRESS_SYNC_STORAGE_KEY) ?? "null") as Partial<MonitorProgressSyncState> | null;
    if (!parsed || !validUuid(parsed.sessionId) || !validDate(parsed.lastAttemptAt)) return null;
    return { sessionId: parsed.sessionId!, lastAttemptAt: parsed.lastAttemptAt! };
  } catch {
    return null;
  }
}

let pendingMonitorProgressSync: number | null = null;

// Keep past monitor data intact, but do not collect or send after closure.
function stopClosedMonitorProgressSync() {
  if (isMonitorCampaignSubmissionOpen()) return false;
  if (pendingMonitorProgressSync !== null && typeof window !== "undefined") {
    window.clearTimeout(pendingMonitorProgressSync);
    pendingMonitorProgressSync = null;
  }
  return true;
}

export function scheduleMonitorProgressSync(options: { force?: boolean; now?: Date } = {}) {
  if (stopClosedMonitorProgressSync()) return;
  if (typeof window === "undefined") return;
  if (readMonitorProgressConsent() !== "granted") return;
  const session = readMonitorSession();
  if (!session || (session.reportSubmittedAt && !options.force)) return;
  const now = options.now ?? new Date();
  const state = readMonitorProgressSyncState();

  if (!options.force && !shouldSyncMonitorProgress(state, session.sessionId, now)) {
    if (pendingMonitorProgressSync === null) {
      const elapsed = state ? Math.max(0, now.getTime() - Date.parse(state.lastAttemptAt)) : 0;
      const delay = Math.max(0, MONITOR_PROGRESS_SYNC_THROTTLE_MS - elapsed);
      pendingMonitorProgressSync = window.setTimeout(() => {
        pendingMonitorProgressSync = null;
        void syncMonitorProgress();
      }, delay);
    }
    return;
  }

  if (pendingMonitorProgressSync !== null) {
    window.clearTimeout(pendingMonitorProgressSync);
    pendingMonitorProgressSync = null;
  }
  void syncMonitorProgress({ force: options.force, now });
}

export async function syncMonitorProgress(options: { force?: boolean; now?: Date } = {}) {
  if (stopClosedMonitorProgressSync()) return false;
  if (readMonitorProgressConsent() !== "granted") return false;
  const session = readMonitorSession();
  const storage = getStorage();
  if (!session || (session.reportSubmittedAt && !options.force) || !storage || typeof fetch !== "function") return false;
  const now = options.now ?? new Date();
  const state = readMonitorProgressSyncState();
  if (!options.force && !shouldSyncMonitorProgress(state, session.sessionId, now)) return false;

  try {
    storage.setItem(
      MONITOR_PROGRESS_SYNC_STORAGE_KEY,
      JSON.stringify({ sessionId: session.sessionId, lastAttemptAt: now.toISOString() } satisfies MonitorProgressSyncState)
    );
  } catch {
    return false;
  }

  try {
    const response = await fetch("/api/monitor-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildMonitorProgressSyncPayload(session, readMonitorActivity(), now)),
      credentials: "same-origin",
      keepalive: true
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function monitorProgress(session: MonitorSession, now = new Date()): MonitorProgress {
  const startedAt = new Date(session.startedAt);
  const startDayOrdinal = Date.UTC(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate());
  const currentDayOrdinal = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedCalendarDays = Math.max(0, Math.floor((currentDayOrdinal - startDayOrdinal) / (24 * 60 * 60 * 1000)));
  const reportDueAt = new Date(
    startedAt.getFullYear(),
    startedAt.getMonth(),
    startedAt.getDate() + MONITOR_TEST_CALENDAR_DAYS,
    0,
    0,
    0,
    0
  );
  const isReportDue = now.getTime() >= reportDueAt.getTime();
  const dayNumber = Math.min(MONITOR_TEST_CALENDAR_DAYS, elapsedCalendarDays + 1);

  return {
    dayNumber,
    daysRemaining: isReportDue ? 0 : Math.max(1, MONITOR_TEST_CALENDAR_DAYS + 1 - dayNumber),
    reportDueAt,
    isReportDue
  };
}
