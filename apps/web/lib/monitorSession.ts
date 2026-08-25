"use client";

export const MONITOR_SESSION_STORAGE_KEY = "oyano_monitor_session_v01";
export const MONITOR_ACTIVITY_STORAGE_KEY = "oyano_monitor_activity_v01";
export const MONITOR_TEST_CALENDAR_DAYS = 7;

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
  startedAt: string;
  reportSubmittedAt?: string;
};

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

function validDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function readMonitorSession(): MonitorSession | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const parsed = JSON.parse(storage.getItem(MONITOR_SESSION_STORAGE_KEY) ?? "null") as Partial<MonitorSession> | null;
    if (!parsed || !validDate(parsed.startedAt)) return null;
    return {
      startedAt: parsed.startedAt!,
      reportSubmittedAt: validDate(parsed.reportSubmittedAt) ? parsed.reportSubmittedAt : undefined
    };
  } catch {
    return null;
  }
}

export function startMonitorSession(options: { restart?: boolean; now?: Date } = {}) {
  const current = readMonitorSession();
  if (current && !options.restart) return current;

  const session: MonitorSession = {
    startedAt: (options.now ?? new Date()).toISOString()
  };
  const storage = getStorage();
  if (storage) {
    try {
      if (options.restart) storage.removeItem(MONITOR_ACTIVITY_STORAGE_KEY);
      storage.setItem(MONITOR_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // The test still works if browser storage is blocked; only the reminder is unavailable.
    }
  }
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
  if (!readMonitorSession()) return;
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
  } catch {
    // A successful server submission is authoritative even if this device cannot persist the marker.
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
