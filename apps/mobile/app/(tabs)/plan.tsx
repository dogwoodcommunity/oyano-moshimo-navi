import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FREE_PLAN_MEMBER_LIMIT, FREE_PLAN_NOTEBOOK_LIMIT } from "@oyano/shared";
import { colors, radius, shadow } from "@/lib/theme";

export default function PlanTab() {
  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>利用案内</Text>
        <Text style={styles.title}>まずは無料の手帳から</Text>
        <Text style={styles.body}>日々の記録と家族での確認に使える、無料の提供範囲をご案内します。</Text>
      </View>

      <View style={styles.currentCard}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color="#fff" name="account-heart-outline" size={24} />
          <Text style={styles.cardTitleLight}>無料で使えること</Text>
        </View>
        <Text style={styles.bodyLight}>対象者{FREE_PLAN_NOTEBOOK_LIMIT}名の手帳、あなたのほかに{FREE_PLAN_MEMBER_LIMIT}人までの家族招待、日々の記録と確認リストを使えます。カード登録は必要ありません。</Text>
        <Link href="/account/plan" style={styles.linkLight}>利用できる範囲を見る</Link>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="account-group-outline" size={23} />
          <Text style={styles.cardTitle}>アプリでできること</Text>
        </View>
        <Feature text="今日の様子を日記に残し、過去の記録を読む" />
        <Feature text="確認リストの進み具合と担当者を整理する" />
        <Feature text="大切な書類の存在と保管場所をメモする" />
        <Feature text="招待した家族と同じ手帳を確認する" />
        <Feature text="記録をもとに、1日1回無料でAI相談する" />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>AI相談を使うには</Text>
        <Text style={styles.noticeText}>メール確認と記録の保存設定、送信する内容への同意が必要です。その日の利用可否は相談画面で確認できます。</Text>
      </View>
    </ScrollView>
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
  featureRow: { alignItems: "center", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, padding: 10 },
  featureText: { color: colors.ink, flex: 1, fontWeight: "800", lineHeight: 20 },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 6, padding: 14 },
  noticeTitle: { color: colors.greenDark, fontSize: 18, fontWeight: "900" },
  noticeText: { color: colors.greenDark, fontWeight: "800", lineHeight: 22 }
});
