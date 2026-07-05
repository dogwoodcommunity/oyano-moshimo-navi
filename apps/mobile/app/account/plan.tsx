import { StyleSheet, Text, View } from "react-native";

export default function AccountPlanScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>プラン確認</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Family Plus</Text>
        <Text style={styles.body}>家族共有、無制限登録、期限リマインド、写真容量拡張などのアプリ内デジタル機能はIAP前提で設計余地を残します。</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>発動サポートパック</Text>
        <Text style={styles.body}>Webで申し込み済みの場合、ここでは requested / paid / reviewing / report_ready などの状態表示のみ行います。</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", flex: 1, gap: 14, padding: 18 },
  title: { color: "#17211b", fontSize: 30, fontWeight: "900" },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 },
  cardTitle: { color: "#17211b", fontSize: 20, fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 }
});
