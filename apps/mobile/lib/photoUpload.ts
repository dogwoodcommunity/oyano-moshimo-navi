import { getSupabase } from "./supabase";

export type HomePhotoUploadRequest = {
  homeId: string;
  storagePath: string;
  bytes: ArrayBuffer;
  contentType: string;
};

export async function uploadHomePhoto({ storagePath, bytes, contentType }: HomePhotoUploadRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return { uploaded: false, message: "写真の保存準備ができていません。設定後にもう一度お試しください。" };
  }

  const { error } = await supabase.storage
    .from("home-photos")
    .upload(storagePath, bytes, {
      contentType,
      upsert: false
    });

  if (error) {
    return { uploaded: false, message: error.message };
  }

  return { uploaded: true, message: "写真をアップロードしました。" };
}
