import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { sendMagicLink } from "@/lib/auth";
import { acceptFamilyInvite } from "@/lib/mobileData";
import { getSupabase } from "@/lib/supabase";
import { colors, radius, shadow } from "@/lib/theme";

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function accept() {
    if (submitting) return;
    setSubmitting(true);

    const session = await getSupabase()?.auth.getSession();
    if (!session?.data.session) {
      setMessage("参加するにはメールログインが必要です。メールアドレスを入力してください。");
      setSubmitting(false);
      return;
    }

    const result = await acceptFamilyInvite(token);
    setMessage(result.accepted ? "家族ボードに参加しました。" : result.error ?? "招待を受け取れませんでした。");
    setSubmitting(false);

    if (result.accepted) {
      router.replace("/(tabs)/dashboard");
    }
  }

  async function login() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    setSubmitting(true);
    const redirectPath = `/invite?token=${encodeURIComponent(token)}`;
    const result = await sendMagicLink(trimmedEmail, redirectPath);
    setMessage(result.message);
    setSubmitting(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Family Invite</Text>
        <Text style={styles.title}>家族ボードへの招待</Text>
        <Text style={styles.lead}>家族で同じタスク、期限、写真を確認できるようにします。</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>参加する</Text>
        <Text style={styles.body}>すでにログイン済みの場合は、そのまま参加できます。</Text>
        <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={accept}>
          <Text style={styles.buttonText}>{submitting ? "確認中..." : "招待を受け取る"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ログインが必要な場合</Text>
        <Text style={styles.body}>招待されたメールアドレスでログインしてください。</Text>
        <TextInput
          autoCapitalize="none"
          inputMode="email"
          onChangeText={setEmail}
          placeholder="mail@example.com"
          style={styles.input}
          value={email}
        />
        <Pressable style={styles.secondaryButton} onPress={login}>
          <Text style={styles.secondaryButtonText}>ログインメールを送る</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 14, padding: 18, paddingTop: 28 },
  hero: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 18 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  lead: { color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, minHeight: 50, justifyContent: "center" },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.ink, fontWeight: "900" },
  message: { color: colors.greenDark, fontWeight: "800", lineHeight: 22 }
});
