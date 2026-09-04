import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cronAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

type JobRow = {
  id?: unknown;
  storage_bucket?: unknown;
  storage_path?: unknown;
  attempt_count?: unknown;
};

const bucket = "home-photos";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanupLimit() {
  const configured = Number(process.env.PERSON_NOTEBOOK_STORAGE_CLEANUP_LIMIT ?? 50);
  return Number.isInteger(configured) && configured > 0 ? Math.min(configured, 100) : 50;
}

function normalizeJob(row: JobRow) {
  const id = typeof row.id === "string" ? row.id : "";
  const storageBucket = typeof row.storage_bucket === "string" ? row.storage_bucket.trim() : "";
  const storagePath = typeof row.storage_path === "string" ? row.storage_path.trim() : "";
  const attemptCount = typeof row.attempt_count === "number"
    && Number.isInteger(row.attempt_count) && row.attempt_count >= 0
    ? row.attempt_count
    : 0;
  const segments = storagePath.split("/");
  const notebookPath = segments.length === 3
    && segments[0] === "notebook"
    && uuidPattern.test(segments[1] ?? "")
    && Boolean(segments[2]);
  const entityPath = segments.length === 2
    && uuidPattern.test(segments[0] ?? "")
    && Boolean(segments[1]);
  if (!uuidPattern.test(id) || storageBucket !== bucket
      || (!notebookPath && !entityPath)
      || segments.some((segment) => segment === "." || segment === "..")) return null;
  return { id, storageBucket, storagePath, attemptCount };
}

export async function GET(request: Request) {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ scanned: 0, completed: 0, retained: 0, errors: ["not_configured"] }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("person_notebook_storage_deletion_jobs")
    .select("id,storage_bucket,storage_path,attempt_count")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(cleanupLimit());
  if (error) {
    return NextResponse.json({ scanned: 0, completed: 0, retained: 0, errors: ["job_read_failed"] }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data as JobRow[] : [];
  let completed = 0;
  let retained = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const job = normalizeJob(row);
    if (!job) {
      retained += 1;
      errors.push("invalid_job");
      continue;
    }
    const attemptedAt = new Date().toISOString();
    const recordFailure = async (code: string) => {
      retained += 1;
      errors.push(code);
      await supabase
        .from("person_notebook_storage_deletion_jobs")
        .update({
          attempt_count: job.attemptCount + 1,
          last_attempt_at: attemptedAt,
          last_error: code
        })
        .eq("id", job.id)
        .eq("status", "pending");
    };

    const { data: referenced, error: referenceError } = await supabase.rpc(
      "person_notebook_storage_path_is_referenced",
      { p_storage_bucket: job.storageBucket, p_storage_path: job.storagePath }
    );
    if (referenceError || referenced !== false) {
      await recordFailure(referenceError ? "reference_check_failed" : "storage_path_still_referenced");
      continue;
    }

    const { error: storageError } = await supabase.storage
      .from(job.storageBucket)
      .remove([job.storagePath]);
    if (storageError) {
      await recordFailure("storage_delete_failed");
      continue;
    }

    // A successful remove response is not itself proof that the object is
    // gone. Confirm exact absence before making the durable job terminal.
    // Search results are paged to avoid mistaking a crowded prefix for
    // absence. Any malformed/failed/inconclusive listing stays retryable.
    const pathParts = job.storagePath.split("/");
    const objectName = pathParts.pop() ?? "";
    const directory = pathParts.join("/");
    let verifiedAbsent = false;
    let verificationFailed = false;
    for (let offset = 0; offset < 10_000; offset += 100) {
      const { data: listed, error: listError } = await supabase.storage
        .from(job.storageBucket)
        .list(directory, { limit: 100, offset, search: objectName });
      if (listError || !Array.isArray(listed)) {
        verificationFailed = true;
        break;
      }
      if (listed.some((item) => item?.name === objectName)) break;
      if (listed.length < 100) {
        verifiedAbsent = true;
        break;
      }
    }
    if (!verifiedAbsent) {
      await recordFailure(verificationFailed ? "storage_verify_failed" : "storage_delete_not_confirmed");
      continue;
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("person_notebook_storage_deletion_jobs")
      .update({
        status: "completed",
        completed_at: attemptedAt,
        attempt_count: job.attemptCount + 1,
        last_attempt_at: attemptedAt,
        last_error: null
      })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (receiptError || !receipt) {
      retained += 1;
      errors.push("receipt_write_failed");
      continue;
    }
    completed += 1;
  }

  return NextResponse.json(
    { scanned: rows.length, completed, retained, errors },
    { status: errors.length > 0 ? 500 : 200 }
  );
}
