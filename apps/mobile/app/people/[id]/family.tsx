import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

export default function FamilyScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Family</Text>
        <Text style={styles.title}>家族共有</Text>
        <Text style={styles.body}>役割と閲覧範囲を分けて、必要な人だけが確認できる状態にします。</Text>
      </View>
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
  screen: { backgroundColor: colors.paper, flex: 1, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 }
});
