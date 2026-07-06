import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

export default function PlanTab() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Plan</Text>
      <Text style={styles.title}>プラン</Text>
      <View style={[styles.card, styles.primaryCard]}>
        <Text style={styles.kickerLight}>現在の状態</Text>
        <Text style={styles.cardTitleLight}>Free</Text>
        <Text style={styles.bodyLight}>家族ボード、期限通知、写真管理、タイムライン、実家カルテをデモ状態で確認できます。</Text>
        <Link href="/account/plan" style={styles.linkLight}>詳細</Link>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>継続課金の扱い</Text>
        <Text style={styles.body}>この画面では現在の利用状態だけを表示します。購入や変更が必要な機能は、リリース時の審査方針に合わせて案内します。</Text>
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>発動サポートパックは申込済み・確認中・完了などの状態表示のみ行います。</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 14, padding: 18 },
  kicker: { color: colors.green, fontWeight: "900" },
  kickerLight: { color: "#cfe2d7", fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  primaryCard: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  cardTitleLight: { color: "#fff", fontSize: 22, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  bodyLight: { color: "rgba(255,255,255,0.72)", lineHeight: 22 },
  link: { color: colors.blue, fontWeight: "900" },
  linkLight: { color: "#fff", fontWeight: "900" },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, padding: 14 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 }
});
