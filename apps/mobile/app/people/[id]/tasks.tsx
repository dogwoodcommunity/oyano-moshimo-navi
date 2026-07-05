import { ScrollView, StyleSheet, Text, View } from "react-native";
import { demoResult } from "@/lib/demoData";

export default function TasksScreen() {
  const columns = [
    ["未着手", demoResult.tasks.filter((_, index) => index % 3 === 0)],
    ["進行中", demoResult.tasks.filter((_, index) => index % 3 === 1)],
    ["完了", demoResult.tasks.filter((_, index) => index % 3 === 2)]
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
              <Text style={styles.body}>{task.description}</Text>
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
