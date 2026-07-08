import { useState } from "react";
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

    setSubmitting(true);
    const result = await requestAccountDeletion({ contactEmail: contactEmail.trim(), reason: reason.trim() });
    setMessage(result.message);
    setSubmitting(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Account</Text>
        <Text style={styles.title}>アカウント削除依頼</Text>
        <Text style={styles.body}>
          家族共有、登録した写真、通知設定などの削除を希望する場合は、ここから運営に依頼できます。誤削除を避けるため、内容を確認し、原則30日以内に削除処理または継続確認の連絡を行います。
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>削除される可能性がある情報</Text>
        <Text style={styles.body}>登録者情報、家族ボード、親御さんの状況、タスク、写真、通知設定など。</Text>
        <Text style={styles.warning}>暗証番号、パスワード、マイナンバー画像は保存対象外です。もし入力してしまった場合は、理由欄にその旨を書いてください。</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>連絡先メール</Text>
        <TextInput
          autoCapitalize="none"
          inputMode="email"
          onChangeText={setContactEmail}
          placeholder="mail@example.com"
          style={styles.input}
          value={contactEmail}
        />
        <Text style={styles.label}>理由・補足</Text>
        <TextInput
          multiline
          onChangeText={setReason}
          placeholder="例: テスト利用が終わったため"
          style={[styles.input, styles.textarea]}
          value={reason}
        />
        <Pressable onPress={submit} style={[styles.button, submitting && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{submitting ? "送信中..." : "削除依頼を送信する"}</Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 8, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  body: { color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  warning: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.greenDark, fontWeight: "800", lineHeight: 21, padding: 12 },
  label: { color: colors.ink, fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, minHeight: 50, justifyContent: "center" },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "900" },
  message: { color: colors.greenDark, fontWeight: "800", lineHeight: 21 }
});
