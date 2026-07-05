import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { statusLabel } from "@oyano/shared";
import { demoDashboardData, fetchPerson, type MobilePerson } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

export default function PersonScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const fallback = demoDashboardData();
  const [person, setPerson] = useState<MobilePerson>(fallback.person);

  useEffect(() => {
    fetchPerson(params.id).then(setPerson);
  }, [params.id]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>対象者</Text>
        <Text style={styles.title}>{person.displayName}</Text>
      </View>
      <View style={[styles.card, styles.statusCard]}>
        <Text style={styles.kickerLight}>現在ステータス</Text>
        <Text style={styles.statusTitle}>{statusLabel(person.currentStatus)}</Text>
        <Text style={styles.bodyLight}>person id: {params.id}</Text>
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
        {fallback.registryItems.map((item) => <Text key={item} style={styles.body}>・{item}</Text>)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  statusCard: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  kicker: { color: colors.green, fontWeight: "900" },
  kickerLight: { color: "#cfe2d7", fontWeight: "900" },
  statusTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  bodyLight: { color: "rgba(255,255,255,0.7)", lineHeight: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontWeight: "900", minWidth: "46%", overflow: "hidden", padding: 16 }
});
