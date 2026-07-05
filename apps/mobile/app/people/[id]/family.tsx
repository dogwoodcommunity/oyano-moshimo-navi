import { StyleSheet, Text, View } from "react-native";

export default function FamilyScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>家族共有</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>招待リンク</Text>
        <Text style={styles.body}>`family_invites` と `share_links` へ接続する画面です。権限は owner/admin/member/viewer を想定します。</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>メンバー</Text>
        <Text style={styles.body}>長男 owner</Text>
        <Text style={styles.body}>長女 member</Text>
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
