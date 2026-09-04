import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

const bucket = "home-photos";
const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSizeBytes = 8 * 1024 * 1024;
const uploadUrlHourlyLimit = Number(process.env.NOTEBOOK_PHOTO_UPLOAD_URL_HOURLY_LIMIT ?? 40);
const freeStorageQuotaBytes = Number(process.env.NOTEBOOK_PHOTO_FREE_QUOTA_BYTES ?? 50 * 1024 * 1024);
const plusStorageQuotaBytes = Number(process.env.NOTEBOOK_PHOTO_PLUS_QUOTA_BYTES ?? 500 * 1024 * 1024);
const familyEditorRoles = new Set(["owner", "admin", "member"]);

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

function safeFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.length > 0 ? normalized.slice(0, 120) : "photo.jpg";
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function bytesFromStorageObject(value: Record<string, any>) {
  const metadata = value.metadata && typeof value.metadata === "object" ? value.metadata : {};
  const numeric = Number(metadata.size ?? metadata.contentLength ?? value.size ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function editableFamilyIdsForUser(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  userId: string
) {
  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;

  return asArray<Record<string, any>>(memberships)
    .filter((row) => familyEditorRoles.has(String(row.role ?? "")))
    .map((row) => typeof row.family_id === "string" ? row.family_id : "")
    .filter(Boolean);
}

async function userHasPlusFamily(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  familyIds: string[]
) {
  if (familyIds.length === 0) return false;

  const { data: families, error: familyError } = await supabase
    .from("families")
    .select("plan")
    .in("id", familyIds);
  if (familyError) throw familyError;

  return asArray<Record<string, any>>(families).some((row) => row.plan === "plus");
}

async function notebookPhotoUsageBytes(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, userId: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(`notebook/${userId}`, { limit: 1000 });
  if (error) throw error;

  return asArray<Record<string, any>>(data).reduce((total, item) => total + bytesFromStorageObject(item), 0);
}

async function checkUserUploadUrlRateLimit(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  userId: string
) {
  const { data, error } = await supabase.rpc("check_public_api_rate_limit", {
    p_key: `notebook-photo-upload-url:user:${userId}`,
    p_limit: uploadUrlHourlyLimit,
    p_window_seconds: 60 * 60
  });

  if (error) return null;

  const result = data as { allowed?: boolean; retry_after?: number } | null;
  if (result?.allowed !== false) return null;

  return NextResponse.json(
    { error: "rate_limit_exceeded", retryAfter: result.retry_after ?? 3600 },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, result.retry_after ?? 3600))
      }
    }
  );
}

export async function POST(request: Request) {
  const rateLimited = await checkPublicRateLimit(request, {
    keyPrefix: "notebook-photo-upload-url",
    limit: 80,
    windowSeconds: 60 * 60
  });
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => ({})) as {
    fileName?: string;
    contentType?: string;
    fileSizeBytes?: number;
  };

  const contentType = body.contentType ?? "image/jpeg";
  if (!allowedContentTypes.has(contentType)) {
    return NextResponse.json({ error: "Only jpeg, png, and webp images are allowed" }, { status: 400 });
  }

  if (typeof body.fileSizeBytes === "number" && body.fileSizeBytes > maxFileSizeBytes) {
    return NextResponse.json({ error: "Image must be 8MB or smaller" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 501 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authorization bearer token is required" }, { status: 401 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  const userId = userResult.user?.id;
  if (userError || !userId) {
    return NextResponse.json({ error: "Invalid authorization token" }, { status: 401 });
  }

  const userRateLimited = await checkUserUploadUrlRateLimit(supabase, userId);
  if (userRateLimited) return userRateLimited;

  const incomingBytes = Number.isFinite(Number(body.fileSizeBytes)) ? Number(body.fileSizeBytes) : 0;
  try {
    const editableFamilyIds = await editableFamilyIdsForUser(supabase, userId);
    if (editableFamilyIds.length === 0) {
      return NextResponse.json(
        { error: "You cannot upload photos with viewer-only family access" },
        { status: 403 }
      );
    }

    const [isPlus, currentUsageBytes] = await Promise.all([
      userHasPlusFamily(supabase, editableFamilyIds),
      notebookPhotoUsageBytes(supabase, userId)
    ]);
    const quotaBytes = isPlus ? plusStorageQuotaBytes : freeStorageQuotaBytes;
    if (currentUsageBytes + incomingBytes > quotaBytes) {
      return NextResponse.json(
        {
          error: "storage_quota_exceeded",
          message: "写真のクラウド容量が上限に近づいています。写真を減らすか、必要なものだけ残してください。",
          quotaBytes,
          currentUsageBytes
        },
        { status: 413 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify photo storage quota" },
      { status: 500 }
    );
  }

  const storagePath = `notebook/${userId}/${crypto.randomUUID()}-${safeFileName(body.fileName ?? "photo.jpg")}`;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bucket,
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
    contentType,
    warnings: [
      "住所、表札、鍵番号、医療書類の細部が写る写真は避けてください。",
      "位置情報が残る写真は、端末側で位置情報を削除してから追加してください。"
    ]
  });
}
