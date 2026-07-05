import { useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { registerPushToken, saveTaskDueDates } from "@/lib/notifications";
import { demoResult } from "@/lib/demoData";
import { sendMagicLink } from "@/lib/auth";
import { consumeWebHandoff } from "@/lib/handoff";

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
      <Text style={styles.kicker}>Web診断引き継ぎ</Text>
      <Text style={styles.title}>親のもしもナビ</Text>
      <Text style={styles.lead}>Magic Linkログイン後、Webの診断結果を家族ボードへ引き継ぎます。</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>メール</Text>
        <TextInput autoCapitalize="none" inputMode="email" onChangeText={setEmail} placeholder="mail@example.com" style={styles.input} value={email} />
        <Pressable onPress={continueToApp} style={styles.button}>
          <Text style={styles.buttonText}>ログインして引き継ぐ</Text>
        </Pressable>
        <Text style={styles.hint}>caseId: {params.caseId ?? "demo"} / token: {params.token ?? "demo"}</Text>
        {message ? <Text style={styles.hint}>{message}</Text> : null}
        {pushToken ? <Text style={styles.hint}>push token saved: {pushToken}</Text> : null}
      </View>
      <Link href="/(tabs)/dashboard" style={styles.link}>デモでdashboardへ</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", flex: 1, gap: 16, padding: 22, paddingTop: 72 },
  kicker: { color: "#2f6f4e", fontWeight: "800" },
  title: { color: "#17211b", fontSize: 38, fontWeight: "900" },
  lead: { color: "#647067", fontSize: 16, lineHeight: 24 },
  panel: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 12, padding: 16 },
  label: { color: "#17211b", fontWeight: "800" },
  input: { borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, minHeight: 46, padding: 12 },
  button: { alignItems: "center", backgroundColor: "#2f6f4e", borderRadius: 8, minHeight: 48, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "800" },
  hint: { color: "#647067", fontSize: 12, lineHeight: 18 },
  link: { color: "#315f8f", fontWeight: "800" }
});
