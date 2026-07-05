import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { demoDashboardData, fetchTasks, updateTaskStatus, type MobileTask } from "@/lib/mobileData";

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
      <Text style={styles.title}>家族タスクボード</Text>
      {message ? <Text style={styles.body}>{message}</Text> : null}
      {columns.map(([label, tasks]) => (
        <View style={styles.card} key={label}>
          <Text style={styles.cardTitle}>{label}</Text>
          {tasks.map((task) => (
            <View style={styles.task} key={task.title}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.body}>期限: {task.dueDate} / 優先度: {task.priority}</Text>
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
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", gap: 14, padding: 18 },
  title: { color: "#17211b", fontSize: 30, fontWeight: "900" },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 12, padding: 16 },
  cardTitle: { color: "#17211b", fontSize: 22, fontWeight: "900" },
  task: { borderLeftColor: "#2f6f4e", borderLeftWidth: 4, gap: 6, paddingLeft: 12 },
  taskTitle: { color: "#17211b", fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  primaryButton: { backgroundColor: "#2f6f4e", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryButtonText: { color: "#17211b", fontWeight: "900" }
});
