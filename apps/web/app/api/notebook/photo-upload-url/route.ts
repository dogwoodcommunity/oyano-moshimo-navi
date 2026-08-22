import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

const bucket = "home-photos";
const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSizeBytes = 8 * 1024 * 1024;

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

function safeFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.length > 0 ? normalized.slice(0, 120) : "photo.jpg";
}

export async function POST(request: Request) {
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
