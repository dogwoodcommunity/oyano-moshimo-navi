import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  addTimelineEntry,
  fetchPerson,
  fetchTimelineEntries,
  type MobileDiaryMood,
  type MobilePerson,
  type MobileTimelineAttachment,
  type MobileTimelineEntry
} from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

const moodOptions: Array<{ key: MobileDiaryMood; label: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: "stable", label: "変化なし", description: "いつも通り", icon: "check-circle-outline" },
  { key: "changed", label: "変化あり", description: "様子が違う", icon: "alert-circle-outline" },
  { key: "urgent", label: "急ぎ", description: "家族で確認", icon: "phone-alert-outline" }
];

/**
 * 打たずに残せるように、その日の様子をそのまま選べる言葉にした。
 * 動揺している時ほど文章は書けない。タップだけで1件の記録が完成する。
 */
const quickAnswers = [
  "食事はとれた",
  "食事が少なかった",
  "水分はとれた",
  "薬は飲めた",
  "薬を飲めなかった",
  "よく眠れていた",
  "眠れていない様子",
  "機嫌がよかった",
  "元気がなかった",
  "痛みがある様子",
  "病院・施設から連絡があった",
  "家族で相談した"
];

/** 同時に選ぶと矛盾する組み合わせ。片方を選ぶともう片方は外れる。 */
const exclusivePairs: string[][] = [
  ["食事はとれた", "食事が少なかった"],
  ["薬は飲めた", "薬を飲めなかった"],
  ["よく眠れていた", "眠れていない様子"],
  ["機嫌がよかった", "元気がなかった"]
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function moodLabel(mood?: MobileDiaryMood) {
  return moodOptions.find((option) => option.key === mood)?.label ?? "記録";
}

function moodColor(mood?: MobileDiaryMood) {
  if (mood === "urgent") return colors.rose;
  if (mood === "changed") return colors.gold;
  return colors.green;
}

function defaultTitle(mood: MobileDiaryMood) {
  if (mood === "urgent") return "急ぎで家族に確認";
  if (mood === "changed") return "変化があった記録";
  return "今日の記録";
}

export default function TimelineScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<MobilePerson | null>(null);
  const [entries, setEntries] = useState<MobileTimelineEntry[]>([]);
  const [mood, setMood] = useState<MobileDiaryMood>("stable");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<MobileTimelineAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const [nextPerson, nextEntries] = await Promise.all([
        fetchPerson(params.id),
        fetchTimelineEntries(params.id)
      ]);

      if (!active) return;
      setPerson(nextPerson);
      setEntries(nextEntries);
    }

    void load();
    return () => {
      active = false;
    };
  }, [params.id]);

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag);
      // 「薬は飲めた」と「薬を飲めなかった」のように両立しない項目は、
      // 選んだ方だけを残す。矛盾した記録が家族に共有されるのを防ぐ。
      const opposite = exclusivePairs.find((pair) => pair.includes(tag))?.find((item) => item !== tag);
      const cleaned = opposite ? current.filter((item) => item !== opposite) : current;
      return [...cleaned, tag];
    });
    // 次の記録を書き始めたら、前回の「保存しました」は役目を終える。
    setMessage("");
  }

  function addAttachmentMemo(type: "photo" | "pdf") {
    const label = type === "photo" ? "写真" : "PDF";
    setAttachments((current) => [
      ...current,
      {
        name: `${label}を追加予定 ${current.length + 1}`,
        type
      }
    ]);
    setBody((current) => current ? `${current}\n・${label}をあとで添付` : `・${label}をあとで添付`);
  }

  // タップで選んだ様子と、任意のひとことを1つの本文にまとめる。
  // これで「何も打たずタップだけ」でも記録が成立する。
  const tagLines = selectedTags.map((tag) => `・${tag}`).join("\n");
  const composedBody = [tagLines, body.trim()].filter((part) => part.length > 0).join("\n");
  const canSave = composedBody.length > 0 || attachments.length > 0;

  async function saveEntry() {
    if (saving || !canSave) return;
    setMessage("");
    setSaving(true);
    const result = await addTimelineEntry({
      attachments,
      body: composedBody,
      date: todayString(),
      mood,
      personId: params.id,
      title: defaultTitle(mood)
    });
    setSaving(false);

    if (result.error || !result.entry) {
      setMessage(result.error ?? "記録を保存できませんでした。");
      return;
    }

    setEntries((current) => [result.entry as MobileTimelineEntry, ...current]);
    setSelectedTags([]);
    setBody("");
    setAttachments([]);
    setMood("stable");
    setMessage("今日の記録を保存しました。あとで家族と見返せます。");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>日記帳</Text>
        <Text style={styles.title}>{person?.displayName ?? "対象者"}さんの毎日の記録</Text>
        <Text style={styles.body}>
          体調、発言、病院で言われたこと、写真や書類のメモを残します。あとでAI相談や家族共有に使える大切な履歴です。
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="pencil-circle-outline" size={24} />
          <Text style={styles.cardTitle}>今日の様子を書く</Text>
        </View>

        <Text style={styles.label}>今日の印</Text>
        <View style={styles.moodGrid}>
          {moodOptions.map((option) => {
            const active = mood === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setMood(option.key)}
                style={[styles.moodButton, active ? styles.moodButtonActive : null]}
              >
                <MaterialCommunityIcons color={active ? "#fff" : moodColor(option.key)} name={option.icon} size={21} />
                <View style={styles.moodText}>
                  <Text style={[styles.moodLabel, active ? styles.moodLabelActive : null]}>{option.label}</Text>
                  <Text style={[styles.moodDescription, active ? styles.moodDescriptionActive : null]}>{option.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>今日はどうでしたか（タップで選ぶだけ）</Text>
        <View style={styles.quickGrid}>
          {quickAnswers.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[styles.quickChip, active ? styles.quickChipActive : null]}
              >
                <Text style={[styles.quickChipText, active ? styles.quickChipTextActive : null]}>
                  {active ? "✓ " : ""}{tag}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>ひとこと補足（任意・書かなくても保存できます）</Text>
        <TextInput
          multiline
          onChangeText={setBody}
          placeholder="例: 退院後はじめて外を少し歩けた。次の受診で歩行のことを聞きたい。"
          placeholderTextColor="#8a958f"
          style={styles.textarea}
          value={body}
        />
        <Text style={styles.voiceHint}>キーボードのマイクボタンで、話すだけでも書けます。</Text>

        <View style={styles.attachmentRow}>
          <Pressable onPress={() => addAttachmentMemo("photo")} style={styles.attachmentButton}>
            <MaterialCommunityIcons color={colors.greenDark} name="image-plus" size={19} />
            <Text style={styles.attachmentText}>写真メモ</Text>
          </Pressable>
          <Pressable onPress={() => addAttachmentMemo("pdf")} style={styles.attachmentButton}>
            <MaterialCommunityIcons color={colors.greenDark} name="file-pdf-box" size={19} />
            <Text style={styles.attachmentText}>PDFメモ</Text>
          </Pressable>
        </View>

        {attachments.length ? (
          <View style={styles.attachmentList}>
            {attachments.map((attachment) => (
              <Text key={attachment.name} style={styles.attachmentName}>・{attachment.name}</Text>
            ))}
          </View>
        ) : null}

        {message ? <Text style={styles.noticeText}>{message}</Text> : null}

        <Pressable disabled={saving || !canSave} onPress={saveEntry} style={[styles.saveButton, saving || !canSave ? styles.disabled : null]}>
          <Text style={styles.saveButtonText}>{saving ? "保存中" : "記録を保存する"}</Text>
          <MaterialCommunityIcons color="#fff" name="check" size={20} />
        </Pressable>
        {!canSave && !message ? (
          <Text style={styles.body}>上の項目をタップするか、ひとこと書くと保存できます。</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.blue} name="history" size={23} />
          <Text style={styles.cardTitle}>これまでの記録</Text>
        </View>
        {entries.length === 0 ? (
          <Text style={styles.body}>まだ記録はありません。まず今日の様子を1つ残してください。</Text>
        ) : null}
        {entries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryTop}>
              <Text style={[styles.entryMood, { color: moodColor(entry.mood) }]}>{moodLabel(entry.mood)}</Text>
              <Text style={styles.entryDate}>{entry.date?.replaceAll("-", "/")}</Text>
            </View>
            <Text style={styles.entryTitle}>{entry.title}</Text>
            {entry.body ? <Text style={styles.body}>{entry.body}</Text> : null}
            {entry.attachments.length ? (
              <View style={styles.attachmentList}>
                {entry.attachments.map((attachment) => (
                  <Text key={attachment.name} style={styles.attachmentName}>・{attachment.name}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <Link href={`/people/${params.id}`} style={styles.backLink}>管理手帳に戻る</Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 16, paddingBottom: 34 },
  header: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 8, padding: 18, ...shadow },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  body: { color: colors.muted, lineHeight: 22 },
  voiceHint: { color: colors.greenDark, fontSize: 12.5, fontWeight: "800", lineHeight: 20, marginTop: -4 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 28 },
  label: { color: colors.ink, fontWeight: "900" },
  moodGrid: { gap: 8 },
  moodButton: { alignItems: "center", backgroundColor: "#fffdf7", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 9, minHeight: 58, padding: 11 },
  moodButtonActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  moodText: { flex: 1, gap: 1 },
  moodLabel: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  moodLabelActive: { color: "#fff" },
  moodDescription: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  moodDescriptionActive: { color: "rgba(255,255,255,0.74)" },
  textarea: { backgroundColor: "#fff", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 130, padding: 12, textAlignVertical: "top" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  quickChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  quickChipText: { color: colors.greenDark, fontSize: 13.5, fontWeight: "900" },
  quickChipTextActive: { color: "#fff" },
  attachmentRow: { flexDirection: "row", gap: 8 },
  attachmentButton: { alignItems: "center", backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.control, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 48 },
  attachmentText: { color: colors.greenDark, fontWeight: "900" },
  attachmentList: { backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, gap: 4, padding: 10 },
  attachmentName: { color: colors.muted, fontWeight: "800", lineHeight: 20 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 },
  saveButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.62 },
  entryCard: { backgroundColor: "#fffdf7", borderColor: colors.line, borderLeftColor: colors.green, borderLeftWidth: 4, borderRadius: radius.card, borderWidth: 1, gap: 7, padding: 12 },
  entryTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  entryMood: { fontSize: 12, fontWeight: "900" },
  entryDate: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  entryTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", lineHeight: 24 },
  backLink: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.greenDark, fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 14, textAlign: "center" }
});
