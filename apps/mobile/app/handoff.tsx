import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { sendMagicLink } from "@/lib/auth";
import { consumeWebHandoff } from "@/lib/handoff";
import { getSupabase } from "@/lib/supabase";
import { colors, radius, shadow } from "@/lib/theme";

export default function HandoffScreen() {
  const params = useLocalSearchParams<{ caseId?: string; token?: string }>();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("Webの整理結果をアプリに保存します。");
  const [isLoading, setIsLoading] = useState(false);
  const consumedRef = useRef(false);

  const caseId = typeof params.caseId === "string" ? params.caseId : undefined;
  const token = typeof params.token === "string" ? params.token : undefined;
  const hasHandoff = Boolean(caseId && token);

  const consume = useCallback(async () => {
    if (!hasHandoff || consumedRef.current) return;

    consumedRef.current = true;
    setIsLoading(true);
    setMessage("保存しています。");

    const result = await consumeWebHandoff(caseId, token);
    setIsLoading(false);

    if (!result || result.error === "login_required") {
      consumedRef.current = false;
      setMessage("メールで本人確認をすると、整理結果を保存できます。");
      return;
    }

    if (result.error || !result.personId) {
      consumedRef.current = false;
      setMessage("保存できませんでした。時間をおいてもう一度お試しください。");
      return;
    }

    setMessage(`保存しました。タスク ${result.tasksCreated}件を家族ボードに追加しました。`);
    router.replace(`/people/${result.personId}/tasks`);
  }, [caseId, hasHandoff, token]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void consume();
      else setMessage("メールで本人確認をすると、整理結果を保存できます。");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void consume();
    });

    return () => listener.subscription.unsubscribe();
  }, [consume]);

  async function sendLoginLink() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    setIsLoading(true);
    const redirectPath = `/handoff?${new URLSearchParams({ caseId: caseId ?? "", token: token ?? "" }).toString()}`;
    const result = await sendMagicLink(trimmedEmail, redirectPath);
    setIsLoading(false);
    setMessage(result.sent ? "メールを送りました。届いたリンクを開くと保存が続きます。" : result.message);
  }

  if (!hasHandoff) {
    return (
      <View style={styles.screen}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>アプリ引き継ぎ</Text>
          <Text style={styles.title}>リンクを確認できませんでした</Text>
          <Text style={styles.body}>Webの結果画面から、もう一度「アプリに保存する」を開いてください。</Text>
          <Pressable onPress={() => router.replace("/(tabs)/dashboard")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>家族ボードへ戻る</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>アプリに保存</Text>
        <Text style={styles.title}>Webの整理結果を家族ボードへ</Text>
        <Text style={styles.body}>期限のあるタスク、担当未定の確認、あとで見るメモをアプリに引き継ぎます。</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>メール</Text>
        <TextInput
          autoCapitalize="none"
          inputMode="email"
          onChangeText={setEmail}
          placeholder="mail@example.com"
          style={styles.input}
          value={email}
        />
        <Pressable disabled={isLoading} onPress={sendLoginLink} style={[styles.button, isLoading && styles.disabledButton]}>
          <Text style={styles.buttonText}>本人確認メールを送る</Text>
        </Pressable>
        <Pressable disabled={isLoading} onPress={consume} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>ログイン済みなので保存する</Text>
        </Pressable>
        <Text style={styles.note}>親の病気・入院・死亡に関する情報は、家族の支援に必要な範囲だけ保存してください。</Text>
      </View>

      <View style={styles.statusBox}>
        {isLoading ? <ActivityIndicator color={colors.green} /> : null}
        <Text style={styles.statusText}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 16, padding: 22, paddingTop: 72 },
  hero: { gap: 10 },
  panel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  body: { color: colors.muted, lineHeight: 22 },
  label: { color: colors.ink, fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, minHeight: 48, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "900" },
  disabledButton: { opacity: 0.6 },
  secondaryButton: { alignItems: "center", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, minHeight: 46, justifyContent: "center" },
  secondaryButtonText: { color: colors.green, fontWeight: "900" },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  statusBox: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  statusText: { color: colors.greenDark, flex: 1, fontWeight: "800", lineHeight: 20 }
});
