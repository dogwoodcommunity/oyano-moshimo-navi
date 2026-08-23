import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  consultAnswerToDiaryBody,
  consultAnswerToHistoryTurn,
  hasNotebookSubstance,
  CONSULT_MAX_ENTRIES,
  CONSULT_MAX_HISTORY,
  CONSULT_MAX_QUESTION_LENGTH,
  CONSULT_SENT_FIELDS,
  CONSULT_WITHHELD_FIELDS,
  type ConsultAnswer
} from "@oyano/shared";
import {
  fetchConsultAccess,
  readConsultConsent,
  requestConsult,
  writeConsultConsent,
  type ConsultAccess
} from "@/lib/consult";
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

/** 画面に積み上がる、1回ぶんの相談と回答。前回までを踏まえてAIが続けて答える。 */
type ConsultTurn = { id: string; question: string; answer: ConsultAnswer; saved: boolean };

function birthDateToAgeBand(birthDate?: string) {
  if (!birthDate) return undefined;
  const year = Number(birthDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return undefined;
  const age = new Date().getFullYear() - year;
  if (age < 0 || age > 130) return undefined;
  return `${Math.floor(age / 10) * 10}代`;
}

export default function ConsultScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [person, setPerson] = useState<MobilePerson | null>(null);
  const [entries, setEntries] = useState<MobileTimelineEntry[]>([]);
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConsultTurn[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [message, setMessage] = useState("");
  const [access, setAccess] = useState<ConsultAccess>({
    signedIn: false,
    plan: "free",
    trialAvailable: false,
    trialUsedAt: null,
    canConsult: false
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setConsent(await readConsultConsent());
      const [data, consultAccess] = await Promise.all([
        fetchDashboardData(),
        fetchConsultAccess()
      ]);
      if (!mounted) return;

      const active = data.person ?? data.people[0] ?? null;
      setPerson(active);
      setAccess(consultAccess);

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
    birthDate: birthDateToAgeBand(profile?.birthDate),
    hospitalOrFacility: profile?.hospitalOrFacility,
    medicationNote: profile?.medicationNote,
    familyStructureNote: profile?.familyStructure
  };
  const diaryEntries = entries
    .filter((entry) => entry.eventType === "diary")
    .slice(0, CONSULT_MAX_ENTRIES)
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
    const asked = question.trim();
    setPhase("asking");
    setMessage("");

    // 前回までのやりとりを短くまとめて渡す。これでAIが続きとして答えられる。
    const history = turns
      .slice(-CONSULT_MAX_HISTORY)
      .map((turn) => consultAnswerToHistoryTurn(turn.question, turn.answer));

    const result = await requestConsult({
      question: asked,
      person: payloadPerson,
      entries: diaryEntries,
      tasks: [],
      history
    });

    if (!result.ok) {
      setMessage(result.message);
      setPhase("error");
      return;
    }

    setTurns((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, question: asked, answer: result.answer, saved: false }
    ]);
    setDisclaimer(result.disclaimer);
    setQuestion("");
    setAccess(await fetchConsultAccess());
    void trackFunnel("consult_asked");
    setPhase("done");
  }

  async function saveTurnToTimeline(index: number) {
    const turn = turns[index];
    if (!person || !turn) return;
    const result = await addTimelineEntry({
      personId: person.id,
      body: consultAnswerToDiaryBody(turn.question, turn.answer),
      mood: "stable",
      // 相談は、まだ家族に言えない不安を書く場でもある。
      // 保存しても家族へ通知は出さない。見せたい時は本人が知らせればよい。
      notifyFamily: false,
      title: "相談メモ"
    });
    if (!result.error) {
      setTurns((prev) => prev.map((item, i) => (i === index ? { ...item, saved: true } : item)));
    }
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
        <ConsultAccessNotice access={access} />
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

      {turns.map((turn, index) => (
        <AnswerCard
          answer={turn.answer}
          disclaimer={index === turns.length - 1 ? disclaimer : ""}
          key={turn.id}
          onSave={() => saveTurnToTimeline(index)}
          question={turn.question}
          saved={turn.saved}
          turnNumber={index + 1}
        />
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {turns.length > 0 ? "続けて相談する" : "いま困っていることを書いてください"}
        </Text>
        {turns.length > 0 ? (
          <Text style={styles.body}>
            前回までのやりとりを覚えています。「その後こうなった」「次はどうすれば」と、続けて聞けます。
          </Text>
        ) : (
          <View style={styles.suggestions}>
            {suggestions.map((item) => (
              <Pressable key={item} onPress={() => setQuestion(item)} style={styles.suggestion}>
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          maxLength={CONSULT_MAX_QUESTION_LENGTH}
          multiline
          onChangeText={setQuestion}
          placeholder={
            turns.length > 0
              ? "例: 昨日、退院日が決まりました。家に戻るまでに何を準備すればいいですか。"
              : "例: 退院の話が出ていますが、家に戻れるのか判断がつきません。何から確認すればいいですか。"
          }
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
            {phase === "asking" ? "整理しています…" : turns.length > 0 ? "続けて相談する" : "相談メモを作る"}
          </Text>
        </Pressable>
        {!hasSubstance ? (
          <Text style={styles.hint}>
            先に記録を1件書くか、プロフィールを2つ以上埋めてください。記録がないと、一般論しか返せません。
          </Text>
        ) : null}
        {!consent ? <Text style={styles.hint}>送る内容に同意すると押せます。</Text> : null}
        {phase === "asking" ? <Text style={styles.hint}>記録を読んでいます。30秒ほどかかることがあります。</Text> : null}
        {phase === "error" ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{message}</Text>
            {message.includes("Plus") ? (
              <Link asChild href="/account/plan">
                <Pressable style={styles.plusButton}>
                  <Text style={styles.plusButtonText}>Plusの内容を見る</Text>
                </Pressable>
              </Link>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ConsultAccessNotice({ access }: { access: ConsultAccess }) {
  if (access.plan === "plus") {
    return (
      <View style={styles.accessNotice}>
        <Text style={styles.accessTitle}>Family Plusで利用中</Text>
        <Text style={styles.accessText}>1日5回まで、この人の記録をもとに相談できます。</Text>
      </View>
    );
  }

  if (access.trialAvailable) {
    return (
      <View style={styles.accessNotice}>
        <Text style={styles.accessTitle}>1回だけ無料でためせます</Text>
        <Text style={styles.accessText}>相談に成功した時だけ、おためし枠を使います。失敗では消費しません。</Text>
      </View>
    );
  }

  if (access.signedIn) {
    return (
      <View style={styles.accessNoticeMuted}>
        <Text style={styles.accessTitle}>おためし相談は使いました</Text>
        <Text style={styles.accessText}>続きはPlusで使えます。手帳と記録はこのまま無料で使えます。</Text>
      </View>
    );
  }

  return (
    <View style={styles.accessNoticeMuted}>
      <Text style={styles.accessTitle}>メール確認後に使えます</Text>
      <Text style={styles.accessText}>長期相談は、消えない手帳を前提にします。先に家族ボードでメール確認をしてください。</Text>
    </View>
  );
}

function AnswerCard({
  answer,
  disclaimer,
  onSave,
  question,
  saved,
  turnNumber
}: {
  answer: ConsultAnswer;
  disclaimer: string;
  onSave: () => void;
  question: string;
  saved: boolean;
  turnNumber: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.turnQuestion}>
        <Text style={styles.turnBadge}>{turnNumber}回目の相談</Text>
        <Text style={styles.turnQuestionText}>{question}</Text>
      </View>

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

      <Pressable onPress={onSave} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>
          {saved ? "記録に残しました" : "この相談メモを記録に残す"}
        </Text>
      </Pressable>
      {disclaimer ? <Text style={styles.disclaimer}>{disclaimer}</Text> : null}
    </View>
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
  accessNotice: { backgroundColor: "#eef8ef", borderColor: "#cfe6d4", borderRadius: radius.control, borderWidth: 1, gap: 4, padding: 13 },
  accessNoticeMuted: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, gap: 4, padding: 13 },
  accessTitle: { color: colors.greenDark, fontSize: 14, fontWeight: "900" },
  accessText: { color: colors.muted, fontSize: 12.5, fontWeight: "700", lineHeight: 20 },
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
  errorBox: { gap: 10 },
  error: { color: colors.rose, fontSize: 13.5, fontWeight: "800", lineHeight: 22 },
  plusButton: { alignItems: "center", borderColor: colors.green, borderRadius: 999, borderWidth: 1.5, paddingVertical: 12 },
  plusButtonText: { color: colors.green, fontSize: 14, fontWeight: "900" },
  answerBody: { color: colors.ink, fontSize: 14.5, lineHeight: 26 },
  turnQuestion: { backgroundColor: colors.surfaceSoft, borderRadius: radius.control, gap: 6, marginBottom: 4, padding: 14 },
  turnBadge: { alignSelf: "flex-start", backgroundColor: "#e7f0e8", borderRadius: 14, color: colors.greenDark, fontSize: 11.5, fontWeight: "900", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 4 },
  turnQuestionText: { color: colors.ink, fontSize: 15, fontWeight: "800", lineHeight: 23 },
  check: { backgroundColor: colors.surfaceSoft, borderRadius: radius.control, gap: 4, padding: 14 },
  checkTitle: { color: colors.ink, fontSize: 14.5, fontWeight: "900", lineHeight: 23 },
  checkWhy: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  listRow: { flexDirection: "row", gap: 10 },
  dot: { backgroundColor: colors.green, borderRadius: 4, height: 7, marginTop: 8, width: 7 },
  listText: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 23 },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 6 }
});
