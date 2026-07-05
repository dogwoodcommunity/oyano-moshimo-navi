import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { statusLabel } from "@oyano/shared";
import { demoPerson, demoResult } from "@/lib/demoData";

export default function DashboardScreen() {
  const overdue = demoResult.tasks.filter((task) => task.priority === 1).length;
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>家族ボード</Text>
      <View style={styles.card}>
        <Text style={styles.kicker}>{statusLabel(demoPerson.currentStatus)}</Text>
        <Text style={styles.cardTitle}>{demoPerson.displayName}</Text>
        <Text style={styles.body}>未完了タスク {demoResult.tasks.length}件 / 重要 {overdue}件</Text>
        <View style={styles.row}>
          <Link href={`/people/${demoPerson.id}`} style={styles.button}>対象者を見る</Link>
          <Link href={`/people/${demoPerson.id}/tasks`} style={styles.secondary}>タスク</Link>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>今日やること</Text>
        {demoResult.firstSteps.map((step) => <Text key={step} style={styles.body}>・{step}</Text>)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", gap: 14, padding: 18 },
  title: { color: "#17211b", fontSize: 32, fontWeight: "900" },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 },
  kicker: { color: "#2f6f4e", fontWeight: "800" },
  cardTitle: { color: "#17211b", fontSize: 22, fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: { backgroundColor: "#2f6f4e", borderRadius: 8, color: "#fff", fontWeight: "800", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 },
  secondary: { borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, color: "#17211b", fontWeight: "800", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 }
});
