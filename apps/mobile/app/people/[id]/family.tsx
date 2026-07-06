import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { createFamilyInvite, fetchFamilyMembers, type FamilyMember } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

export default function FamilyScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    fetchFamilyMembers(params.id).then(setMembers);
  }, [params.id]);

  async function invite() {
    setMessage("");
    setLimitReached(false);
    const result = await createFamilyInvite(params.id, email, relationship);

    if (result.limitReached) {
      setLimitReached(true);
      setMessage("3人目以降を招待するにはFamily Plusが必要です。");
      return;
    }

    if (result.error || !result.inviteUrl) {
      setMessage(result.error ?? "招待リンクを作成できませんでした。");
      return;
    }

    setInviteUrl(result.inviteUrl);
    setFallbackUrl(result.fallbackUrl ?? "");
    setMessage(result.source === "supabase" ? "招待リンクを作成しました。" : "見本用の招待リンクを作成しました。");
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    const fallbackText = fallbackUrl ? `\n開けない場合はこちら:\n${fallbackUrl}` : "";
    await Share.share({
      message: `親のもしもナビの家族ボードに招待されました。\n${inviteUrl}${fallbackText}`
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Family</Text>
        <Text style={styles.title}>家族共有</Text>
        <Text style={styles.body}>2名まで無料で招待できます。家族で担当と期限を見えるようにします。</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>家族を招待する</Text>
        <Text style={styles.label}>メールアドレス</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="family@example.com"
          style={styles.input}
          value={email}
        />
        <Text style={styles.label}>続柄メモ</Text>
        <TextInput
          onChangeText={setRelationship}
          placeholder="長女、弟、叔母など"
          style={styles.input}
          value={relationship}
        />
        <Pressable style={styles.button} onPress={invite}>
          <Text style={styles.buttonText}>招待リンクを作る</Text>
        </Pressable>
        {message ? <Text style={limitReached ? styles.upgradeText : styles.noticeText}>{message}</Text> : null}
        {limitReached ? (
          <Link href="/account/plan" style={styles.planLink}>利用状態を確認する</Link>
        ) : null}
        {inviteUrl ? (
          <>
            <Text style={styles.inviteUrl}>{inviteUrl}</Text>
            <Pressable style={styles.secondaryButton} onPress={shareInvite}>
              <Text style={styles.secondaryButtonText}>LINEやメールで送る</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>メンバー</Text>
        {members.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <Text style={styles.memberName}>{member.displayName}</Text>
            <Text style={styles.memberRole}>{member.isCurrentUser ? "自分" : member.role}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, justifyContent: "center", minHeight: 48 },
  buttonText: { color: "#fff", fontWeight: "900" },
  input: { backgroundColor: "#fff", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  inviteUrl: { backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.muted, lineHeight: 20, padding: 10 },
  label: { color: colors.ink, fontWeight: "900" },
  memberName: { color: colors.ink, fontWeight: "900" },
  memberRole: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  memberRow: { alignItems: "center", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 12 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 },
  planLink: { backgroundColor: colors.greenDark, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12, textAlign: "center" },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.ink, fontWeight: "900" },
  upgradeText: { color: colors.gold, fontWeight: "900", lineHeight: 22 },
  body: { color: colors.muted, lineHeight: 22 }
});
