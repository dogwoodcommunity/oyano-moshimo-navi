import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
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
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>通知設定</Text>
        <Text style={styles.title}>必要な時だけ知らせる</Text>
        <Text style={styles.body}>毎日開かせるためではなく、期限や家族の更新を見落とさないための通知です。</Text>
      </View>

      <View style={styles.digestBox}>
        <MaterialCommunityIcons color={colors.greenDark} name="bell-check-outline" size={26} />
        <View style={styles.digestText}>
          <Text style={styles.digestTitle}>通知はまとめて送ります</Text>
          <Text style={styles.body}>同じ日に複数の期限がある場合は、できるだけ1通にまとめます。通知を増やしすぎない方針です。</Text>
        </View>
      </View>

      <PreferenceCard
        body="法定期限や重要な手続きは、近づいた時だけ通知します。"
        disabled={isSaving}
        icon="calendar-clock"
        onChange={(value) => void updatePreferences({ remindersEnabled: value })}
        title="期限リマインド"
        value={enabled}
      />

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="cellphone-check" size={22} />
          <Text style={styles.cardTitle}>この端末で受け取る</Text>
        </View>
        <Text style={styles.body}>端末の通知許可を確認し、push tokenを保存します。</Text>
        <Pressable disabled={!enabled} style={[styles.button, !enabled ? styles.buttonDisabled : null]} onPress={register}>
          <Text style={styles.buttonText}>この端末で通知を受け取る</Text>
        </Pressable>
        {token ? <Text style={styles.body}>この端末の通知登録が完了しています。</Text> : null}
      </View>

      <PreferenceCard
        body="親御さんの状況に変化がないか、月1回だけ確認します。変化がなければ何もしなくて大丈夫です。"
        disabled={isSaving}
        icon="calendar-refresh-outline"
        onChange={(value) => void updatePreferences({ dailyDigestEnabled: value })}
        title="月1回の確認"
        value={monthlyEnabled}
      />

      <PreferenceCard
        body="法定期限に関わるものや、家族で早めに確認したい更新だけを残します。"
        disabled={isSaving}
        icon="alert-circle-outline"
        onChange={(value) => void updatePreferences({ urgentEnabled: value })}
        title="重要な連絡"
        value={urgentEnabled}
      />

      {message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}
    </ScrollView>
  );
}

function PreferenceCard({
  body,
  disabled,
  icon,
  onChange,
  title,
  value
}: {
  body: string;
  disabled: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onChange: (value: boolean) => void;
  title: string;
  value: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name={icon} size={22} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <Switch disabled={disabled} value={value} onValueChange={onChange} />
      </View>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 37 },
  digestBox: { alignItems: "flex-start", backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  digestText: { flex: 1, gap: 3 },
  digestTitle: { color: colors.greenDark, fontSize: 17, fontWeight: "900", lineHeight: 23 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  row: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  cardTitleRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  body: { color: colors.muted, lineHeight: 22 },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, padding: 12 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, justifyContent: "center", minHeight: 50 },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: "#fff", fontWeight: "900" }
});
