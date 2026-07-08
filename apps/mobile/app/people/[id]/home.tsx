import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
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

const photoTargets = [
  "玄関と鍵まわり",
  "重要書類の棚",
  "電気・水道・ガスメーター",
  "各部屋の家財量"
];

export default function HomeChartScreen() {
  const params = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>実家カルテ</Text>
        <Text style={styles.title}>離れていても状況が分かるように</Text>
        <Text style={styles.body}>鍵、ライフライン、家財量、方針を家族で共有します。写真は必要な場所だけ、個人情報が写らない形で残します。</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <MaterialCommunityIcons color={colors.greenDark} name="home-city-outline" size={28} />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle}>まず確認すること</Text>
          <Text style={styles.body}>鍵、ライフライン、家財量、重要書類の場所。売却や解体の判断はここでは断定しません。</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="clipboard-list-outline" size={22} />
          <Text style={styles.cardTitle}>現在のメモ</Text>
        </View>
        {rows.map(([label, value]) => (
          <View style={styles.row} key={label}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="camera-outline" size={22} />
          <Text style={styles.cardTitle}>写真で残す場所</Text>
        </View>
        <Text style={styles.body}>遠方の家族が判断しやすくなる場所だけ撮ります。表札、住所、郵便物、車のナンバーは写さないでください。</Text>
        <View style={styles.photoGrid}>
          {photoTargets.map((target) => (
            <View key={target} style={styles.photoTarget}>
              <MaterialCommunityIcons color={colors.greenDark} name="check-circle-outline" size={18} />
              <Text style={styles.photoTargetText}>{target}</Text>
            </View>
          ))}
        </View>
        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>写真を残す前に</Text>
          <Text style={styles.body}>空き家だと分かる外観写真は避けてください。位置情報つきの写真は、端末側で位置情報を削除してから保存してください。</Text>
        </View>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>保存しないもの</Text>
        <Text style={styles.body}>銀行暗証番号、各種パスワード、マイナンバー画像は登録しないでください。ここでは「存在」と「場所」だけを残します。</Text>
      </View>

      <Link href={`/people/${params.id}/assets`} style={styles.primaryLink}>保管場所メモを追加する</Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 37 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  summaryCard: { alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 12, padding: 16, ...shadow },
  summaryIcon: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderRadius: 999, height: 48, justifyContent: "center", width: 48 },
  summaryText: { flex: 1, gap: 4 },
  summaryTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  primaryLink: { backgroundColor: colors.green, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 14, textAlign: "center" },
  safetyBox: { backgroundColor: "#fffaf0", borderColor: "#ead8b8", borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 12 },
  safetyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 16 },
  noticeTitle: { color: colors.greenDark, fontSize: 18, fontWeight: "900" },
  row: { borderBottomColor: "#edf1ed", borderBottomWidth: 1, gap: 4, paddingBottom: 10 },
  label: { color: colors.green, fontWeight: "900" },
  value: { color: colors.ink, fontWeight: "800", lineHeight: 22 },
  photoGrid: { gap: 8 },
  photoTarget: { alignItems: "center", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, padding: 10 },
  photoTargetText: { color: colors.ink, flex: 1, fontWeight: "800", lineHeight: 20 },
  body: { color: colors.muted, lineHeight: 22 }
});
