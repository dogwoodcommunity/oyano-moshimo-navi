import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { statusLabel } from "@oyano/shared";
import { demoDashboardData, fetchDashboardData, type DashboardData } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData>(demoDashboardData());
  const overdue = data.tasks.filter((task) => task.priority === 1).length;

  useEffect(() => {
    fetchDashboardData().then(setData);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>親のもしもナビ</Text>
        <Text style={styles.title}>家族ボード</Text>
        <Text style={styles.heroBody}>今日動くこと、あとで確認すること、家族で分けることを一画面にまとめます。</Text>
      </View>
      <View style={[styles.card, styles.primaryCard]}>
        <Text style={styles.kickerLight}>{statusLabel(data.person.currentStatus)}</Text>
        <Text style={styles.primaryTitle}>{data.person.displayName}</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricNumber}>{data.tasks.length}</Text>
            <Text style={styles.metricLabel}>未完了</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricNumber}>{overdue}</Text>
            <Text style={styles.metricLabel}>重要</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Link href={`/people/${data.person.id}`} style={styles.button}>対象者を見る</Link>
          <Link href={`/people/${data.person.id}/tasks`} style={styles.secondaryOnDark}>タスク</Link>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>今日やること</Text>
        {data.firstSteps.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.body}>{step}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  hero: { gap: 8, paddingTop: 8 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900", lineHeight: 38 },
  heroBody: { color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  primaryCard: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  kicker: { color: colors.green, fontWeight: "900" },
  kickerLight: { color: "#cfe2d7", fontWeight: "900" },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  primaryTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  body: { color: colors.muted, flex: 1, lineHeight: 22 },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.control, flex: 1, padding: 12 },
  metricNumber: { color: "#fff", fontSize: 26, fontWeight: "900" },
  metricLabel: { color: "rgba(255,255,255,0.74)", fontWeight: "800" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: { backgroundColor: colors.green, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 },
  secondaryOnDark: { borderColor: "rgba(255,255,255,0.26)", borderRadius: radius.control, borderWidth: 1, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 },
  stepRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  stepNumber: { backgroundColor: colors.surfaceSoft, borderRadius: 999, color: colors.green, fontWeight: "900", height: 28, lineHeight: 28, textAlign: "center", width: 28 }
});
