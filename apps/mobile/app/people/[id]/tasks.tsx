import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  demoDashboardData,
  fetchFamilyMembers,
  fetchTasks,
  updateTaskAssignee,
  updateTaskStatus,
  type FamilyMember,
  type MobileTask
} from "@/lib/mobileData";
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

function filterLabel(filter?: string) {
  if (filter === "due") return "今日・期限超過";
  if (filter === "soon") return "7日以内";
  if (filter === "unassigned") return "担当未定";
  return "すべて";
}

function matchesFilter(task: MobileTask, filter?: string) {
  if (!filter) return true;
  const days = daysUntil(task.dueDate);
  if (filter === "due") return days !== null && days <= 0 && task.status !== "done" && task.status !== "skipped";
  if (filter === "soon") return days !== null && days > 0 && days <= 7 && task.status !== "done" && task.status !== "skipped";
  if (filter === "unassigned") return !task.assignedMemberId && task.status !== "done" && task.status !== "skipped";
  return true;
}

export default function TasksScreen() {
  const params = useLocalSearchParams<{ id: string; filter?: string }>();
  const [tasks, setTasks] = useState<MobileTask[]>(demoDashboardData().tasks);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [message, setMessage] = useState("");
  const [assigneeTask, setAssigneeTask] = useState<MobileTask | null>(null);

  useEffect(() => {
    fetchTasks(params.id).then(setTasks);
    fetchFamilyMembers(params.id).then(setMembers);
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

    setMessage(result.source === "supabase" ? "タスクを更新しました。" : "見本の表示を更新しました。");
  }

  async function assignTask(task: MobileTask, member: FamilyMember | null) {
    const previousTasks = tasks;
    const nextMemberId = member?.id ?? null;
    setAssigneeTask(null);
    setTasks((items) => items.map((item) => item.id === task.id ? {
      ...item,
      assignedMemberId: nextMemberId,
      assigneeLabel: member?.displayName
    } : item));

    const result = await updateTaskAssignee(task.id, nextMemberId);

    if (result.error) {
      setTasks(previousTasks);
      setMessage(`担当を保存できませんでした: ${result.error}`);
      return;
    }

    setMessage(nextMemberId ? `${member?.displayName}を担当にしました。` : "担当未定に戻しました。");
  }

  const selfMember = members.find((member) => member.isCurrentUser) ?? members[0] ?? null;
  const filteredTasks = tasks.filter((task) => matchesFilter(task, params.filter));
  const columns = [
    ["未着手", filteredTasks.filter((task) => task.status === "todo")],
    ["進行中", filteredTasks.filter((task) => task.status === "doing")],
    ["完了", filteredTasks.filter((task) => task.status === "done")]
  ] as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Family tasks</Text>
        <Text style={styles.title}>家族タスクボード</Text>
        <Text style={styles.lead}>期限と状態を見ながら、家族で動くことを分けていきます。</Text>
        <View style={styles.filterPill}>
          <Text style={styles.filterPillText}>表示: {filterLabel(params.filter)}</Text>
        </View>
      </View>
      {message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNumber}>{filteredTasks.filter((task) => task.status !== "done").length}</Text>
          <Text style={styles.summaryLabel}>未完了</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNumber}>{filteredTasks.filter((task) => task.status !== "done" && !task.assignedMemberId).length}</Text>
          <Text style={styles.summaryLabel}>担当未定</Text>
        </View>
      </View>
      {filteredTasks.length === 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>この条件に当てはまるタスクはありません。</Text>
        </View>
      ) : null}
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
                <Pressable
                  style={[styles.assigneeChip, !task.assignedMemberId ? styles.unassignedChip : null]}
                  onPress={() => setAssigneeTask(task)}
                >
                  <Text style={[styles.assigneeChipText, !task.assignedMemberId ? styles.unassignedChipText : null]}>
                    {task.assigneeLabel ?? "担当未定"}
                  </Text>
                </Pressable>
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
      <Modal animationType="slide" onRequestClose={() => setAssigneeTask(null)} transparent visible={Boolean(assigneeTask)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>担当者を選ぶ</Text>
            <Text style={styles.sheetBody}>{assigneeTask?.title}</Text>
            {selfMember ? (
              <Pressable style={styles.sheetPrimary} onPress={() => assigneeTask && assignTask(assigneeTask, selfMember)}>
                <Text style={styles.sheetPrimaryText}>自分が担当する</Text>
              </Pressable>
            ) : null}
            {members.map((member) => (
              <Pressable style={styles.sheetOption} key={member.id} onPress={() => assigneeTask && assignTask(assigneeTask, member)}>
                <Text style={styles.sheetOptionText}>{member.displayName}</Text>
                <Text style={styles.sheetOptionHint}>{member.isCurrentUser ? "自分" : member.role}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sheetOption} onPress={() => assigneeTask && assignTask(assigneeTask, null)}>
              <Text style={styles.unassignedOptionText}>未割当に戻す</Text>
              <Text style={styles.sheetOptionHint}>誰がやるか未定にします</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setAssigneeTask(null)}>
              <Text style={styles.sheetCancelText}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 36 },
  lead: { color: colors.muted, lineHeight: 22 },
  filterPill: { alignSelf: "flex-start", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  filterPillText: { color: colors.green, fontSize: 12, fontWeight: "900" },
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
  assigneeChip: { backgroundColor: colors.surfaceSoft, borderColor: "rgba(39,100,71,0.2)", borderRadius: 999, borderWidth: 1, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  assigneeChipText: { color: colors.green, fontSize: 12, fontWeight: "900" },
  body: { color: colors.muted, lineHeight: 22 },
  emptyText: { color: colors.muted, lineHeight: 22 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  primaryButton: { backgroundColor: colors.green, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryButtonText: { color: colors.ink, fontWeight: "900" },
  modalBackdrop: { backgroundColor: "rgba(24,35,31,0.32)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 10, padding: 18 },
  sheetBody: { color: colors.muted, lineHeight: 22 },
  sheetCancel: { alignItems: "center", minHeight: 48, justifyContent: "center" },
  sheetCancelText: { color: colors.muted, fontWeight: "900" },
  sheetOption: { alignItems: "center", backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingHorizontal: 14 },
  sheetOptionHint: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  sheetOptionText: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  sheetPrimary: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, justifyContent: "center", minHeight: 52 },
  sheetPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  sheetTitle: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  unassignedChip: { backgroundColor: "#fff7e8", borderColor: "rgba(165,111,36,0.24)" },
  unassignedChipText: { color: colors.gold },
  unassignedOptionText: { color: colors.gold, fontSize: 16, fontWeight: "900" }
});
