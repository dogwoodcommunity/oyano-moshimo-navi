export const MONITOR_CAMPAIGN_ID = "crowdworks-2026-08";

export const MONITOR_CAMPAIGN_SUBMISSION_STATE: "open" | "closed" = "closed";

export const MONITOR_CAMPAIGN_CLOSED_CODE = "monitor_campaign_closed";
export const MONITOR_CAMPAIGN_CLOSED_MESSAGE =
  "このモニターの回答受付は終了しました。すでに受け付けた回答と画像は保存されています。";

/**
 * This source-controlled switch is the final server-side authority for the
 * current campaign. Do not derive it from a clock or an environment variable:
 * a stale deployment or configuration must not silently reopen submissions.
 * A future campaign must introduce server-issued participant tokens before it
 * changes its own submission state to open.
 */
export function isMonitorCampaignSubmissionOpen() {
  return MONITOR_CAMPAIGN_SUBMISSION_STATE === "open";
}

export type MonitorCampaignEntryState = "preview" | "submitted" | "closed" | "open";

/**
 * Keep the client entry screens aligned with the server-side submission gate.
 * An explicit preview remains available for review, and a device that already
 * submitted keeps its completion screen even after the campaign is closed.
 */
export function resolveMonitorCampaignEntryState({
  previewRequested = false,
  reportSubmitted = false
}: {
  previewRequested?: boolean;
  reportSubmitted?: boolean;
} = {}): MonitorCampaignEntryState {
  if (previewRequested) return "preview";
  if (reportSubmitted) return "submitted";
  return isMonitorCampaignSubmissionOpen() ? "open" : "closed";
}
