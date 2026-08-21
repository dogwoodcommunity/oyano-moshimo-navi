import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  consultAnswerToDiaryBody,
  hasNotebookSubstance,
  CONSULT_MAX_QUESTION_LENGTH,
  CONSULT_SENT_FIELDS,
  CONSULT_WITHHELD_FIELDS,
  type ConsultAnswer
} from "@oyano/shared";
import { readConsultConsent, requestConsult, writeConsultConsent } from "@/lib/consult";
import { trackFunnel } from "@/lib/funnel";
import {
  addTimelineEntry,
  fetchDashboardData,
  fetchTimelineEntries,
  type MobilePerson,
  type MobileTimelineEntry
} from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

const suggestions = [
  "いまの記録から、見落としていることはありますか",
  "退院後の生活をどう決めればいいですか",
  "介護保険の申請はどう進めればいいですか",
  "家族でどう役割を分ければいいですか",
  "次の受診で何を聞けばいいですか"
];

type Phase = "loading" | "ready" | "asking" | "done" | "error";

export default function ConsultScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [person, setPerson] = useState<MobilePerson | null>(null);
  const [entries, setEntries] = useState<MobileTimelineEntry[]>([]);
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ConsultAnswer | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setConsent(await readConsultConsent());
      const data = await fetchDashboardData();
      if (!mounted) return;

      const active = data.person ?? data.people[0] ?? null;
      setPerson(active);

      if (active) {
        const timeline = await fetchTimelineEntries(active.id);
        if (mounted) setEntries(timeline);
      }
      if (mounted) setPhase("ready");
    }

    void load();
    return () => { mounted = false; };
  }, []);

  const profile = person?.profile;
  const payloadPerson = {
    relationship: profile?.relationship ?? person?.relationship,
    careStatus: profile?.careStatus,
    birthDate: profile?.birthDate,
    hospitalOrFacility: profile?.hospitalOrFacility,
    medicationNote: profile?.medicationNote,
    familyStructureNote: profile?.familyStructure
  };
  const diaryEntries = entries
    .filter((entry) => entry.eventType === "diary")
    .slice(0, 20)
    .map((entry) => ({ date: entry.date, mood: entry.mood, body: entry.body }));
  const hasSubstance = hasNotebookSubstance({ question: "", person: payloadPerson, entries: diaryEntries });
  const canAsk = consent && hasSubstance && question.trim().length >= 4 && phase !== "asking";

  async function toggleConsent() {
    const next = !consent;
    setConsent(next);
    await writeConsultConsent(next);
  }

  async function ask() {
    if (!person) return;
    setPhase("asking");
    setMessage("");
    setAnswer(null);
    setSaved(false);

    const result = await requestConsult({
      question: question.trim(),
      person: payloadPerson,
      entries: diaryEntries,
      tasks: []
    });

    if (!result.ok) {
      setMessage(result.message);
      setPhase("error");
      return;
    }

    setAnswer(result.answer);
    setDisclaimer(result.disclaimer);
    void trackFunnel("consult_asked");
    setPhase("done");
  }

  async function saveToTimeline() {
    if (!person || !answer) return;
    const result = await addTimelineEntry({
      personId: person.id,
      body: consultAnswerToDiaryBody(question, answer),
      mood: "stable",
      title: "相談メモ"
    });
    if (!result.error) setSaved(true);
  }

  if (phase === "loading") {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>読み込み中です</Text>
      </View>
    );
  }

  if (!person) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>先に対象者を登録してください</Text>
        <Text style={styles.centerText}>
          相談は、その人のプロフィールと記録を前提に整理します。登録がないと、一般論しか返せません。
        </Text>
        <Link asChild href="/(tabs)/dashboard">
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>家族ボードへ</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>長期相談</Text>
        <Text style={styles.title}>毎回ゼロから説明せずに、相談できます。</Text>
        <Text style={styles.body}>
          この人のプロフィールと最近の記録を前提に、いま確認するとよいこと、窓口で聞くこと、相談先の候補を整理します。
          診断や法律・税務の結論は出しません。
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>送る情報と、送らない情報</Text>
        <Text style={styles.body}>
          相談のたびに、下の内容だけを外部の生成AI（Anthropic Claude）へ送ります。送った内容は学習には使われません。
        </Text>
        <View style={styles.disclosure}>
          <Text style={styles.disclosureLabel}>送るもの</Text>
          {CONSULT_SENT_FIELDS.map((item) => (
            <Text key={item} style={styles.disclosureItem}>・{item}</Text>
          ))}
        </View>
        <View style={[styles.disclosure, styles.disclosureWithheld]}>
          <Text style={styles.disclosureLabel}>送らないもの</Text>
          {CONSULT_WITHHELD_FIELDS.map((item) => (
            <Text key={item} style={styles.disclosureItem}>・{item}</Text>
          ))}
        </View>
        <Pressable onPress={toggleConsent} style={styles.consent}>
          <MaterialCommunityIcons
            color={consent ? colors.green : colors.line}
            name={consent ? "checkbox-marked" : "checkbox-blank-outline"}
            size={26}
          />
          <Text style={styles.consentText}>上の内容を送ることに同意します。（いつでも外せます）</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>いま困っていることを書いてください</Text>
        <View style={styles.suggestions}>
          {suggestions.map((item) => (
            <Pressable key={item} onPress={() => setQuestion(item)} style={styles.suggestion}>
              <Text style={styles.suggestionText}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          maxLength={CONSULT_MAX_QUESTION_LENGTH}
          multiline
          onChangeText={setQuestion}
          placeholder="例: 退院の話が出ていますが、家に戻れるのか判断がつきません。何から確認すればいいですか。"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={question}
        />
        <Text style={styles.count}>{question.length} / {CONSULT_MAX_QUESTION_LENGTH}</Text>
        <Pressable
          disabled={!canAsk}
          onPress={ask}
          style={[styles.primaryButton, !canAsk && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {phase === "asking" ? "整理しています…" : "相談メモを作る"}
          </Text>
        </Pressable>
        {!hasSubstance ? (
          <Text style={styles.hint}>
            先に記録を1件書くか、プロフィールを2つ以上埋めてください。記録がないと、一般論しか返せません。
          </Text>
        ) : null}
        {!consent ? <Text style={styles.hint}>送る内容に同意すると押せます。</Text> : null}
        {phase === "asking" ? <Text style={styles.hint}>記録を読んでいます。30秒ほどかかることがあります。</Text> : null}
        {phase === "error" ? <Text style={styles.error}>{message}</Text> : null}
      </View>

      {answer ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>いまの状況</Text>
          <Text style={styles.answerBody}>{answer.situation}</Text>

          {answer.nextChecks.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>次に確認するとよいこと</Text>
              {answer.nextChecks.map((check, index) => (
                <View key={check.title} style={styles.check}>
                  <Text style={styles.checkTitle}>{index + 1}. {check.title}</Text>
                  <Text style={styles.checkWhy}>{check.why}</Text>
                </View>
              ))}
            </>
          ) : null}

          <AnswerList items={answer.askQuestions} title="窓口で聞くこと" />
          <AnswerList items={answer.providerCategories} title="相談先の候補" />
          <AnswerList items={answer.watchOuts} title="気をつけること" />

          {answer.recordSuggestion ? (
            <>
              <Text style={styles.sectionTitle}>次に記録へ残すこと</Text>
              <Text style={styles.answerBody}>{answer.recordSuggestion}</Text>
            </>
          ) : null}

          <Pressable onPress={saveToTimeline} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {saved ? "記録に残しました" : "この相談メモを記録に残す"}
            </Text>
          </Pressable>
          {disclaimer ? <Text style={styles.disclaimer}>{disclaimer}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function AnswerList({ items, title }: { items: string[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <View style={styles.dot} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { gap: 14, padding: 20, paddingBottom: 48 },
  center: { alignItems: "center", backgroundColor: colors.paper, flex: 1, gap: 12, justifyContent: "center", padding: 28 },
  centerTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" },
  centerText: { color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    ...shadow
  },
  kicker: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 21, fontWeight: "900", lineHeight: 31 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 6 },
  body: { color: colors.muted, fontSize: 13.5, lineHeight: 23 },
  disclosure: { backgroundColor: colors.surfaceSoft, borderRadius: radius.control, gap: 4, padding: 14 },
  disclosureWithheld: { backgroundColor: "#f7e7e2" },
  disclosureLabel: { color: colors.ink, fontSize: 14, fontWeight: "900", marginBottom: 4 },
  disclosureItem: { color: colors.muted, fontSize: 12.5, lineHeight: 20 },
  consent: { alignItems: "flex-start", flexDirection: "row", gap: 10, paddingVertical: 4 },
  consentText: { color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "700", lineHeight: 22 },
  suggestions: { gap: 8 },
  suggestion: { backgroundColor: colors.surfaceSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  suggestionText: { color: colors.green, fontSize: 13, fontWeight: "800" },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.control,
    borderWidth: 1.5,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 120,
    padding: 14,
    textAlignVertical: "top"
  },
  count: { color: colors.muted, fontSize: 12, textAlign: "right" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radius.control,
    paddingVertical: 15
  },
  primaryButtonDisabled: { backgroundColor: colors.line },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.green,
    borderRadius: 999,
    borderWidth: 1.5,
    marginTop: 8,
    paddingVertical: 13
  },
  secondaryButtonText: { color: colors.green, fontSize: 15, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 21 },
  error: { color: colors.rose, fontSize: 13.5, fontWeight: "800", lineHeight: 22 },
  answerBody: { color: colors.ink, fontSize: 14.5, lineHeight: 26 },
  check: { backgroundColor: colors.surfaceSoft, borderRadius: radius.control, gap: 4, padding: 14 },
  checkTitle: { color: colors.ink, fontSize: 14.5, fontWeight: "900", lineHeight: 23 },
  checkWhy: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  listRow: { flexDirection: "row", gap: 10 },
  dot: { backgroundColor: colors.green, borderRadius: 4, height: 7, marginTop: 8, width: 7 },
  listText: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 23 },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 6 }
});
