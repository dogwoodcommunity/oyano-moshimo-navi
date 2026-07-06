import { Link } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");

export default function SettingsScreen() {
  function openPrivacyPolicy() {
    if (!webBaseUrl) return;
    void Linking.openURL(`${webBaseUrl}/legal/privacy`);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Settings</Text>
        <Text style={styles.title}>設定</Text>
        <Text style={styles.body}>通知、プライバシー、削除依頼など、安心して使うための確認をまとめます。</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>通知</Text>
        <Text style={styles.body}>期限が近い手続きと月1回の状況確認だけを、必要な時に受け取ります。</Text>
        <Link href="/notifications" style={styles.primaryLink}>通知設定を開く</Link>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>大事な情報の扱い</Text>
        <Text style={styles.body}>入院、認知症、死亡などの情報は慎重に扱います。暗証番号、パスワード、マイナンバー画像は保存しないでください。</Text>
        <Pressable style={styles.secondaryButton} onPress={openPrivacyPolicy} disabled={!webBaseUrl}>
          <Text style={styles.secondaryButtonText}>{webBaseUrl ? "プライバシーポリシーを見る" : "プライバシーポリシーURLは本番設定後に表示"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>アカウントと削除</Text>
        <Text style={styles.body}>登録情報、家族共有、写真、通知設定の削除依頼を受け付ける導線です。本番公開時に問い合わせ窓口とアプリ内削除導線を確定します。</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>テスト中に削除を希望する場合は、運営担当者へ「データ削除希望」と伝えてください。</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>プラン状態</Text>
        <Text style={styles.body}>現在の利用状態と発動サポートパックの状態を確認します。購入や外部サービスへの誘導はここでは行いません。</Text>
        <Link href="/account/plan" style={styles.primaryLink}>プラン確認を開く</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  primaryLink: { backgroundColor: colors.green, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12, textAlign: "center" },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.ink, fontWeight: "900", textAlign: "center" },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, padding: 12 },
  noticeText: { color: colors.greenDark, fontWeight: "800", lineHeight: 21 }
});
