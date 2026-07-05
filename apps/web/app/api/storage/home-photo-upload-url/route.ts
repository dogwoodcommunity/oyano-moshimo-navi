import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  const body = await request.json() as {
    homeId?: string;
    fileName?: string;
    contentType?: string;
  };

  if (!body.homeId || !body.fileName) {
    return NextResponse.json({ error: "homeId and fileName are required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 501 });
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
    contentType: body.contentType ?? "image/jpeg"
  });
}
