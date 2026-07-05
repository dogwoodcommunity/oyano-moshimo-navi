import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { STATUSES, statusLabel, type ParentStatus } from "@oyano/shared";
import { demoPerson } from "@/lib/demoData";
import { fetchPerson, updatePersonStatus } from "@/lib/mobileData";

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

    const suffix = result.source === "supabase" ? "tasksも自動生成されます。" : "デモ表示で変更しました。";
    setMessage(`${statusLabel(nextStatus)}に変更しました。${suffix}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>ステータス変更</Text>
      <Text style={styles.body}>変更時に `person_status_events` を作成し、`task_templates` から `tasks` を生成します。</Text>
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
  screen: { backgroundColor: "#fbfcf7", gap: 10, padding: 18 },
  title: { color: "#17211b", fontSize: 30, fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 },
  option: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, minHeight: 50, justifyContent: "center", padding: 14 },
  active: { borderColor: "#2f6f4e", borderWidth: 2 },
  optionText: { color: "#17211b", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, padding: 16 }
});
