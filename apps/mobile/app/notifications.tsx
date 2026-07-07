import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { fetchNotificationPreferences, registerPushToken, saveNotificationPreferences } from "@/lib/notifications";
import { colors, radius, shadow } from "@/lib/theme";

export default function NotificationsScreen() {
  const [enabled, setEnabled] = useState(true);
  const [monthlyEnabled, setMonthlyEnabled] = useState(true);
  const [urgentEnabled, setUrgentEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchNotificationPreferences().then((preferences) => {
      setEnabled(preferences.remindersEnabled);
      setMonthlyEnabled(preferences.dailyDigestEnabled);
      setUrgentEnabled(preferences.urgentEnabled);
    });
  }, []);

  async function updatePreferences(next: {
    remindersEnabled?: boolean;
    dailyDigestEnabled?: boolean;
    urgentEnabled?: boolean;
  }) {
    const nextPreferences = {
      remindersEnabled: next.remindersEnabled ?? enabled,
      dailyDigestEnabled: next.dailyDigestEnabled ?? monthlyEnabled,
      urgentEnabled: next.urgentEnabled ?? urgentEnabled
    };

    setEnabled(nextPreferences.remindersEnabled);
    setMonthlyEnabled(nextPreferences.dailyDigestEnabled);
    setUrgentEnabled(nextPreferences.urgentEnabled);
    setIsSaving(true);

    const result = await saveNotificationPreferences(nextPreferences);
    setIsSaving(false);
    if (result.saved) {
      setMessage("通知設定を保存しました。");
      return;
    }

    setMessage(
      result.reason === "login_required"
        ? "通知設定の保存にはログインが必要です。"
        : "通知設定を保存できませんでした。時間をおいてもう一度お試しください。"
    );
  }

  async function register() {
    const result = await registerPushToken();
    setToken(result.token);
    if (result.saved) {
      setMessage("この端末で通知を受け取れるようにしました。");
      return;
    }

    const nextMessage =
      result.reason === "login_required"
        ? "通知登録にはログインが必要です。メールで本人確認をしてからもう一度お試しください。"
        : result.reason === "permission_denied"
          ? "通知が許可されていません。端末の通知設定を確認してください。"
          : "通知を有効にできませんでした。時間をおいてもう一度お試しください。";
    setMessage(nextMessage);
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
          <Switch disabled={isSaving} value={enabled} onValueChange={(value) => void updatePreferences({ remindersEnabled: value })} />
        </View>
        <Text style={styles.body}>法定期限や重要な手続きは、近づいた時だけまとめて通知します。同じ日の通知は1通にまとめます。</Text>
        <Pressable disabled={!enabled} style={[styles.button, !enabled ? styles.buttonDisabled : null]} onPress={register}><Text style={styles.buttonText}>この端末で通知を受け取る</Text></Pressable>
        {message ? <Text style={styles.noticeText}>{message}</Text> : null}
        {token ? <Text style={styles.body}>この端末の通知登録が完了しています。</Text> : null}
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>月1回の確認</Text>
          <Switch disabled={isSaving} value={monthlyEnabled} onValueChange={(value) => void updatePreferences({ dailyDigestEnabled: value })} />
        </View>
        <Text style={styles.body}>親御さんの状況に変化がないか、月1回だけ確認します。変化がなければ何もしなくて大丈夫です。</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>重要な連絡</Text>
          <Switch disabled={isSaving} value={urgentEnabled} onValueChange={(value) => void updatePreferences({ urgentEnabled: value })} />
        </View>
        <Text style={styles.body}>法定期限に関わるものや、家族で早めに確認したい更新だけを残します。不要な通知を増やさない設計にしています。</Text>
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
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: "#fff", fontWeight: "900" }
});
