import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { requestAccountDeletion } from "@/lib/account";
import { colors, radius, shadow } from "@/lib/theme";

export default function AccountDeleteScreen() {
  const [contactEmail, setContactEmail] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;

    const normalizedEmail = contactEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage("連絡先メールアドレスを確認してください。");
      return;
    }

    setSubmitting(true);
    const result = await requestAccountDeletion({ contactEmail: normalizedEmail, reason: reason.trim() });
    setMessage(result.message);
    setSubmitting(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.kicker}>削除依頼</Text>
        <Text style={styles.title}>アカウントと家族データの削除</Text>
        <Text style={styles.body}>
          家族共有、登録した写真、通知設定などの削除を希望する場合は、ここから運営に依頼できます。
        </Text>
      </View>

      <View style={styles.timelineCard}>
        <MaterialCommunityIcons color={colors.greenDark} name="calendar-check-outline" size={25} />
        <View style={styles.timelineText}>
          <Text style={styles.timelineTitle}>原則30日以内に確認します</Text>
          <Text style={styles.body}>誤削除を避けるため、内容確認後に削除処理または継続確認の連絡を行います。</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.rose} name="delete-alert-outline" size={23} />
          <Text style={styles.cardTitle}>削除される可能性がある情報</Text>
        </View>
        <ChecklistItem text="登録者情報、家族ボード、家族共有" />
        <ChecklistItem text="親御さんの状況、タスク、期限通知" />
        <ChecklistItem text="写真、実家カルテ、保管場所メモ" />
        <ChecklistItem text="通知設定、push token" />
      </View>

      <View style={styles.warningBox}>
        <MaterialCommunityIcons color={colors.gold} name="shield-alert-outline" size={24} />
        <Text style={styles.warningText}>暗証番号、パスワード、マイナンバー画像は保存対象外です。もし入力してしまった場合は、理由欄にその旨を書いてください。</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>連絡先メール</Text>
        <TextInput
          autoCapitalize="none"
          inputMode="email"
          onChangeText={setContactEmail}
          placeholder="mail@example.com"
          placeholderTextColor="#8a958f"
          style={styles.input}
          value={contactEmail}
        />
        <Text style={styles.label}>理由・補足</Text>
        <TextInput
          multiline
          onChangeText={setReason}
          placeholder="例: テスト利用が終わったため"
          placeholderTextColor="#8a958f"
          style={[styles.input, styles.textarea]}
          value={reason}
        />
        <Pressable onPress={submit} style={[styles.button, submitting && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{submitting ? "送信中" : "削除依頼を送信する"}</Text>
          <MaterialCommunityIcons color="#fff" name="send-outline" size={19} />
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <View style={styles.checkRow}>
      <MaterialCommunityIcons color={colors.greenDark} name="check-circle-outline" size={18} />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 8, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  body: { color: colors.muted, lineHeight: 22 },
  timelineCard: { alignItems: "flex-start", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  timelineText: { flex: 1, gap: 3 },
  timelineTitle: { color: colors.greenDark, fontSize: 17, fontWeight: "900", lineHeight: 23 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  checkRow: { alignItems: "center", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, padding: 10 },
  checkText: { color: colors.ink, flex: 1, fontWeight: "800", lineHeight: 20 },
  warningBox: { alignItems: "flex-start", backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 13 },
  warningText: { color: "#6f532b", flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 20 },
  label: { color: colors.ink, fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, flexDirection: "row", gap: 8, minHeight: 50, justifyContent: "center" },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "900" },
  message: { color: colors.greenDark, fontWeight: "800", lineHeight: 21 }
});
