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

export default function HomeChartScreen() {
  const params = useLocalSearchParams<{ id: string }>();

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
        <Text style={styles.body}>玄関、各部屋、重要書類の棚、メーター周りなどを撮っておくと、離れて暮らす家族も状況を確認しやすくなります。</Text>
        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>写真を残す前に</Text>
          <Text style={styles.body}>表札、住所、鍵番号、郵便物、車のナンバーが写らないようにしてください。外観写真は空き家だと分かる形では残さず、必要な部分だけ撮るのがおすすめです。</Text>
          <Text style={styles.body}>位置情報つきの写真は、端末側で位置情報を削除してから保存してください。</Text>
        </View>
        <Link href={`/people/${params.id}/assets`} style={styles.link}>保管場所メモを追加する</Link>
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>保存しないもの</Text>
        <Text style={styles.body}>銀行暗証番号、各種パスワード、マイナンバー画像は登録しないでください。ここでは「存在」と「場所」だけを残します。</Text>
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
  link: { color: colors.blue, fontWeight: "900" },
  safetyBox: { backgroundColor: "#fffaf0", borderColor: "#ead8b8", borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 12 },
  safetyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 16 },
  noticeTitle: { color: colors.greenDark, fontSize: 18, fontWeight: "900" },
  row: { borderBottomColor: "#edf1ed", borderBottomWidth: 1, gap: 4, paddingBottom: 10 },
  label: { color: colors.green, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 }
});
