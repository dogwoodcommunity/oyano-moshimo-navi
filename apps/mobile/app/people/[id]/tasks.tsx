import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { demoDashboardData, fetchTasks, type MobileTask } from "@/lib/mobileData";

export default function TasksScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [tasks, setTasks] = useState<MobileTask[]>(demoDashboardData().tasks);

  useEffect(() => {
    fetchTasks(params.id).then(setTasks);
  }, [params.id]);

  const columns = [
    ["未着手", tasks.filter((task) => task.status === "todo")],
    ["進行中", tasks.filter((task) => task.status === "doing")],
    ["完了", tasks.filter((task) => task.status === "done")]
  ] as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>家族タスクボード</Text>
      {columns.map(([label, tasks]) => (
        <View style={styles.card} key={label}>
          <Text style={styles.cardTitle}>{label}</Text>
          {tasks.map((task) => (
            <View style={styles.task} key={task.title}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.body}>期限: {task.dueDate} / 優先度: {task.priority}</Text>
              <Text style={styles.body}>{task.description ?? ""}</Text>
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
  body: { color: "#344039", lineHeight: 22 }
});
