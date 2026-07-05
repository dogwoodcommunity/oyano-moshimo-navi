import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { registerPushToken } from "@/lib/notifications";

export default function NotificationsScreen() {
  const [enabled, setEnabled] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  async function register() {
    const nextToken = await registerPushToken("00000000-0000-4000-8000-000000000001");
    setToken(nextToken);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>通知設定</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>期限リマインド</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <Text style={styles.body}>push tokenは `push_tokens`、期限通知予定は `scheduled_notifications` に保存します。</Text>
        <Pressable style={styles.button} onPress={register}><Text style={styles.buttonText}>Push tokenを保存</Text></Pressable>
        {token ? <Text style={styles.body}>{token}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", flex: 1, gap: 14, padding: 18 },
  title: { color: "#17211b", fontSize: 30, fontWeight: "900" },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 12, padding: 16 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { color: "#17211b", fontSize: 20, fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 },
  button: { alignItems: "center", backgroundColor: "#2f6f4e", borderRadius: 8, minHeight: 48, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "800" }
});
