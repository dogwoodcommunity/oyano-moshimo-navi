import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

export default function PlanTab() {
  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>プラン</Text>
        <Text style={styles.title}>現在の利用状態</Text>
        <Text style={styles.body}>この画面は、現在使える範囲とサポート状態の確認用です。</Text>
      </View>

      <View style={styles.currentCard}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color="#fff" name="account-heart-outline" size={24} />
          <Text style={styles.cardTitleLight}>Free</Text>
        </View>
        <Text style={styles.bodyLight}>親1名、家族招待2名まで、基本の期限通知と家族ボードを使えます。</Text>
        <View style={styles.usageRow}>
          <UsageItem label="親の登録" value="1名" />
          <UsageItem label="家族招待" value="2名まで" />
          <UsageItem label="写真" value="10枚目安" />
        </View>
        <Link href="/account/plan" style={styles.linkLight}>詳しい状態を見る</Link>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="account-group-outline" size={23} />
          <Text style={styles.cardTitle}>Family Plusで扱う範囲</Text>
        </View>
        <Feature text="複数の親を管理する" />
        <Feature text="家族招待を増やす" />
        <Feature text="写真容量と履歴を増やす" />
        <Feature text="家族会議用PDFを出す" />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>発動サポートパック</Text>
        <Text style={styles.noticeText}>アプリでは受付済み・確認中・完了などの状態だけを表示します。購入導線は置きません。</Text>
      </View>
    </ScrollView>
  );
}

function UsageItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.usageItem}>
      <Text style={styles.usageValue}>{value}</Text>
      <Text style={styles.usageLabel}>{label}</Text>
    </View>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <MaterialCommunityIcons color={colors.greenDark} name="check-circle-outline" size={18} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 37 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  currentCard: { backgroundColor: colors.greenDark, borderColor: colors.greenDark, borderRadius: radius.card, borderWidth: 1, gap: 13, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  cardTitleLight: { color: "#fff", flex: 1, fontSize: 24, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  bodyLight: { color: "rgba(255,255,255,0.78)", lineHeight: 22 },
  linkLight: { borderColor: "rgba(255,255,255,0.28)", borderRadius: radius.control, borderWidth: 1, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12, textAlign: "center" },
  usageRow: { flexDirection: "row", gap: 8 },
  usageItem: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.control, flex: 1, padding: 10 },
  usageValue: { color: "#fff", fontSize: 17, fontWeight: "900", lineHeight: 23 },
  usageLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "800" },
  featureRow: { alignItems: "center", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, padding: 10 },
  featureText: { color: colors.ink, flex: 1, fontWeight: "800", lineHeight: 20 },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 6, padding: 14 },
  noticeTitle: { color: colors.greenDark, fontSize: 18, fontWeight: "900" },
  noticeText: { color: colors.greenDark, fontWeight: "800", lineHeight: 22 }
});
