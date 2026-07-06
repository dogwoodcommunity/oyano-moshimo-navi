import * as Linking from "expo-linking";
import { getSupabase } from "./supabase";

export async function sendMagicLink(email: string) {
  const supabase = getSupabase();
  if (!supabase) {
    return { sent: false, demo: true, message: "ログイン準備中です。見本画面で確認できます。" };
  }

  const redirectTo = Linking.createURL("/(tabs)/dashboard");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo
    }
  });

  if (error) {
    return { sent: false, demo: false, message: error.message };
  }

  return { sent: true, demo: false, message: "Magic Linkを送信しました。メールを確認してください。" };
}
