import { getSupabase } from "./supabase";

type DeleteAccountRequest = {
  contactEmail?: string;
  reason?: string;
};

export async function requestAccountDeletion(input: DeleteAccountRequest) {
  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!webBaseUrl) {
    return { ok: false, message: "削除依頼の送信先が設定されていません。" };
  }

  const session = await getSupabase()?.auth.getSession();
  const accessToken = session?.data.session?.access_token;

  if (!accessToken) {
    return { ok: false, message: "削除依頼にはログインが必要です。メールログイン後にもう一度お試しください。" };
  }

  try {
    const response = await fetch(`${webBaseUrl}/api/account/delete-request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contact_email: input.contactEmail,
        reason: input.reason
      })
    });

    if (!response.ok) {
      return { ok: false, message: "削除依頼を送信できませんでした。時間をおいてもう一度お試しください。" };
    }

    return { ok: true, message: "削除依頼を受け付けました。原則30日以内に削除処理または継続確認の連絡を行います。" };
  } catch {
    return { ok: false, message: "通信に失敗しました。時間をおいてもう一度お試しください。" };
  }
}
