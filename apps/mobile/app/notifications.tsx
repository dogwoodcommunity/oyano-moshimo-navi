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
        <Text style={styles.body}>毎日開くためではなく、必要な時に戻れるように通知します。</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>期限リマインド</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <Text style={styles.body}>法定期限や重要な手続きは、近づいた時だけまとめて通知します。同じ日の通知は1通にまとめます。</Text>
        <Pressable style={styles.button} onPress={register}><Text style={styles.buttonText}>この端末で通知を受け取る</Text></Pressable>
        {message ? <Text style={styles.noticeText}>{message}</Text> : null}
        {token ? <Text style={styles.body}>この端末の通知登録が完了しています。</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>月1回の確認</Text>
        <Text style={styles.body}>親御さんの状況に変化がないか、月1回だけ確認します。変化がなければ何もしなくて大丈夫です。</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>通知を切る前に</Text>
        <Text style={styles.body}>通知を切ると、期限が近い手続きや家族の更新に気づきにくくなります。不要な通知を増やさない設計にしています。</Text>
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
