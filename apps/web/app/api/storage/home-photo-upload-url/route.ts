import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error: "legacy_home_photo_upload_retired",
      message: "この写真アップロード機能は終了しました。現在の手帳画面の「写真を追加」からアップロードしてください。",
      currentEndpoint: "/api/notebook/photo-upload-url"
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
