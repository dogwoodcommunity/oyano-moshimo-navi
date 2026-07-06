import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

export default function AccountPlanScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Billing policy</Text>
      <Text style={styles.title}>プラン確認</Text>
      <View style={[styles.card, styles.primaryCard]}>
        <Text style={styles.cardTitleLight}>Family Plus</Text>
        <Text style={styles.bodyLight}>家族共有、無制限登録、期限リマインド、写真容量拡張などのアプリ内デジタル機能はIAP前提で設計余地を残します。</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>発動サポートパック</Text>
        <Text style={styles.body}>Webで申し込み済みの場合、ここでは requested / paid / reviewing / report_ready などの状態表示のみ行います。</Text>
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>アプリ内には外部決済CTAを置きません。Web/Stripeの商品導線とは明確に分離します。</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 14, padding: 18 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  primaryCard: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  cardTitleLight: { color: "#fff", fontSize: 20, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  bodyLight: { color: "rgba(255,255,255,0.72)", lineHeight: 22 },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, padding: 14 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 }
});
