import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { statusLabel } from "@oyano/shared";
import { demoPerson, demoResult } from "@/lib/demoData";

export default function PersonScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{demoPerson.displayName}</Text>
      <View style={styles.card}>
        <Text style={styles.kicker}>現在ステータス</Text>
        <Text style={styles.cardTitle}>{statusLabel(demoPerson.currentStatus)}</Text>
        <Text style={styles.body}>person id: {params.id}</Text>
      </View>
      <View style={styles.grid}>
        <Link href={`/people/${params.id}/status`} style={styles.tile}>状態変更</Link>
        <Link href={`/people/${params.id}/tasks`} style={styles.tile}>タスク</Link>
        <Link href={`/people/${params.id}/assets`} style={styles.tile}>情報登録</Link>
        <Link href={`/people/${params.id}/timeline`} style={styles.tile}>タイムライン</Link>
        <Link href={`/people/${params.id}/home`} style={styles.tile}>実家カルテ</Link>
        <Link href={`/people/${params.id}/family`} style={styles.tile}>家族共有</Link>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>未登録情報</Text>
        {demoResult.registryItems.map((item) => <Text key={item} style={styles.body}>・{item}</Text>)}
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, color: "#17211b", fontWeight: "800", minWidth: "46%", overflow: "hidden", padding: 16 }
});
