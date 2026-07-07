import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { statusLabel } from "@oyano/shared";
import { demoDashboardData, fetchDashboardData, type DashboardData } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

function dateOnly(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value?: string) {
  const due = dateOnly(value);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData>(demoDashboardData());
  const activeTasks = data.tasks.filter((task) => task.status !== "done" && task.status !== "skipped");
  const todayTasks = activeTasks.filter((task) => {
    const days = daysUntil(task.dueDate);
    return days !== null && days <= 0;
  });
  const soonTasks = activeTasks.filter((task) => {
    const days = daysUntil(task.dueDate);
    return days !== null && days > 0 && days <= 7;
  });
  const unassignedTasks = activeTasks.filter((task) => !task.assignedMemberId);

  useEffect(() => {
    fetchDashboardData().then(setData);
  }, []);

  if (data.source === "empty") {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>親のもしもナビ</Text>
          <Text style={styles.title}>家族ボード</Text>
          <Text style={styles.heroBody}>まだ対象者が登録されていません。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Webの整理結果を引き継ぐ</Text>
          <Text style={styles.body}>Webで状況整理を完了したあと、結果画面のアプリ引き継ぎリンクを開くと、家族ボードに対象者とタスクが表示されます。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>家族3組テストで確認すること</Text>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.body}>Webで状況を整理する</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.body}>結果画面からアプリへ引き継ぐ</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.body}>担当未定と期限通知を家族で確認する</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

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
            <Text style={styles.metricNumber}>{activeTasks.length}</Text>
            <Text style={styles.metricLabel}>未完了</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricNumber}>{unassignedTasks.length}</Text>
            <Text style={styles.metricLabel}>担当未定</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Link href={`/people/${data.person.id}`} style={styles.button}>対象者を見る</Link>
          <Link href={`/people/${data.person.id}/tasks`} style={styles.secondaryOnDark}>タスク</Link>
        </View>
      </View>
      <TaskSection
        accent="danger"
        empty="今日までの期限はありません。"
        href={`/people/${data.person.id}/tasks?filter=due`}
        tasks={todayTasks}
        title="今日・期限超過"
      />
      <TaskSection
        empty="7日以内の期限はありません。"
        href={`/people/${data.person.id}/tasks?filter=soon`}
        tasks={soonTasks}
        title="7日以内"
      />
      <TaskSection
        accent="warning"
        empty="担当未定のタスクはありません。"
        href={`/people/${data.person.id}/tasks?filter=unassigned`}
        tasks={unassignedTasks}
        title="担当未定"
      />
    </ScrollView>
  );
}

function TaskSection({
  accent,
  empty,
  href,
  tasks,
  title
}: {
  accent?: "danger" | "warning";
  empty: string;
  href: string;
  tasks: DashboardData["tasks"];
  title: string;
}) {
  const titleStyle = accent === "danger" ? styles.dangerTitle : accent === "warning" ? styles.warningTitle : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.cardTitle, titleStyle]}>{title}</Text>
        <Link href={href} style={styles.countBadge}>{tasks.length}</Link>
      </View>
      {tasks.slice(0, 3).map((task) => (
        <View key={task.id} style={styles.taskRow}>
          <View style={styles.taskText}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.body}>期限 {task.dueDate ?? "未設定"} / 担当 {task.assigneeLabel ?? "未定"}</Text>
          </View>
          {!task.assignedMemberId ? <Text style={styles.unassignedBadge}>担当未定</Text> : null}
        </View>
      ))}
      {tasks.length === 0 ? <Text style={styles.body}>{empty}</Text> : null}
      {tasks.length > 3 ? <Link href={href} style={styles.inlineLink}>他{tasks.length - 3}件を見る</Link> : null}
    </View>
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
  countBadge: { backgroundColor: colors.surfaceSoft, borderRadius: 999, color: colors.green, fontWeight: "900", minWidth: 34, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, textAlign: "center" },
  dangerTitle: { color: "#9a3f56" },
  inlineLink: { color: colors.blue, fontWeight: "900", marginTop: 2 },
  primaryTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  body: { color: colors.muted, flex: 1, lineHeight: 22 },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.control, flex: 1, padding: 12 },
  metricNumber: { color: "#fff", fontSize: 26, fontWeight: "900" },
  metricLabel: { color: "rgba(255,255,255,0.74)", fontWeight: "800" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: { backgroundColor: colors.green, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 },
  secondaryOnDark: { borderColor: "rgba(255,255,255,0.26)", borderRadius: radius.control, borderWidth: 1, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  stepRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  stepNumber: { backgroundColor: colors.surfaceSoft, borderRadius: 999, color: colors.green, fontWeight: "900", height: 28, lineHeight: 28, textAlign: "center", width: 28 },
  taskRow: { alignItems: "flex-start", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  taskText: { flex: 1, gap: 4 },
  taskTitle: { color: colors.ink, fontWeight: "900", lineHeight: 21 },
  unassignedBadge: { backgroundColor: "#fff7e8", borderColor: "rgba(165,111,36,0.24)", borderRadius: 999, borderWidth: 1, color: colors.gold, fontSize: 12, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 },
  warningTitle: { color: colors.gold }
});
