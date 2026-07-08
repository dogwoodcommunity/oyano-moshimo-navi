import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSizeBytes = 10 * 1024 * 1024;

type HomeWithFamily = {
  id: string;
  people?: { family_id: string | null } | Array<{ family_id: string | null }> | null;
};

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

export async function POST(request: Request) {
  const body = await request.json() as {
    homeId?: string;
    fileName?: string;
    contentType?: string;
    fileSizeBytes?: number;
  };

  if (!body.homeId || !body.fileName) {
    return NextResponse.json({ error: "homeId and fileName are required" }, { status: 400 });
  }

  const contentType = body.contentType ?? "image/jpeg";
  if (!allowedContentTypes.has(contentType)) {
    return NextResponse.json({ error: "Only jpeg, png, and webp images are allowed" }, { status: 400 });
  }

  if (typeof body.fileSizeBytes === "number" && body.fileSizeBytes > maxFileSizeBytes) {
    return NextResponse.json({ error: "Image must be 10MB or smaller" }, { status: 400 });
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

  const { data: home, error: homeError } = await supabase
    .from("homes")
    .select("id, people(family_id)")
    .eq("id", body.homeId)
    .single();

  if (homeError || !home) {
    return NextResponse.json({ error: "Home was not found" }, { status: 404 });
  }

  const homeRow = home as HomeWithFamily;
  const familyId = Array.isArray(homeRow.people) ? homeRow.people[0]?.family_id : homeRow.people?.family_id;
  if (!familyId) {
    return NextResponse.json({ error: "Home family was not found" }, { status: 404 });
  }

  const { data: familyMember, error: memberError } = await supabase
    .from("family_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  if (!familyMember) {
    return NextResponse.json({ error: "You cannot upload photos for this home" }, { status: 403 });
  }

  const safeFileName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${body.homeId}/${crypto.randomUUID()}-${safeFileName}`;

  const { data, error } = await supabase.storage
    .from("home-photos")
    .createSignedUploadUrl(storagePath);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bucket: "home-photos",
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
    contentType,
    warnings: [
      "外観、表札、住所、鍵番号が写る写真は避けてください。",
      "位置情報が残る写真は、アップロード前に端末側で位置情報を削除してください。"
    ]
  });
}
