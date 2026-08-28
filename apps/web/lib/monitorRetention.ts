const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 100;
const RETENTION_MONTHS = 6;

export type MonitorRetentionAction = "monitor_progress_synced" | "monitor_feedback_submitted";

export type MonitorRetentionRow = {
  action: MonitorRetentionAction;
  metadata: unknown;
  created_at: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function dateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function addUtcMonthsClamped(value: Date, months: number) {
  const result = new Date(value.getTime());
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const finalDayOfMonth = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0
  )).getUTCDate();
  result.setUTCDate(Math.min(originalDay, finalDayOfMonth));
  return result;
}

export function monitorRetentionBatchLimit(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_LIMIT;
  return Math.min(MAX_BATCH_LIMIT, Math.max(1, Math.floor(parsed)));
}

export function monitorRetentionExpiresAt(row: MonitorRetentionRow) {
  const metadata = record(row.metadata);
  const preferredAnchor = row.action === "monitor_progress_synced"
    ? dateValue(metadata.reportDueAt)
    : dateValue(metadata.submittedAt);
  const anchor = preferredAnchor ?? dateValue(row.created_at);
  return anchor ? addUtcMonthsClamped(anchor, RETENTION_MONTHS) : null;
}

export function isMonitorRetentionExpired(row: MonitorRetentionRow, now = new Date()) {
  const expiresAt = monitorRetentionExpiresAt(row);
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

export function monitorFeedbackScreenshotPaths(metadata: unknown) {
  const paths = record(metadata).screenshotPaths;
  if (!Array.isArray(paths)) return [];

  return Array.from(new Set(paths.filter((value): value is string => (
    typeof value === "string"
    && value.startsWith("monitor-feedback/")
    && value.length <= 300
  )))).slice(0, 3);
}

export function isExpiredMonitorScreenshotMonth(folderName: string, now = new Date()) {
  if (!/^\d{4}-\d{2}$/.test(folderName)) return false;
  const [year, month] = folderName.split("-").map(Number);
  if (month < 1 || month > 12) return false;

  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - RETENTION_MONTHS, 1));
  const folder = new Date(Date.UTC(year, month - 1, 1));
  return folder.getTime() < cutoff.getTime();
}
