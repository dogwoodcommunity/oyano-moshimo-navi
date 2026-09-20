import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FREE_PLAN_MEMBER_LIMIT, FREE_PLAN_NOTEBOOK_LIMIT } from "@oyano/shared";
import { colors, radius, shadow } from "@/lib/theme";

const rows = [
  ["対象者の手帳", `${FREE_PLAN_NOTEBOOK_LIMIT}名分`],
  ["家族招待", `あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人まで`],
  ["日記", "文字で記録し、過去の内容を見返す"],
  ["確認リスト", "期限・進み具合・担当者の確認"],
  ["保管場所メモ", "書類などの存在と場所を記録"],
  ["AI相談", "1日1回無料。利用可否は相談画面で確認"]
];

export default function AccountPlanScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>利用案内</Text>
        <Text style={styles.title}>無料で利用できる範囲</Text>
        <Text style={styles.body}>日々の記録と家族での確認を、無料で始められます。ここでは提供する機能をご案内します。</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="clipboard-check-outline" size={23} />
          <Text style={styles.cardTitle}>無料の提供範囲</Text>
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
          <MaterialCommunityIcons color={colors.green} name="notebook-outline" size={23} />
          <Text style={styles.cardTitle}>記録を続けるために</Text>
        </View>
        <Text style={styles.body}>カード登録は必要ありません。家族で同じ手帳を見るには、メール確認と家族招待を済ませてください。</Text>
        <Text style={styles.body}>AI相談には、記録の保存設定と送信する内容への同意も必要です。今日の無料相談を使った後は、翌日0時からまた1回使えます。</Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>写真・PDFについて</Text>
        <Text style={styles.noticeText}>このアプリの日記では、写真・PDFファイルの添付はできません。ファイル名や保管場所を文字で残せます。</Text>
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
  notice: { backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, gap: 6, padding: 14 },
  noticeTitle: { color: colors.greenDark, fontSize: 18, fontWeight: "900" },
  noticeText: { color: "#6f532b", fontWeight: "800", lineHeight: 22 }
});
