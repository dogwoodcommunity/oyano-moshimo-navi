"use client";

export const MONITOR_SESSION_STORAGE_KEY = "oyano_monitor_session_v01";
export const MONITOR_TEST_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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
      storage.setItem(MONITOR_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // The test still works if browser storage is blocked; only the reminder is unavailable.
    }
  }
  return session;
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
  const startedAt = Date.parse(session.startedAt);
  const elapsed = Math.max(0, now.getTime() - startedAt);
  const remaining = Math.max(0, MONITOR_TEST_DURATION_MS - elapsed);
  const reportDueAt = new Date(startedAt + MONITOR_TEST_DURATION_MS);

  return {
    dayNumber: Math.min(7, Math.floor(elapsed / (24 * 60 * 60 * 1000)) + 1),
    daysRemaining: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
    reportDueAt,
    isReportDue: remaining === 0
  };
}
