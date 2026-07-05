import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function PlanTab() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>プラン</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Free</Text>
        <Text style={styles.body}>Family Plusなどアプリ内デジタル機能の継続課金はIAP対応余地を残しています。</Text>
        <Text style={styles.body}>発動サポートパックは購入済み・レビュー中などの状態表示のみ。アプリ内にWeb決済CTAは置きません。</Text>
        <Link href="/account/plan" style={styles.link}>詳細</Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", flex: 1, gap: 14, padding: 18 },
  title: { color: "#17211b", fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 },
  cardTitle: { color: "#17211b", fontSize: 22, fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 },
  link: { color: "#315f8f", fontWeight: "800" }
});
