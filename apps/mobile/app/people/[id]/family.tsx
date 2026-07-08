import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import {
  createFamilyInvite,
  fetchFamilyMembers,
  promoteFamilyMemberToOwner,
  type FamilyMember
} from "@/lib/mobileData";
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
  const [promotingMemberId, setPromotingMemberId] = useState<string | null>(null);
  const canManageFamily = members.some((member) => member.isCurrentUser && ["owner", "admin"].includes(member.role));
  const invitedFamilyCount = members.filter((member) => member.role !== "owner").length;
  const freeSlotsLeft = Math.max(0, 2 - invitedFamilyCount);

  useEffect(() => {
    fetchFamilyMembers(params.id).then(setMembers);
  }, [params.id]);

  async function invite() {
    setMessage("");
    setLimitReached(false);
    setInviteUrl("");
    setFallbackUrl("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage("招待する家族のメールアドレスを確認してください。");
      return;
    }

    const result = await createFamilyInvite(params.id, normalizedEmail, relationship);

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

  async function promote(member: FamilyMember) {
    setMessage("");
    setPromotingMemberId(member.id);
    const previousMembers = members;
    setMembers((currentMembers) =>
      currentMembers.map((currentMember) =>
        currentMember.id === member.id ? { ...currentMember, role: "owner" } : currentMember
      )
    );

    const result = await promoteFamilyMemberToOwner(member.id);
    setPromotingMemberId(null);

    if (result.error) {
      setMembers(previousMembers);
      setMessage(result.error);
      return;
    }

    const refreshedMembers = await fetchFamilyMembers(params.id);
    setMembers(refreshedMembers);
    setMessage("共同管理者にしました。もしもの時も家族ボードを引き継げます。");
  }

  function roleLabel(member: FamilyMember) {
    if (member.isCurrentUser) return member.role === "owner" ? "自分・共同管理者" : "自分";
    if (member.role === "owner") return "共同管理者";
    if (member.role === "admin") return "管理者";
    if (member.role === "viewer") return "閲覧";
    return "メンバー";
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.kicker}>家族共有</Text>
        <Text style={styles.title}>家族で同じボードを見る</Text>
        <Text style={styles.body}>担当、期限、写真、メモを家族で確認します。無料ではオーナー以外に2名まで招待できます。</Text>
      </View>

      <View style={styles.policyCard}>
        <View style={styles.policyIcon}>
          <MaterialCommunityIcons color={colors.greenDark} name="account-multiple-plus-outline" size={26} />
        </View>
        <View style={styles.policyText}>
          <Text style={styles.policyTitle}>無料招待枠</Text>
          <Text style={styles.body}>残り目安 {freeSlotsLeft}名。3人目以降や複数の親を管理する場合はFamily Plusで扱います。</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="send-outline" size={22} />
          <Text style={styles.cardTitle}>家族を招待する</Text>
        </View>
        <Text style={styles.label}>招待する家族のメールアドレス</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="family@example.com"
          placeholderTextColor="#8a958f"
          style={styles.input}
          value={email}
        />
        <Text style={styles.label}>続柄メモ</Text>
        <TextInput
          onChangeText={setRelationship}
          placeholder="長女、弟、叔母など"
          placeholderTextColor="#8a958f"
          style={styles.input}
          value={relationship}
        />
        <Pressable style={styles.button} onPress={invite}>
          <Text style={styles.buttonText}>招待リンクを作る</Text>
          <MaterialCommunityIcons color="#fff" name="arrow-right" size={19} />
        </Pressable>
        {message ? <Text style={limitReached ? styles.upgradeText : styles.noticeText}>{message}</Text> : null}
        {limitReached ? (
          <Link href="/account/plan" style={styles.planLink}>利用状態を確認する</Link>
        ) : null}
        {inviteUrl ? (
          <View style={styles.inviteBox}>
            <Text style={styles.inviteLabel}>送信用リンク</Text>
            <Text style={styles.inviteUrl}>{inviteUrl}</Text>
            <Pressable style={styles.secondaryButton} onPress={shareInvite}>
              <MaterialCommunityIcons color={colors.ink} name="share-variant-outline" size={18} />
              <Text style={styles.secondaryButtonText}>LINEやメールで送る</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="account-group-outline" size={22} />
          <Text style={styles.cardTitle}>メンバー</Text>
        </View>
        <Text style={styles.body}>
          家族代表が使えない時のため、信頼できる家族を共同管理者にできます。招待枠の判定では共同管理者も家族1名として数えます。
        </Text>
        {members.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.displayName.slice(0, 1)}</Text>
            </View>
            <View style={styles.memberText}>
              <Text style={styles.memberName}>{member.displayName}</Text>
              <Text style={styles.memberRole}>{roleLabel(member)}</Text>
            </View>
            {canManageFamily && !member.isCurrentUser && member.role !== "owner" ? (
              <Pressable
                disabled={promotingMemberId === member.id}
                onPress={() => promote(member)}
                style={({ pressed }) => [
                  styles.promoteButton,
                  (pressed || promotingMemberId === member.id) && styles.promoteButtonPressed
                ]}
              >
                <Text style={styles.promoteButtonText}>
                  {promotingMemberId === member.id ? "変更中" : "共同管理者"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 37 },
  policyCard: { alignItems: "flex-start", backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 },
  policyIcon: { alignItems: "center", backgroundColor: "#f4ead4", borderRadius: 999, height: 46, justifyContent: "center", width: 46 },
  policyText: { flex: 1, gap: 3 },
  policyTitle: { color: colors.greenDark, fontSize: 17, fontWeight: "900", lineHeight: 23 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50 },
  buttonText: { color: "#fff", fontWeight: "900" },
  input: { backgroundColor: "#fff", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  inviteBox: { backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 10 },
  inviteLabel: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  inviteUrl: { color: colors.muted, lineHeight: 20 },
  label: { color: colors.ink, fontWeight: "900" },
  avatar: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderRadius: 999, height: 42, justifyContent: "center", width: 42 },
  avatarText: { color: colors.greenDark, fontSize: 17, fontWeight: "900" },
  memberName: { color: colors.ink, fontWeight: "900" },
  memberRole: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  memberRow: { alignItems: "center", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 12 },
  memberText: { flex: 1, gap: 3 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 },
  planLink: { backgroundColor: colors.greenDark, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12, textAlign: "center" },
  promoteButton: { backgroundColor: colors.greenDark, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  promoteButtonPressed: { opacity: 0.65 },
  promoteButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.ink, fontWeight: "900" },
  upgradeText: { color: colors.gold, fontWeight: "900", lineHeight: 22 },
  body: { color: colors.muted, lineHeight: 22 }
});
