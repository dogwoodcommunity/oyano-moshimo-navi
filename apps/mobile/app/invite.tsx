import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { sendMagicLink } from "@/lib/auth";
import { acceptFamilyInvite } from "@/lib/mobileData";
import { getSupabase } from "@/lib/supabase";
import { colors, radius, shadow } from "@/lib/theme";

export default function InviteScreen() {
  const focusedRef = useRef(false);
  const requestRef = useRef<object | null>(null);
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    requestRef.current = null;
    setSubmitting(false);
    return () => {
      focusedRef.current = false;
      requestRef.current = null;
    };
  }, [token]));

  async function accept() {
    if (!focusedRef.current || requestRef.current) return;
    const request = {};
    requestRef.current = request;
    setSubmitting(true);
    let session;
    try { session = await getSupabase()?.auth.getSession(); }
    catch {
      if (focusedRef.current && requestRef.current === request) {
        requestRef.current = null;
        setSubmitting(false);
        setMessage("ログイン状態を確認できませんでした。もう一度お試しください。");
      }
      return;
    }
    if (!focusedRef.current || requestRef.current !== request) return;
    if (!session?.data.session) {
      requestRef.current = null;
      setMessage("参加するにはメールログインが必要です。メールアドレスを入力してください。");
      setSubmitting(false);
      return;
    }

    let result;
    try { result = await acceptFamilyInvite(token); }
    catch {
      if (focusedRef.current && requestRef.current === request) {
        requestRef.current = null;
        setSubmitting(false);
        setMessage("招待を確認できませんでした。もう一度お試しください。");
      }
      return;
    }
    if (!focusedRef.current || requestRef.current !== request) return;
    requestRef.current = null;
    setMessage(result.accepted ? "共有された手帳に参加しました。" : result.error ?? "招待を受け取れませんでした。");
    setSubmitting(false);

    if (result.accepted) {
      router.replace("/(tabs)/dashboard");
    }
  }

  async function login() {
    if (!focusedRef.current || requestRef.current) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    const request = {};
    requestRef.current = request;
    setSubmitting(true);
    const redirectPath = `/invite?token=${encodeURIComponent(token)}`;
    const result = await sendMagicLink(trimmedEmail, redirectPath).catch(() => ({ message: "本人確認を始められませんでした。もう一度お試しください。", redirectPath: undefined }));
    if (!focusedRef.current || requestRef.current !== request) return;
    requestRef.current = null;
    setMessage(result.message);
    setSubmitting(false);
    if (result.redirectPath) router.replace(result.redirectPath);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Family Invite</Text>
        <Text style={styles.title}>共有された手帳への招待</Text>
        <Text style={styles.lead}>追加課金なしで、同じタスク、期限、写真を一緒に確認できます。</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>参加する</Text>
        <Text style={styles.body}>手帳を作った人の家族プランに参加します。あなたが別で支払う必要はありません。</Text>
        <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={accept}>
          <Text style={styles.buttonText}>{submitting ? "確認中..." : "共有手帳に参加する"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ログインが必要な場合</Text>
        <Text style={styles.body}>招待されたメールアドレスでログインしてください。別の支払い手続きはありません。</Text>
        <TextInput
          autoCapitalize="none"
          inputMode="email"
          onChangeText={setEmail}
          placeholder="mail@example.com"
          style={styles.input}
          value={email}
        />
        <Pressable disabled={submitting} style={[styles.secondaryButton, submitting && styles.buttonDisabled]} onPress={login}>
          <Text style={styles.secondaryButtonText}>安全確認をしてメールを送る</Text>
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
