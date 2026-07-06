import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { STATUSES, statusLabel, type ParentStatus } from "@oyano/shared";
import { demoPerson } from "@/lib/demoData";
import { fetchPerson, updatePersonStatus } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

export default function StatusScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<ParentStatus>(demoPerson.currentStatus);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPerson(params.id).then((person) => setStatus(person.currentStatus));
  }, [params.id]);

  async function save(nextStatus: ParentStatus) {
    const previousStatus = status;
    setStatus(nextStatus);
    const result = await updatePersonStatus(params.id, previousStatus, nextStatus);
    if (result.error) {
      setStatus(previousStatus);
      setMessage(`保存できませんでした: ${result.error}`);
      return;
    }

    const suffix = result.source === "supabase" ? "必要なタスクも更新されます。" : "見本の表示を更新しました。";
    setMessage(`${statusLabel(nextStatus)}に変更しました。${suffix}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Status</Text>
        <Text style={styles.title}>ステータス変更</Text>
        <Text style={styles.body}>状態を変えると、必要なタスクが自動で追加されます。</Text>
      </View>
      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>現在の状態</Text>
        <Text style={styles.currentTitle}>{statusLabel(status)}</Text>
      </View>
      {STATUSES.map((item) => (
        <Pressable key={item.key} onPress={() => save(item.key)} style={[styles.option, item.key === status && styles.active]}>
          <Text style={styles.optionText}>{item.label}</Text>
        </Pressable>
      ))}
      {message ? <View style={styles.card}><Text style={styles.body}>{message}</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 10, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  currentCard: { backgroundColor: colors.greenDark, borderRadius: radius.card, gap: 6, padding: 16, ...shadow },
  currentLabel: { color: "#cfe2d7", fontWeight: "900" },
  currentTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  option: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, justifyContent: "center", minHeight: 54, padding: 14 },
  active: { backgroundColor: colors.surfaceSoft, borderColor: colors.green, borderWidth: 2 },
  optionText: { color: colors.ink, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, padding: 16, ...shadow }
});
