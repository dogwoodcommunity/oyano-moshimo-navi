import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isMonitorCampaignSubmissionOpen,
  MONITOR_CAMPAIGN_CLOSED_CODE,
  MONITOR_CAMPAIGN_CLOSED_MESSAGE
} from "@/lib/monitorCampaign";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

const BUCKET = "home-photos";
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export async function POST(request: Request) {
  if (!isMonitorCampaignSubmissionOpen()) {
    return NextResponse.json({
      code: MONITOR_CAMPAIGN_CLOSED_CODE,
      message: MONITOR_CAMPAIGN_CLOSED_MESSAGE
    }, { status: 410 });
  }

  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "monitor-feedback-screenshot",
    limit: 12,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "画像を選び直してください。" }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension || file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ message: "画像はJPEG・PNG・WebP、1枚4MB以下にしてください。" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development" && process.env.MONITOR_E2E_MODE === "1") {
    return NextResponse.json({ storagePath: `monitor-feedback/e2e/${randomUUID()}.${extension}`, simulated: true });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ message: "現在、画像を保存できません。時間をおいて再度お試しください。" }, { status: 503 });
  }

  const month = new Date().toISOString().slice(0, 7);
  const storagePath = `monitor-feedback/${month}/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });

  if (error) {
    return NextResponse.json({ message: "画像を保存できませんでした。時間をおいて再度お試しください。" }, { status: 503 });
  }

  return NextResponse.json({ storagePath });
}
