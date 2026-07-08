import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

const rows = [
  ["現在のプラン", "Free"],
  ["親の登録", "1名"],
  ["家族招待", "オーナー以外2名まで"],
  ["期限通知", "基本通知あり"],
  ["写真", "10枚目安"],
  ["発動サポート", "状態表示のみ"]
];

export default function AccountPlanScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>プラン確認</Text>
        <Text style={styles.title}>利用状態の詳細</Text>
        <Text style={styles.body}>アプリ内では現在の状態だけを確認します。外部決済への案内は表示しません。</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="clipboard-check-outline" size={23} />
          <Text style={styles.cardTitle}>現在の状態</Text>
        </View>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="package-variant-closed" size={23} />
          <Text style={styles.cardTitle}>発動サポートパック</Text>
        </View>
        <Text style={styles.body}>受付済みの場合、ここでは「受付済み」「確認中」「レポート準備中」「完了」などの状態だけを表示します。</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>未申込または状態未取得</Text>
        </View>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>審査方針</Text>
        <Text style={styles.noticeText}>アプリ内にWeb申込や外部決済へのリンク、案内文言は置きません。デジタル機能の継続課金は将来IAPで扱う余地を残します。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  row: { borderBottomColor: "#edf1ed", borderBottomWidth: 1, gap: 4, paddingBottom: 10 },
  label: { color: colors.green, fontWeight: "900" },
  value: { color: colors.ink, fontWeight: "800", lineHeight: 22 },
  body: { color: colors.muted, lineHeight: 22 },
  statusPill: { alignSelf: "flex-start", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  statusPillText: { color: colors.greenDark, fontSize: 12, fontWeight: "900" },
  notice: { backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, gap: 6, padding: 14 },
  noticeTitle: { color: colors.greenDark, fontSize: 18, fontWeight: "900" },
  noticeText: { color: "#6f532b", fontWeight: "800", lineHeight: 22 }
});
