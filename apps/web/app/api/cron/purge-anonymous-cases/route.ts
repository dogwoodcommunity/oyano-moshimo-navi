import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cronAuth";
import {
  isExpiredMonitorScreenshotMonth,
  isMonitorRetentionExpired,
  monitorFeedbackScreenshotPaths,
  monitorRetentionBatchLimit,
  type MonitorRetentionAction,
  type MonitorRetentionRow
} from "@/lib/monitorRetention";
import { getServerSupabase } from "@/lib/serverSupabase";

const MONITOR_ACTIONS: MonitorRetentionAction[] = [
  "monitor_progress_synced",
  "monitor_feedback_submitted"
];
const MONITOR_SCAN_MULTIPLIER = 4;

type MonitorAuditRow = MonitorRetentionRow & {
  id: string;
};

type PurgeErrorStage =
  | "select"
  | "screenshot_delete"
  | "orphan_screenshot_list"
  | "orphan_screenshot_delete"
  | "progress_delete"
  | "feedback_delete";

function errorCode(stage: PurgeErrorStage) {
  return `${stage}_failed`;
}

async function purgeMonitorRetention(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  batchLimit: number,
  now: Date
) {
  const result = {
    scanned: 0,
    expired: 0,
    progressPurged: 0,
    feedbackPurged: 0,
    screenshotsPurged: 0,
    orphanScreenshotsPurged: 0,
    errors: [] as string[]
  };
  const scanLimit = Math.min(batchLimit * MONITOR_SCAN_MULTIPLIER, 400);
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, metadata, created_at")
    .in("action", MONITOR_ACTIONS)
    .order("created_at", { ascending: true })
    .limit(scanLimit);

  if (error) {
    result.errors.push(errorCode("select"));
    return result;
  }

  const rows = (data ?? []) as MonitorAuditRow[];
  result.scanned = rows.length;
  const expiredRows = rows
    .filter((row) => isMonitorRetentionExpired(row, now))
    .slice(0, batchLimit);
  result.expired = expiredRows.length;

  const progressIds = expiredRows
    .filter((row) => row.action === "monitor_progress_synced")
    .map((row) => row.id);
  const feedbackRows = expiredRows.filter((row) => row.action === "monitor_feedback_submitted");

  if (progressIds.length > 0) {
    const { data: deleted, error: deleteError } = await supabase
      .from("audit_logs")
      .delete()
      .in("id", progressIds)
      .select("id");
    if (deleteError) {
      result.errors.push(errorCode("progress_delete"));
    } else {
      result.progressPurged = deleted?.length ?? 0;
    }
  }

  if (feedbackRows.length > 0) {
    const screenshotPaths = Array.from(new Set(feedbackRows.flatMap((row) => (
      monitorFeedbackScreenshotPaths(row.metadata)
    ))));
    let screenshotsDeleted = true;

    if (screenshotPaths.length > 0) {
      const { data: removed, error: storageError } = await supabase.storage
        .from("home-photos")
        .remove(screenshotPaths);
      if (storageError) {
        screenshotsDeleted = false;
        result.errors.push(errorCode("screenshot_delete"));
      } else {
        result.screenshotsPurged = removed?.length ?? 0;
      }
    }

    if (screenshotsDeleted) {
      const { data: deleted, error: deleteError } = await supabase
        .from("audit_logs")
        .delete()
        .in("id", feedbackRows.map((row) => row.id))
        .select("id");
      if (deleteError) {
        result.errors.push(errorCode("feedback_delete"));
      } else {
        result.feedbackPurged = deleted?.length ?? 0;
      }
    }
  }

  const { data: screenshotFolders, error: folderError } = await supabase.storage
    .from("home-photos")
    .list("monitor-feedback", { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (folderError) {
    result.errors.push(errorCode("orphan_screenshot_list"));
  } else {
    const expiredFolders = (screenshotFolders ?? [])
      .map((item) => item.name)
      .filter((name) => isExpiredMonitorScreenshotMonth(name, now));
    const orphanPaths: string[] = [];
    for (const folder of expiredFolders) {
      if (orphanPaths.length >= batchLimit) break;
      const { data: files, error: fileError } = await supabase.storage
        .from("home-photos")
        .list(`monitor-feedback/${folder}`, {
          limit: batchLimit - orphanPaths.length,
          sortBy: { column: "name", order: "asc" }
        });
      if (fileError) {
        result.errors.push(errorCode("orphan_screenshot_list"));
        continue;
      }
      (files ?? []).forEach((file) => {
        if (orphanPaths.length < batchLimit && file.name && file.id) {
          orphanPaths.push(`monitor-feedback/${folder}/${file.name}`);
        }
      });
    }
    if (orphanPaths.length > 0) {
      const { data: removed, error: removeError } = await supabase.storage
        .from("home-photos")
        .remove(orphanPaths);
      if (removeError) {
        result.errors.push(errorCode("orphan_screenshot_delete"));
      } else {
        result.orphanScreenshotsPurged = removed?.length ?? 0;
      }
    }
  }

  return result;
}

export async function GET(request: Request) {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({
      purged: 0,
      skipped: true,
      reason: "Supabase is not configured",
      anonymousCases: { purged: 0, error: null },
      monitorRetention: {
        scanned: 0,
        expired: 0,
        progressPurged: 0,
        feedbackPurged: 0,
        screenshotsPurged: 0,
        orphanScreenshotsPurged: 0,
        errors: []
      }
    });
  }

  const retentionDays = Number(process.env.ANONYMOUS_CASE_RETENTION_DAYS ?? 30);
  const batchSize = Number(process.env.ANONYMOUS_CASE_PURGE_LIMIT ?? 100);
  const monitorBatchLimit = monitorRetentionBatchLimit(process.env.MONITOR_RETENTION_PURGE_LIMIT);

  const { data, error: anonymousError } = await supabase.rpc("purge_stale_anonymous_cases", {
    p_limit: Number.isFinite(batchSize) ? batchSize : 100,
    p_retention_days: Number.isFinite(retentionDays) ? retentionDays : 30
  });
  const monitorRetention = await purgeMonitorRetention(supabase, monitorBatchLimit, new Date());
  const anonymousCases = {
    purged: anonymousError ? 0 : data ?? 0,
    error: anonymousError ? "purge_failed" : null
  };
  const hasErrors = Boolean(anonymousCases.error || monitorRetention.errors.length > 0);

  return NextResponse.json(
    {
      // Keep the original top-level count for existing cron monitoring.
      purged: anonymousCases.purged,
      anonymousCases,
      monitorRetention
    },
    { status: hasErrors ? 500 : 200 }
  );
}
