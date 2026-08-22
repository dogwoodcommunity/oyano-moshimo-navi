import { useEffect, useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { statusLabel } from "@oyano/shared";
import {
  demoDashboardData,
  fetchPerson,
  fetchTasks,
  fetchTimelineEntries,
  updatePersonProfile,
  type MobilePerson,
  type MobilePersonProfile,
  type MobileTask,
  type MobileTimelineEntry
} from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";
import { MascotMark } from "@/components/MascotGuide";

type ProfileField = {
  key: keyof MobilePersonProfile;
  label: string;
  placeholder: string;
  multiline?: boolean;
};

const profileFields: ProfileField[] = [
  { key: "fullName", label: "氏名", placeholder: "例: 山田 花子" },
  { key: "displayName", label: "呼び名", placeholder: "例: 母、花子さん" },
  { key: "relationship", label: "続柄", placeholder: "例: 母、父、義母、叔母" },
  { key: "birthDate", label: "生年月日", placeholder: "例: 1948-04-12" },
  { key: "careStatus", label: "今の状況", placeholder: "例: 退院後、在宅で様子見" },
  { key: "keyContact", label: "主な連絡先", placeholder: "例: 主治医、ケアマネ、施設相談員" },
  { key: "hospitalOrFacility", label: "病院・施設", placeholder: "例: 〇〇病院 退院支援窓口" },
  { key: "medicationNote", label: "薬・健康メモ", placeholder: "例: 朝夕の薬あり。飲み忘れ注意", multiline: true },
  { key: "documentLocationNote", label: "書類の場所", placeholder: "例: 保険証券は実家の茶色い棚", multiline: true }
];

/**
 * 「あと何を埋めれば良いか」を利用者に示すための情報。
 * priority: key＝先に埋めたい重要項目、nice＝あると便利。why＝埋めると何に役立つか（平易に）。
 * 数字（60%）だけでは次に何をすればいいか分からないので、これで誘導する。
 */
const fieldGuidance: Partial<Record<keyof MobilePersonProfile, { priority: "key" | "nice"; why: string }>> = {
  displayName: { priority: "key", why: "画面や通知での呼び方に使います。" },
  relationship: { priority: "key", why: "AI相談で続柄を踏まえた助言になります。" },
  birthDate: { priority: "key", why: "AI相談で年代を踏まえた助言になります（生年月日そのものは送りません）。" },
  careStatus: { priority: "key", why: "いまの状況に合ったタスクと助言に使います。" },
  keyContact: { priority: "key", why: "急なときに家族がすぐ連絡できます。" },
  documentLocationNote: { priority: "key", why: "相続や手続きのとき、家族が書類を探せます。" },
  fullName: { priority: "nice", why: "正式な手続きの控えに使えます。" },
  hospitalOrFacility: { priority: "nice", why: "AI相談や受診の準備がより具体的になります。" },
  medicationNote: { priority: "nice", why: "体調の変化を家族と共有しやすくなります。" }
};

function defaultProfile(person: MobilePerson): MobilePersonProfile {
  return {
    displayName: person.displayName,
    relationship: person.relationship,
    careStatus: statusLabel(person.currentStatus),
    ...(person.profile ?? {})
  };
}

/** DBのprofileは自由なJSONなので、文字列以外が入っていても落ちないようにする。 */
function isFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function completion(profile: MobilePersonProfile) {
  const required = ["displayName", "relationship", "birthDate", "careStatus", "keyContact", "documentLocationNote"] as const;
  const done = required.filter((key) => isFilled(profile[key])).length;
  return Math.round((done / required.length) * 100);
}

function formatDate(value?: string) {
  if (!value) return "まだ記録はありません";
  return value.replaceAll("-", "/");
}

function openTaskCount(tasks: MobileTask[]) {
  return tasks.filter((task) => task.status !== "done" && task.status !== "skipped").length;
}

function unassignedTaskCount(tasks: MobileTask[]) {
  return tasks.filter((task) => task.status !== "done" && task.status !== "skipped" && !task.assignedMemberId).length;
}

export default function PersonScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const fallback = demoDashboardData();
  const [person, setPerson] = useState<MobilePerson>(fallback.person);
  const [profile, setProfile] = useState<MobilePersonProfile>(defaultProfile(fallback.person));
  const [tasks, setTasks] = useState<MobileTask[]>(fallback.tasks);
  const [timeline, setTimeline] = useState<MobileTimelineEntry[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const nextPerson = await fetchPerson(params.id);
      const [nextTasks, nextTimeline] = await Promise.all([
        fetchTasks(params.id),
        fetchTimelineEntries(params.id)
      ]);

      if (!active) return;
      setPerson(nextPerson);
      setProfile(defaultProfile(nextPerson));
      setTasks(nextTasks);
      setTimeline(nextTimeline);
    }

    void load();
    return () => {
      active = false;
    };
  }, [params.id]);

  const profileCompletion = useMemo(() => completion(profile), [profile]);
  // まだ空いている「重要」項目のうち、フォーム順で最初のもの＝次に埋めるとよいもの。
  const nextField = useMemo(
    () => profileFields.find((field) => fieldGuidance[field.key]?.priority === "key" && !isFilled(profile[field.key])),
    [profile]
  );
  const latestEntry = timeline[0];

  function updateField(key: keyof MobilePersonProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    if (saving) return;
    setMessage("");
    setSaving(true);
    const result = await updatePersonProfile(params.id, profile);
    setSaving(false);

    if (result.error || !result.person) {
      setMessage(result.error ?? "プロフィールを保存できませんでした。");
      return;
    }

    setPerson(result.person);
    setProfile(defaultProfile(result.person));
    setMessage("プロフィールを保存しました。家族で見返せる情報が増えました。");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <MascotMark size={56} />
          <View style={styles.heroText}>
            <Text style={styles.kicker}>{profile.relationship || "対象者"}</Text>
            <Text style={styles.title}>{profile.displayName || person.displayName}さんの管理手帳</Text>
            <Text style={styles.body}>
              日々の変化、期限、書類の場所をここにまとめます。困った時に家族が同じ情報を見られるページです。
            </Text>
          </View>
        </View>
        <View style={styles.heroActions}>
          <Link href={`/people/${params.id}/timeline`} style={styles.primaryButton}>今日の記録を書く</Link>
          <Link href={`/people/${params.id}/tasks`} style={styles.secondaryButton}>今やること</Link>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricNumber}>{openTaskCount(tasks)}</Text>
          <Text style={styles.metricLabel}>未完了</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricNumber}>{unassignedTaskCount(tasks)}</Text>
          <Text style={styles.metricLabel}>担当未定</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricNumber}>{timeline.length}</Text>
          <Text style={styles.metricLabel}>記録</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons color={colors.green} name="account-heart-outline" size={23} />
            <Text style={styles.cardTitle}>プロフィール</Text>
          </View>
          <Text style={styles.percentBadge}>{profileCompletion}%</Text>
        </View>
        <Text style={styles.body}>
          最初は呼び名だけで大丈夫です。あとから足すほど、家族共有やAI相談で使いやすくなります。
        </Text>
        {nextField ? (
          <View style={styles.nextFill}>
            <Text style={styles.nextFillLabel}>つぎに埋めるとよいこと</Text>
            <Text style={styles.nextFillTitle}>{nextField.label}</Text>
            <Text style={styles.nextFillWhy}>{fieldGuidance[nextField.key]?.why}</Text>
          </View>
        ) : (
          <View style={styles.nextFillDone}>
            <Text style={styles.nextFillWhy}>大事な項目は入っています。残りは必要になった時に足せば十分です。</Text>
          </View>
        )}
        {profileFields.map((field) => {
          const guide = fieldGuidance[field.key];
          const isNext = field.key === nextField?.key;
          return (
            <View key={field.key} style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{field.label}</Text>
                {guide ? (
                  <Text style={guide.priority === "key" ? styles.keyTag : styles.niceTag}>
                    {guide.priority === "key" ? "重要" : "あるとよい"}
                  </Text>
                ) : null}
              </View>
              {guide?.why ? <Text style={styles.fieldWhy}>{guide.why}</Text> : null}
              <TextInput
                multiline={field.multiline}
                onChangeText={(value) => updateField(field.key, value)}
                placeholder={field.placeholder}
                placeholderTextColor="#8a958f"
                style={[styles.input, field.multiline ? styles.multiline : null, isNext ? styles.inputNext : null]}
                value={profile[field.key] ?? ""}
              />
            </View>
          );
        })}
        {message ? <Text style={styles.noticeText}>{message}</Text> : null}
        <Pressable disabled={saving} onPress={saveProfile} style={[styles.saveButton, saving ? styles.disabled : null]}>
          <Text style={styles.saveButtonText}>{saving ? "保存中" : "プロフィールを保存する"}</Text>
          <MaterialCommunityIcons color="#fff" name="content-save-outline" size={19} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons color={colors.blue} name="notebook-edit-outline" size={23} />
          <Text style={styles.cardTitle}>日々の記録</Text>
        </View>
        <Text style={styles.body}>
          体調、発言、病院で言われたこと、家族で集まった写真メモを残します。あとで「いつから変わったか」を振り返れます。
        </Text>
        <View style={styles.latestBox}>
          <Text style={styles.latestLabel}>最新</Text>
          <Text style={styles.latestTitle}>{latestEntry?.title ?? "今日の様子を1つ残してみましょう"}</Text>
          <Text style={styles.body}>{latestEntry?.body ?? "写真やPDFの保管メモも、この記録にまとめておけます。"}</Text>
          <Text style={styles.latestDate}>{formatDate(latestEntry?.date)}</Text>
        </View>
        <Link href={`/people/${params.id}/timeline`} style={styles.fullWidthLink}>日記帳を開く</Link>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons color={colors.gold} name="star-circle-outline" size={23} />
          <Text style={styles.cardTitle}>Plusで広げる</Text>
        </View>
        <Text style={styles.body}>
          2人目以降の対象者、家族共有の拡張、AI相談、家族会議用PDFは有料プランで提案します。まず1人目の手帳をしっかり作る導線です。
        </Text>
        <View style={styles.plusGrid}>
          <View style={styles.plusItem}>
            <MaterialCommunityIcons color={colors.greenDark} name="account-multiple-plus-outline" size={22} />
            <Text style={styles.plusText}>別の親・親戚を追加</Text>
          </View>
          <View style={styles.plusItem}>
            <MaterialCommunityIcons color={colors.greenDark} name="chat-question-outline" size={22} />
            <Text style={styles.plusText}>この人の記録をもとにAI相談</Text>
          </View>
          <View style={styles.plusItem}>
            <MaterialCommunityIcons color={colors.greenDark} name="file-pdf-box" size={22} />
            <Text style={styles.plusText}>家族会議用PDF</Text>
          </View>
        </View>
      </View>

      <View style={styles.navGrid}>
        <Link href={`/people/${params.id}/tasks`} style={styles.navTile}>期限と担当</Link>
        <Link href={`/people/${params.id}/assets`} style={styles.navTile}>書類・写真</Link>
        <Link href={`/people/${params.id}/family`} style={styles.navTile}>家族共有</Link>
        <Link href={`/people/${params.id}/home`} style={styles.navTile}>実家カルテ</Link>
        <Link href={`/people/${params.id}/status`} style={styles.navTile}>状態を更新</Link>
        <Link href="/account/plan" style={styles.navTile}>有料プラン</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 16, paddingBottom: 34 },
  hero: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 14, padding: 16, ...shadow },
  heroTop: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  heroText: { flex: 1, gap: 5 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  body: { color: colors.muted, lineHeight: 22 },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryButton: { backgroundColor: colors.green, borderRadius: radius.control, color: "#fff", flexGrow: 1, fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 14, textAlign: "center" },
  secondaryButton: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.greenDark, flexGrow: 1, fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 14, textAlign: "center" },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { backgroundColor: colors.greenDark, borderRadius: 14, flex: 1, padding: 12 },
  metricNumber: { color: "#fff", fontSize: 28, fontWeight: "900" },
  metricLabel: { color: "rgba(255,255,255,0.74)", fontSize: 12, fontWeight: "800" },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 28 },
  percentBadge: { backgroundColor: colors.surfaceSoft, borderRadius: 14, color: colors.green, fontWeight: "900", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6 },
  fieldGroup: { gap: 6 },
  labelRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  label: { color: colors.ink, fontWeight: "900" },
  keyTag: { backgroundColor: "#e7f0e8", borderRadius: 14, color: colors.greenDark, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3 },
  niceTag: { backgroundColor: colors.surfaceSoft, borderRadius: 14, color: colors.muted, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3 },
  fieldWhy: { color: colors.muted, fontSize: 12.5, lineHeight: 19 },
  input: { backgroundColor: "#fff", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  inputNext: { borderColor: colors.green, borderWidth: 2 },
  multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: "top" },
  nextFill: { backgroundColor: "#eef6ef", borderColor: colors.green, borderRadius: radius.control, borderWidth: 1, gap: 3, padding: 13 },
  nextFillDone: { backgroundColor: colors.surfaceSoft, borderRadius: radius.control, padding: 13 },
  nextFillLabel: { color: colors.greenDark, fontSize: 12, fontWeight: "900" },
  nextFillTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  nextFillWhy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  saveButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.62 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 },
  latestBox: { backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 6, padding: 12 },
  latestLabel: { color: colors.green, fontSize: 12, fontWeight: "900" },
  latestTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", lineHeight: 24 },
  latestDate: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  fullWidthLink: { backgroundColor: colors.greenDark, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 14, textAlign: "center" },
  plusGrid: { gap: 8 },
  plusItem: { alignItems: "center", backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, padding: 11 },
  plusText: { color: colors.greenDark, flex: 1, fontWeight: "900", lineHeight: 20 },
  navGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  navTile: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontWeight: "900", minWidth: "47%", overflow: "hidden", paddingHorizontal: 12, paddingVertical: 14, textAlign: "center" }
});
