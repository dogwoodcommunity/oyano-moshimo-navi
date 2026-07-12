import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ImageBackground, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { statusLabel } from "@oyano/shared";
import { demoDashboardData, fetchDashboardData, type DashboardData } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");

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

function dueLabel(value?: string) {
  const days = daysUntil(value);
  if (days === null) return "期限未設定";
  if (days < 0) return `${Math.abs(days)}日超過`;
  if (days === 0) return "今日まで";
  return `${days}日後`;
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

  function openWebStart() {
    if (!webBaseUrl) return;
    void Linking.openURL(`${webBaseUrl}/start`);
  }

  if (data.source === "empty") {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={[styles.card, styles.emptyHero]}>
          <Text style={styles.kickerLight}>はじめに</Text>
          <Text style={styles.emptyTitle}>まずWebで状況を整理します</Text>
          <Text style={styles.emptyLead}>
            親御さんの状況を選ぶと、期限のある手続きと家族で分けることがまとまります。保存すると、この家族ボードに表示されます。
          </Text>
          <Pressable disabled={!webBaseUrl} onPress={openWebStart} style={[styles.emptyButton, !webBaseUrl && styles.buttonDisabled]}>
            <Text style={styles.emptyButtonText}>Webで5分整理を始める</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>すでにWebで整理した場合</Text>
          <Text style={styles.body}>結果画面の「アプリに保存する」を開いてください。本人確認のあと、対象者とタスクがこの画面に入ります。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>このアプリで続けること</Text>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.body}>期限が近い手続きを確認する</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.body}>担当未定のタスクを家族で分ける</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.body}>通知、写真、メモを必要な時だけ見返す</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <ImageBackground
        imageStyle={styles.heroImage}
        resizeMode="cover"
        source={require("../../assets/onboarding-family-home.png")}
        style={styles.hero}
      >
        <View style={styles.heroShade} />
        <View style={styles.brandRow}>
          <Text style={styles.kicker}>家族ボード</Text>
          <Text style={styles.statusBadge}>{statusLabel(data.person.currentStatus)}</Text>
        </View>
        <Text style={styles.title}>{data.person.displayName}さんの今</Text>
        <Text style={styles.heroBody}>期限、担当、家族で確認したいことを、必要な時に戻れる形で残します。</Text>
      </ImageBackground>

      <View style={styles.boardSummary}>
        <View style={styles.summaryHeader}>
          <MaterialCommunityIcons color={colors.greenDark} name="clipboard-text-clock-outline" size={24} />
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>今日見るところ</Text>
            <Text style={styles.summaryLead}>急ぎ、期限前、担当未定だけを先に確認します。</Text>
          </View>
        </View>
        <View style={styles.metrics}>
          <View style={[styles.metric, todayTasks.length > 0 ? styles.metricAlert : null]}>
            <Text style={styles.metricNumber}>{todayTasks.length}</Text>
            <Text style={styles.metricLabel}>今日まで</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricNumber}>{soonTasks.length}</Text>
            <Text style={styles.metricLabel}>7日以内</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricNumber}>{unassignedTasks.length}</Text>
            <Text style={styles.metricLabel}>担当未定</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Link href={`/people/${data.person.id}/tasks`} style={styles.button}>タスクを開く</Link>
          <Link href={`/people/${data.person.id}`} style={styles.secondaryButton}>対象者を見る</Link>
        </View>
      </View>
      <TaskSection
        accent="danger"
        empty="今日までの期限はありません。"
        href={`/people/${data.person.id}/tasks?filter=due`}
        icon="alert-circle-outline"
        tasks={todayTasks}
        title="今日・期限超過"
      />
      <TaskSection
        empty="7日以内の期限はありません。"
        href={`/people/${data.person.id}/tasks?filter=soon`}
        icon="calendar-clock"
        tasks={soonTasks}
        title="7日以内"
      />
      <TaskSection
        accent="warning"
        empty="担当未定のタスクはありません。"
        href={`/people/${data.person.id}/tasks?filter=unassigned`}
        icon="account-question-outline"
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
  icon,
  tasks,
  title
}: {
  accent?: "danger" | "warning";
  empty: string;
  href: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tasks: DashboardData["tasks"];
  title: string;
}) {
  const titleStyle = accent === "danger" ? styles.dangerTitle : accent === "warning" ? styles.warningTitle : undefined;
  const iconColor = accent === "danger" ? colors.rose : accent === "warning" ? colors.gold : colors.green;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons color={iconColor} name={icon} size={22} />
          <Text style={[styles.cardTitle, titleStyle]}>{title}</Text>
        </View>
        <Link href={href} style={styles.countBadge}>{tasks.length}</Link>
      </View>
      {tasks.slice(0, 3).map((task) => (
        <View key={task.id} style={styles.taskRow}>
          <View style={styles.taskText}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.body}>{dueLabel(task.dueDate)} / 担当 {task.assigneeLabel ?? "未定"}</Text>
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
  screen: { backgroundColor: colors.paper, gap: 14, padding: 16, paddingBottom: 28 },
  hero: { borderRadius: 18, gap: 10, minHeight: 240, justifyContent: "flex-end", overflow: "hidden", padding: 18, ...shadow },
  heroImage: { borderRadius: 18 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,35,28,0.26)" },
  brandRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { color: "#fffdf7", fontSize: 34, fontWeight: "900", lineHeight: 39, textShadowColor: "rgba(0,0,0,0.18)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  heroBody: { color: "rgba(255,253,247,0.92)", fontWeight: "700", lineHeight: 23, textShadowColor: "rgba(0,0,0,0.16)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  kicker: { backgroundColor: "rgba(255,253,247,0.92)", borderRadius: 999, color: colors.greenDark, fontWeight: "900", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5 },
  kickerLight: { color: "#cfe2d7", fontWeight: "900" },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  countBadge: { backgroundColor: colors.surfaceSoft, borderRadius: 999, color: colors.green, fontWeight: "900", minWidth: 34, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, textAlign: "center" },
  dangerTitle: { color: "#9a3f56" },
  inlineLink: { color: colors.blue, fontWeight: "900", marginTop: 2 },
  body: { color: colors.muted, flex: 1, lineHeight: 22 },
  boardSummary: { backgroundColor: colors.surface, borderColor: "#d3c7b3", borderRadius: 14, borderWidth: 1, gap: 14, padding: 16, ...shadow },
  summaryHeader: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  summaryText: { flex: 1, gap: 3 },
  summaryTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 28 },
  summaryLead: { color: colors.muted, lineHeight: 22 },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { backgroundColor: "#f6f1e6", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flex: 1, padding: 10 },
  metricAlert: { backgroundColor: "#fff1f3", borderColor: "rgba(154,63,86,0.24)" },
  metricNumber: { color: colors.greenDark, fontSize: 26, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: { backgroundColor: colors.green, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 },
  buttonDisabled: { opacity: 0.5 },
  emptyButton: { alignItems: "center", backgroundColor: "#fff", borderRadius: radius.control, justifyContent: "center", minHeight: 50, paddingHorizontal: 14, paddingVertical: 12 },
  emptyButtonText: { color: colors.greenDark, fontWeight: "900" },
  emptyHero: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  emptyLead: { color: "rgba(255,255,255,0.82)", fontSize: 16, lineHeight: 24 },
  emptyTitle: { color: "#fff", fontSize: 31, fontWeight: "900", lineHeight: 36 },
  secondaryButton: { borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.greenDark, fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  stepRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  stepNumber: { backgroundColor: colors.surfaceSoft, borderRadius: 999, color: colors.green, fontWeight: "900", height: 28, lineHeight: 28, textAlign: "center", width: 28 },
  statusBadge: { backgroundColor: "rgba(21,59,43,0.78)", borderColor: "rgba(255,255,255,0.32)", borderRadius: 999, borderWidth: 1, color: "#fff", fontSize: 12, fontWeight: "900", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5 },
  taskRow: { alignItems: "flex-start", backgroundColor: "#fffdf7", borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  taskText: { flex: 1, gap: 4 },
  taskTitle: { color: colors.ink, fontWeight: "900", lineHeight: 21 },
  unassignedBadge: { backgroundColor: "#fff7e8", borderColor: "rgba(165,111,36,0.24)", borderRadius: 999, borderWidth: 1, color: colors.gold, fontSize: 12, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 },
  warningTitle: { color: colors.gold }
});
