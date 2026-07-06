import { ScrollView, StyleSheet, Text, View } from "react-native";
import { demoTimeline } from "@/lib/demoData";
import { colors, radius, shadow } from "@/lib/theme";

export default function TimelineScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Timeline</Text>
        <Text style={styles.title}>タイムライン</Text>
        <Text style={styles.body}>家族が確認したこと、状態変更、相談メモを時系列で残します。</Text>
      </View>
      {demoTimeline.map((item) => (
        <View style={styles.card} key={item.id}>
          <Text style={styles.kicker}>{item.date}</Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 16, ...shadow },
  kicker: { color: colors.green, fontWeight: "900" },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 }
});
