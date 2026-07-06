import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { demoDashboardData, fetchTasks, updateTaskStatus, type MobileTask } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

export default function TasksScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [tasks, setTasks] = useState<MobileTask[]>(demoDashboardData().tasks);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchTasks(params.id).then(setTasks);
  }, [params.id]);

  async function moveTask(task: MobileTask, status: MobileTask["status"]) {
    const previousTasks = tasks;
    setTasks((items) => items.map((item) => item.id === task.id ? { ...item, status } : item));
    const result = await updateTaskStatus(task.id, status);

    if (result.error) {
      setTasks(previousTasks);
      setMessage(`保存できませんでした: ${result.error}`);
      return;
    }

    setMessage(result.source === "supabase" ? "タスクを更新しました。" : "デモ表示で更新しました。");
  }

  const columns = [
    ["未着手", tasks.filter((task) => task.status === "todo")],
    ["進行中", tasks.filter((task) => task.status === "doing")],
    ["完了", tasks.filter((task) => task.status === "done")]
  ] as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Family tasks</Text>
        <Text style={styles.title}>家族タスクボード</Text>
        <Text style={styles.lead}>期限と状態を見ながら、家族で動くことを分けていきます。</Text>
      </View>
      {message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNumber}>{tasks.filter((task) => task.status !== "done").length}</Text>
          <Text style={styles.summaryLabel}>未完了</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNumber}>{tasks.filter((task) => task.priority === 1).length}</Text>
          <Text style={styles.summaryLabel}>重要</Text>
        </View>
      </View>
      {columns.map(([label, columnTasks]) => (
        <View style={styles.card} key={label}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{label}</Text>
            <Text style={styles.countBadge}>{columnTasks.length}</Text>
          </View>
          {columnTasks.map((task) => (
            <View style={styles.task} key={task.title}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaChip}>期限 {task.dueDate ?? "未設定"}</Text>
                <Text style={styles.metaChip}>優先度 {task.priority}</Text>
              </View>
              <Text style={styles.body}>{task.description ?? ""}</Text>
              <View style={styles.actions}>
                {task.status !== "doing" ? (
                  <Pressable style={styles.secondaryButton} onPress={() => moveTask(task, "doing")}>
                    <Text style={styles.secondaryButtonText}>進行中</Text>
                  </Pressable>
                ) : null}
                {task.status !== "done" ? (
                  <Pressable style={styles.primaryButton} onPress={() => moveTask(task, "done")}>
                    <Text style={styles.primaryButtonText}>完了</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {columnTasks.length === 0 ? <Text style={styles.emptyText}>ここにはまだタスクがありません。</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 36 },
  lead: { color: colors.muted, lineHeight: 22 },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, padding: 12 },
  noticeText: { color: colors.green, fontWeight: "900" },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryBox: { backgroundColor: colors.greenDark, borderRadius: radius.card, flex: 1, padding: 14 },
  summaryNumber: { color: "#fff", fontSize: 26, fontWeight: "900" },
  summaryLabel: { color: "rgba(255,255,255,0.72)", fontWeight: "800" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  countBadge: { backgroundColor: colors.surfaceSoft, borderRadius: 999, color: colors.green, fontWeight: "900", minWidth: 28, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, textAlign: "center" },
  task: { backgroundColor: "#fbfdf9", borderColor: colors.line, borderLeftColor: colors.green, borderLeftWidth: 4, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 12 },
  taskTitle: { color: colors.ink, fontWeight: "900", lineHeight: 21 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, color: colors.muted, fontSize: 12, fontWeight: "800", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  body: { color: colors.muted, lineHeight: 22 },
  emptyText: { color: colors.muted, lineHeight: 22 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  primaryButton: { backgroundColor: colors.green, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryButtonText: { color: colors.ink, fontWeight: "900" }
});
