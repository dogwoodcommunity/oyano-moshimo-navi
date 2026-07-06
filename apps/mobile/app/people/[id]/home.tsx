import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

const rows = [
  ["物件種別", "戸建て"],
  ["空き家状況", "近日空き家"],
  ["鍵", "長男が保管"],
  ["ライフライン", "電気・水道は契約中"],
  ["家財量", "多い"],
  ["方針", "売却・管理・解体は未定"]
];

export default function HomeChartScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Home chart</Text>
        <Text style={styles.title}>実家カルテ</Text>
        <Text style={styles.body}>鍵、ライフライン、家財量、方針を家族で見える化します。</Text>
      </View>
      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <View style={styles.row} key={label}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.body}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>写真管理</Text>
        <Text style={styles.body}>`home_photos` と Supabase Storage へ接続する枠です。MVPでは撮影・アップロード導線の入口をここに集約します。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  row: { borderBottomColor: "#edf1ed", borderBottomWidth: 1, gap: 4, paddingBottom: 10 },
  label: { color: colors.green, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 }
});
