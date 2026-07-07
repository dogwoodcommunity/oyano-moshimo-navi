import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { demoResult } from "@/lib/demoData";
import { sendMagicLink } from "@/lib/auth";
import { consumeWebHandoff } from "@/lib/handoff";
import { colors, radius, shadow } from "@/lib/theme";

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ caseId?: string; token?: string }>();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const hasHandoff = Boolean(params.caseId && params.token && params.caseId !== "demo" && params.token !== "demo");

  async function continueToApp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    if (email.trim()) {
      const result = await sendMagicLink(trimmedEmail);
      setMessage(result.message);
      if (result.sent) return;
    }

    const handoff = await consumeWebHandoff(params.caseId, params.token);
    if (handoff) {
      setMessage(`Web診断を引き継ぎました。タスク ${handoff.tasksCreated}件`);
    }
    router.replace("/(tabs)/dashboard");
  }

  async function continueDemo() {
    setMessage(`見本で開きます。確認用タスク ${demoResult.tasks.length}件を表示します。`);
    router.replace("/(tabs)/dashboard");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>{hasHandoff ? "Webの整理結果を引き継ぎ" : "家族ボードへログイン"}</Text>
        <Text style={styles.title}>親のもしもナビ</Text>
        <Text style={styles.lead}>メールで本人確認をして、家族で見るタスク・期限・写真を安全に引き継ぎます。</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.label}>メール</Text>
        <TextInput autoCapitalize="none" inputMode="email" onChangeText={setEmail} placeholder="mail@example.com" style={styles.input} value={email} />
        <Text style={styles.privacyNote}>
          親の入院、認知症、死亡などの情報は慎重に扱う必要があります。本人に説明できる場合は説明したうえで、家族の支援に必要な範囲だけ保存してください。
        </Text>
        <Pressable onPress={continueToApp} style={styles.button}>
          <Text style={styles.buttonText}>{hasHandoff ? "ログインして引き継ぐ" : "ログインする"}</Text>
        </Pressable>
        <Text style={styles.hint}>暗証番号、パスワード、マイナンバー画像は保存しないでください。</Text>
        {message ? <Text style={styles.hint}>{message}</Text> : null}
      </View>
      <View style={styles.demoCard}>
        <Text style={styles.demoTitle}>まず見本を見る</Text>
        <Text style={styles.hint}>登録前に、家族ボードの見え方だけ確認できます。入力内容は保存されません。</Text>
        <Pressable onPress={continueDemo}>
          <Text style={styles.link}>見本で開く</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 16, padding: 22, paddingTop: 72 },
  hero: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 18 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 38, fontWeight: "900", lineHeight: 42 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  panel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  label: { color: colors.ink, fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  privacyNote: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.greenDark, fontSize: 12, fontWeight: "800", lineHeight: 19, padding: 10 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, minHeight: 48, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "900" },
  demoCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 14 },
  demoTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  link: { color: colors.blue, fontWeight: "900" }
});
