import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { STATUSES, statusLabel, type ParentStatus } from "@oyano/shared";
import { MascotGuide, MascotMark } from "@/components/MascotGuide";
import { createPersonForFamily } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

const relationshipOptions = ["母", "父", "義母", "義父", "祖父母", "その他"];

export default function NewPersonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ anchorPersonId?: string }>();
  const anchorPersonId = typeof params.anchorPersonId === "string" ? params.anchorPersonId : "";
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState("母");
  const [status, setStatus] = useState<ParentStatus>("preparing");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (saving) return;
    setMessage("");
    setSaving(true);
    const result = await createPersonForFamily({
      anchorPersonId,
      currentStatus: status,
      displayName,
      relationship
    });
    setSaving(false);

    if (result.error || !result.person) {
      setMessage(result.error ?? "対象者を追加できませんでした。");
      return;
    }

    router.replace(result.warning ? `/people/${result.person.id}/status` : `/people/${result.person.id}/tasks`);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <MascotMark size={48} />
          <Text style={styles.kicker}>対象者を追加</Text>
        </View>
        <Text style={styles.title}>2人目以降は、1人ずつ登録します。</Text>
        <Text style={styles.lead}>状態や期限は人によって変わります。まず呼び名と今の状態だけ入れると、その人専用のタスクボードを作ります。</Text>
      </View>

      <MascotGuide compact message="父と母で状況が違う時も大丈夫です。人ごとにタスク、担当、期限を分けて管理します。" />

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>1. 呼び名</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setDisplayName}
          placeholder="例: 母、父、花子さん"
          placeholderTextColor="#8a9187"
          style={styles.input}
          value={displayName}
        />

        <Text style={styles.sectionLabel}>2. 続柄</Text>
        <View style={styles.choiceGrid}>
          {relationshipOptions.map((item) => (
            <Pressable
              key={item}
              onPress={() => setRelationship(item)}
              style={[styles.choice, relationship === item && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, relationship === item && styles.choiceTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>3. 今の状態</Text>
        <Text style={styles.body}>あとから変更できます。まず一番近いものを選んでください。</Text>
        <View style={styles.statusList}>
          {STATUSES.filter((item) => item.key !== "completed").map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setStatus(item.key)}
              style={[styles.statusOption, status === item.key && styles.statusActive]}
            >
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>{item.label}</Text>
                <Text style={styles.statusBody}>{statusLabel(item.key)}としてタスクを作ります</Text>
              </View>
              {status === item.key ? <MaterialCommunityIcons color={colors.green} name="check-circle" size={24} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}

      <Pressable
        disabled={saving || !anchorPersonId || !displayName.trim()}
        onPress={save}
        style={[styles.saveButton, (saving || !anchorPersonId || !displayName.trim()) && styles.disabled]}
      >
        <Text style={styles.saveButtonText}>{saving ? "追加しています" : "この対象者を追加する"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 16, paddingBottom: 28 },
  hero: { backgroundColor: colors.greenDark, borderRadius: radius.card, gap: 10, padding: 18, ...shadow },
  heroTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  kicker: { color: "#d9eadf", fontWeight: "900" },
  title: { color: "#fffdf7", fontSize: 30, fontWeight: "900", lineHeight: 36 },
  lead: { color: "rgba(255,253,247,0.86)", fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  sectionLabel: { color: colors.greenDark, fontSize: 16, fontWeight: "900", marginTop: 4 },
  input: {
    backgroundColor: "#fff",
    borderColor: colors.line,
    borderRadius: radius.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    minHeight: 54,
    paddingHorizontal: 14
  },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  choiceActive: { backgroundColor: colors.green, borderColor: colors.green },
  choiceText: { color: colors.ink, fontWeight: "900" },
  choiceTextActive: { color: "#fff" },
  body: { color: colors.muted, lineHeight: 22 },
  statusList: { gap: 8 },
  statusOption: {
    alignItems: "center",
    backgroundColor: "#fffdf7",
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 70,
    padding: 12
  },
  statusActive: { backgroundColor: "#edf6ef", borderColor: colors.green, borderWidth: 2 },
  statusText: { flex: 1, gap: 3 },
  statusTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  statusBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  notice: { backgroundColor: "#fff7e8", borderColor: "rgba(155,109,43,0.28)", borderRadius: radius.card, borderWidth: 1, padding: 14 },
  noticeText: { color: colors.gold, fontWeight: "900", lineHeight: 21 },
  saveButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, justifyContent: "center", minHeight: 56, padding: 14 },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  disabled: { opacity: 0.48 }
});
