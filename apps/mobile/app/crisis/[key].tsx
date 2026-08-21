import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { CRISIS_EMERGENCY_NOTE, CRISIS_SAFETY_NOTE, getCrisisScenario } from "@oyano/shared";
import { trackFunnel } from "@/lib/funnel";
import { addTimelineEntry, fetchDashboardData, type MobilePerson } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

const PROGRESS_KEY = "oyano_crisis_progress_v01";

type SaveState = "idle" | "saving" | "saved" | "no-person" | "error";

export default function CrisisScenarioScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const key = typeof params.key === "string" ? params.key : "";
  const scenario = useMemo(() => getCrisisScenario(key), [key]);

  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [people, setPeople] = useState<MobilePerson[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(PROGRESS_KEY);
        const progress = raw ? JSON.parse(raw) as Record<string, string[]> : {};
        if (mounted) setDoneIds(progress[key] ?? []);
      } catch {
        if (mounted) setDoneIds([]);
      }

      try {
        const data = await fetchDashboardData();
        if (mounted) setPeople(data.people);
      } catch {
        if (mounted) setPeople([]);
      }
    }

    void load();
    void trackFunnel("crisis_opened");
    return () => { mounted = false; };
  }, [key]);

  const toggleStep = useCallback(async (stepId: string) => {
    setSaveState("idle");
    setDoneIds((previous) => {
      const next = previous.includes(stepId)
        ? previous.filter((item) => item !== stepId)
        : [...previous, stepId];

      void AsyncStorage.getItem(PROGRESS_KEY)
        .then((raw) => {
          const progress = raw ? JSON.parse(raw) as Record<string, string[]> : {};
          return AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...progress, [key]: next }));
        })
        .catch(() => null);

      return next;
    });
  }, [key]);

  if (!scenario) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>この状況は見つかりませんでした。</Text>
        <Link asChild href="/crisis">
          <Pressable style={styles.missingButton}>
            <Text style={styles.missingButtonText}>状況を選び直す</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const allSteps = scenario.groups.flatMap((group) => group.steps);
  const nowSteps = scenario.groups.find((group) => group.key === "now")?.steps ?? [];
  const nowDone = nowSteps.filter((step) => doneIds.includes(step.id)).length;
  const activePerson = people[0];

  async function shareTemplate() {
    if (!scenario) return;
    try {
      await Share.share({ message: scenario.messageTemplate });
    } catch {
      // 共有シートを閉じただけの場合も含むため、ここでは何も表示しない。
    }
  }

  async function saveToTimeline() {
    if (!scenario) return;
    if (!activePerson) {
      setSaveState("no-person");
      return;
    }

    setSaveState("saving");
    const done = allSteps.filter((step) => doneIds.includes(step.id));
    const remaining = allSteps.filter((step) => !doneIds.includes(step.id));
    const lines = [scenario.recordSeed, ""];

    if (done.length > 0) {
      lines.push("済んだこと");
      done.forEach((step) => lines.push(`・${step.title}`));
      lines.push("");
    }
    if (remaining.length > 0) {
      lines.push("まだのこと");
      remaining.forEach((step) => lines.push(`・${step.title}`));
    }

    const result = await addTimelineEntry({
      personId: activePerson.id,
      body: lines.join("\n").trim(),
      mood: "urgent",
      title: scenario.label
    });

    if (result.error) {
      setSaveState("error");
      setSaveMessage(result.error);
      return;
    }

    void trackFunnel("crisis_saved");
    setSaveState("saved");
    setSaveMessage(result.source === "demo" ? "お試し表示に記録しました。" : "記録に残しました。");
  }

  return (
    <>
      <Stack.Screen options={{ title: scenario.label }} />
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>{scenario.situation}</Text>
          <Text style={styles.title}>{scenario.title}</Text>
          <Text style={styles.lead}>{scenario.lead}</Text>
          <View style={styles.reassurance}>
            <MaterialCommunityIcons color={colors.green} name="hand-heart-outline" size={20} />
            <Text style={styles.reassuranceText}>{scenario.reassurance}</Text>
          </View>
        </View>

        <View style={styles.progress}>
          <Text style={styles.progressText}>
            {nowSteps.length > 0 && nowDone >= nowSteps.length
              ? "いますぐの項目は全部済んでいます。ここから先は、明日でも間に合います。"
              : `いますぐの項目 ${nowDone} / ${nowSteps.length} 済み`}
          </Text>
        </View>

        {scenario.groups.map((group) => (
          <View key={group.key} style={[styles.group, group.key === "now" && styles.groupNow]}>
            <View style={styles.groupHead}>
              <Text style={[styles.timing, group.key === "now" && styles.timingNow]}>{group.timing}</Text>
              <Text style={styles.groupTitle}>{group.label}</Text>
              <Text style={styles.groupNote}>{group.note}</Text>
            </View>
            {group.steps.map((step, index) => {
              const checked = doneIds.includes(step.id);
              return (
                <Pressable
                  key={step.id}
                  onPress={() => { void toggleStep(step.id); }}
                  style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
                >
                  <MaterialCommunityIcons
                    color={checked ? colors.green : colors.line}
                    name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={26}
                  />
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepTitle, checked && styles.stepTitleDone]}>
                      {index + 1}. {step.title}
                    </Text>
                    <Text style={styles.stepDetail}>{step.detail}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ここまでの対応を記録に残す</Text>
          <Text style={styles.cardBody}>
            チェックした内容を、今日の記録として残します。後から「あの日何をしたか」を家族で確認できます。
          </Text>
          {activePerson ? (
            <Pressable disabled={saveState === "saving"} onPress={saveToTimeline} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {saveState === "saving" ? "記録しています…" : "今日の記録に残す"}
              </Text>
            </Pressable>
          ) : (
            <Link asChild href="/(tabs)/dashboard">
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>まず対象者を登録する</Text>
              </Pressable>
            </Link>
          )}
          {saveState === "saved" ? <Text style={styles.okText}>{saveMessage}</Text> : null}
          {saveState === "error" ? <Text style={styles.errorText}>{saveMessage}</Text> : null}
          {saveState === "no-person" ? (
            <Text style={styles.errorText}>まだ対象者がいません。先に1人登録してください。</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>家族への第一報</Text>
          <Text style={styles.cardBody}>
            一人ずつ電話すると内容がずれます。同じ文面を一度に送るほうが、後の行き違いを防げます。
          </Text>
          <View style={styles.template}>
            <Text style={styles.templateText}>{scenario.messageTemplate}</Text>
          </View>
          <Pressable onPress={shareTemplate} style={styles.secondaryButton}>
            <MaterialCommunityIcons color={colors.green} name="share-variant-outline" size={18} />
            <Text style={styles.secondaryButtonText}>この文面を家族に送る</Text>
          </Pressable>
        </View>

        <ListCard items={scenario.notYet} note="周りから言われても、今日決める必要はありません。" title="いまはやらなくていいこと" tone="muted" />
        <ListCard items={scenario.asked.items} note={scenario.asked.note} title={scenario.asked.title} tone="plain" />
        <ListCard
          items={scenario.keepItems}
          note="後から取り戻せないものだけを挙げています。暗証番号やパスワードは、どこにも書き残さないでください。"
          title="捨てない・消さないもの"
          tone="urgent"
        />

        <Text style={styles.safety}>{CRISIS_EMERGENCY_NOTE}</Text>
        <Text style={styles.safety}>{CRISIS_SAFETY_NOTE}</Text>
      </ScrollView>
    </>
  );
}

function ListCard({
  items,
  note,
  title,
  tone
}: {
  items: string[];
  note: string;
  title: string;
  tone: "muted" | "plain" | "urgent";
}) {
  const dotColor = tone === "urgent" ? colors.clay : tone === "muted" ? colors.muted : colors.green;
  return (
    <View style={[styles.card, tone === "muted" && styles.cardMuted]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{note}</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.listRow}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { gap: 14, padding: 20, paddingBottom: 48 },
  hero: {
    backgroundColor: colors.surface,
    borderColor: "#e2c7b6",
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 10,
    padding: 20,
    ...shadow
  },
  kicker: { color: colors.clay, fontSize: 12, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 32 },
  lead: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  reassurance: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.control,
    flexDirection: "row",
    gap: 10,
    padding: 14
  },
  reassuranceText: { color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "700", lineHeight: 22 },
  progress: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.control,
    padding: 12
  },
  progressText: { color: colors.green, fontSize: 13, fontWeight: "900" },
  group: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...shadow
  },
  groupNow: { borderColor: "#e2c7b6", borderWidth: 1.5 },
  groupHead: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: 4, padding: 16 },
  timing: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  timingNow: { color: colors.clay },
  groupTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  groupNote: { color: colors.muted, fontSize: 12.5, lineHeight: 20 },
  step: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  stepPressed: { backgroundColor: colors.surfaceSoft },
  stepBody: { flex: 1, gap: 6 },
  stepTitle: { color: colors.ink, fontSize: 15.5, fontWeight: "900", lineHeight: 24 },
  stepTitleDone: { color: colors.muted, textDecorationLine: "line-through" },
  stepDetail: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    ...shadow
  },
  cardMuted: { backgroundColor: colors.surfaceSoft },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  cardBody: { color: colors.muted, fontSize: 13.5, lineHeight: 22 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radius.control,
    paddingVertical: 15
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.green,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 13
  },
  secondaryButtonText: { color: colors.green, fontSize: 15, fontWeight: "900" },
  template: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.control,
    padding: 14
  },
  templateText: { color: colors.ink, fontSize: 13.5, lineHeight: 24 },
  list: { gap: 8 },
  listRow: { flexDirection: "row", gap: 10 },
  dot: { borderRadius: 4, height: 7, marginTop: 8, width: 7 },
  listText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 23 },
  okText: { color: colors.green, fontSize: 13.5, fontWeight: "900" },
  errorText: { color: colors.rose, fontSize: 13.5, fontWeight: "900" },
  safety: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  missing: { alignItems: "center", backgroundColor: colors.paper, flex: 1, gap: 14, justifyContent: "center", padding: 24 },
  missingText: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  missingButton: { borderColor: colors.green, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 12 },
  missingButtonText: { color: colors.green, fontSize: 15, fontWeight: "900" }
});
