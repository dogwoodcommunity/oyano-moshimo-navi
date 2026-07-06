import { useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { registerPushToken, saveTaskDueDates } from "@/lib/notifications";
import { demoResult } from "@/lib/demoData";
import { sendMagicLink } from "@/lib/auth";
import { consumeWebHandoff } from "@/lib/handoff";
import { colors, radius, shadow } from "@/lib/theme";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ caseId?: string; token?: string }>();
  const [email, setEmail] = useState("");
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function continueToApp() {
    if (email.trim()) {
      const result = await sendMagicLink(email.trim());
      setMessage(result.message);
      if (result.sent) return;
    }

    const userId = DEMO_USER_ID;
    const handoff = await consumeWebHandoff(params.caseId, params.token);
    if (handoff) {
      setMessage(`Web診断を引き継ぎました。タスク ${handoff.tasksCreated}件`);
    }
    const token = await registerPushToken(userId);
    setPushToken(token);
    await saveTaskDueDates(userId, demoResult.tasks.map((task, index) => ({ id: `demo-task-${index}`, title: task.title, dueDate: task.dueDate })));
    router.replace("/(tabs)/dashboard");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Web診断引き継ぎ</Text>
        <Text style={styles.title}>親のもしもナビ</Text>
        <Text style={styles.lead}>Magic Linkログイン後、Webの診断結果を家族ボードへ引き継ぎます。</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.label}>メール</Text>
        <TextInput autoCapitalize="none" inputMode="email" onChangeText={setEmail} placeholder="mail@example.com" style={styles.input} value={email} />
        <Text style={styles.privacyNote}>
          親の入院、認知症、死亡などの情報は慎重に扱う必要があります。本人に説明できる場合は説明したうえで、家族の支援に必要な範囲だけ保存してください。
        </Text>
        <Pressable onPress={continueToApp} style={styles.button}>
          <Text style={styles.buttonText}>ログインして引き継ぐ</Text>
        </Pressable>
        <Text style={styles.hint}>暗証番号、パスワード、マイナンバー画像は保存しないでください。</Text>
        <Text style={styles.hint}>caseId: {params.caseId ?? "demo"} / token: {params.token ?? "demo"}</Text>
        {message ? <Text style={styles.hint}>{message}</Text> : null}
        {pushToken ? <Text style={styles.hint}>push token saved: {pushToken}</Text> : null}
      </View>
      <View style={styles.demoCard}>
        <Text style={styles.demoTitle}>ローカル確認</Text>
        <Text style={styles.hint}>Supabase未設定でもデモデータで継続アプリの導線を確認できます。</Text>
        <Link href="/(tabs)/dashboard" style={styles.link}>デモでdashboardへ</Link>
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
