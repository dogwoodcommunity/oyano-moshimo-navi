import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { registerPushToken } from "@/lib/notifications";
import { colors, radius, shadow } from "@/lib/theme";

export default function NotificationsScreen() {
  const [enabled, setEnabled] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function register() {
    const nextToken = await registerPushToken("00000000-0000-4000-8000-000000000001");
    setToken(nextToken);
    setMessage(nextToken ? "Push tokenを保存しました。" : "Push tokenを取得できませんでした。通知権限またはEAS projectIdを確認してください。");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Notifications</Text>
        <Text style={styles.title}>通知設定</Text>
        <Text style={styles.body}>期限が近いタスクを、家族が見落とさないようにします。</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>期限リマインド</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <Text style={styles.body}>push tokenは `push_tokens`、期限通知予定は `scheduled_notifications` に保存します。</Text>
        <Pressable style={styles.button} onPress={register}><Text style={styles.buttonText}>Push tokenを保存</Text></Pressable>
        {message ? <Text style={styles.noticeText}>{message}</Text> : null}
        {token ? <Text style={styles.body}>{token}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, justifyContent: "center", minHeight: 48 },
  buttonText: { color: "#fff", fontWeight: "900" }
});
