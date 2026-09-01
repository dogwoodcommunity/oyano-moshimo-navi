import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  consultAnswerToDiaryBody,
  consultAnswerToHistoryTurn,
  hasNotebookSubstance,
  CONSULT_MEMORY_CONSENT_TEXT,
  CONSULT_MAX_ENTRIES,
  CONSULT_MAX_HISTORY,
  CONSULT_MAX_QUESTION_LENGTH,
  CONSULT_SENT_FIELDS,
  CONSULT_WITHHELD_FIELDS,
  type ConsultAnswer
} from "@oyano/shared";
import {
  fetchConsultAccess,
  fetchConsultMemory,
  deleteConsultMemory,
  patchConsultMemory,
  readConsultConsent,
  requestConsult,
  writeConsultConsent,
  type ConsultAccess,
  type MobileConsultMemory
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

const IMPORTANT_CHANGES_PAGE_SIZE = 20;

type Phase = "loading" | "ready" | "asking" | "done" | "error";

/** 画面に積み上がる、1回ぶんの相談と回答。クラウド側でも対象者ごとの履歴として保存する。 */
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
  const [consentChanging, setConsentChanging] = useState(false);
  const [consentRevision, setConsentRevision] = useState(0);
  const [consentCanManageSharedMemory, setConsentCanManageSharedMemory] = useState(false);
  const [memory, setMemory] = useState<MobileConsultMemory | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [visibleImportantChangeCount, setVisibleImportantChangeCount] = useState(IMPORTANT_CHANGES_PAGE_SIZE);
  const [deleteScope, setDeleteScope] = useState<"memory" | "history" | "all" | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConsultTurn[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [message, setMessage] = useState("");
  const [access, setAccess] = useState<ConsultAccess>({
    signedIn: false,
    plan: "free",
    dailyFreeAvailable: false,
    dailyFreeUsedAt: null,
    canConsult: false
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [data, consultAccess] = await Promise.all([
        fetchDashboardData(),
        fetchConsultAccess()
      ]);
      if (!mounted) return;

      const active = data.person ?? data.people[0] ?? null;
      setPerson(active);
      setAccess(consultAccess);
      if (active) {
        const consentResult = await readConsultConsent(active.id);
        const activeConsent = consentResult.ok ? consentResult.data.active : false;
        if (mounted && consentResult.ok) {
          setConsent(activeConsent);
          setConsentRevision(consentResult.data.revision);
          setConsentCanManageSharedMemory(consentResult.data.canManageSharedMemory);
        }
        if (mounted && !consentResult.ok) setMessage(consentResult.message);
        if (activeConsent) {
          const memoryResult = await fetchConsultMemory(active.id);
          if (mounted && memoryResult.ok) {
            setMemory(memoryResult.data);
            setMemoryDraft(memoryResult.data.memory.userSummary);
          }
        }
      }

      if (active) {
        const timeline = await fetchTimelineEntries(active.id);
        if (mounted) setEntries(timeline);
      }
      if (mounted) setPhase("ready");
    }

    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // 対象者を切り替えた時に、前の人で開いていた表示件数を引き継がない。
    setVisibleImportantChangeCount(IMPORTANT_CHANGES_PAGE_SIZE);
  }, [person?.id]);

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
  const canAsk = access.canConsult && consent && !consentChanging && hasSubstance && question.trim().length >= 4 && phase !== "asking";

  async function toggleConsent() {
    if (!person || consentChanging) return;
    const next = !consent;
    setConsentChanging(true);
    if (!next) setConsent(false);
    const saved = await writeConsultConsent(person.id, next, consentRevision);
    if (saved.ok) {
      setConsent(saved.data.active);
      setConsentRevision(saved.data.revision);
      setConsentCanManageSharedMemory(saved.data.canManageSharedMemory);
      if (next) {
        const memoryResult = await fetchConsultMemory(person.id);
        if (memoryResult.ok) {
          setMemory(memoryResult.data);
          setMemoryDraft(memoryResult.data.memory.userSummary);
          setVisibleImportantChangeCount(IMPORTANT_CHANGES_PAGE_SIZE);
        } else {
          setMessage(memoryResult.message);
        }
      } else {
        setMemory(null);
        setMemoryDraft("");
        setVisibleImportantChangeCount(IMPORTANT_CHANGES_PAGE_SIZE);
      }
      setMessage(next
        ? "この人の長期記憶への同意を保存しました。別の端末にも反映されます。"
        : "この人の長期記憶への同意を取り消しました。別の端末にも反映されます。");
    } else {
      const current = await readConsultConsent(person.id);
      if (current.ok) {
        setConsent(current.data.active);
        setConsentRevision(current.data.revision);
        setConsentCanManageSharedMemory(current.data.canManageSharedMemory);
      } else if (!next) {
        setConsent(true);
      }
      setMessage(saved.message);
    }
    setConsentChanging(false);
  }

  async function refreshMemory() {
    if (!person || !consent) return null;
    const result = await fetchConsultMemory(person.id);
    if (result.ok) {
      setMemory(result.data);
      setMemoryDraft(result.data.memory.userSummary);
      setVisibleImportantChangeCount(IMPORTANT_CHANGES_PAGE_SIZE);
      return result.data;
    }
    setMessage(result.message);
    return null;
  }

  async function saveMemoryCorrection() {
    if (!person || !memory || !memory.canEditSharedMemory) return;
    const attemptedSummary = memoryDraft.trim();
    setMemoryBusy(true);
    const result = await patchConsultMemory(person.id, memory.memory.memoryVersion, {
      userSummary: attemptedSummary
    });
    if (result.ok) {
      setMemory(result.data);
      setMemoryDraft(result.data.memory.userSummary);
      setMessage("補足・訂正を専用AIの記憶へ反映しました。");
    } else if (result.code === "memory_conflict") {
      const latest = await fetchConsultMemory(person.id);
      if (latest.ok) {
        setMemory(latest.data);
        // 入力途中の訂正文は消さず、最新versionへ載せ替えて再実行できるようにする。
        setMemoryDraft(attemptedSummary);
      }
      setMessage("別の端末で記憶が更新されました。最新の内容を読み込みました。補足・訂正を確認して、もう一度保存してください。");
    } else {
      setMessage(result.message);
    }
    setMemoryBusy(false);
  }

  async function toggleMemorySource(sourceEventId: string, excluded: boolean) {
    if (!person || !memory || !memory.canEditSharedMemory) return;
    setMemoryBusy(true);
    const result = await patchConsultMemory(person.id, memory.memory.memoryVersion, excluded
      ? { includeEventId: sourceEventId }
      : { excludeEventId: sourceEventId });
    if (result.ok) {
      setMemory(result.data);
      setMemoryDraft(result.data.memory.userSummary);
    } else if (result.code === "memory_conflict") {
      const latest = await fetchConsultMemory(person.id);
      if (latest.ok) {
        setMemory(latest.data);
        setMemoryDraft(latest.data.memory.userSummary);
      }
      setMessage("別の端末で記憶が更新されました。最新の内容を読み込んだので、もう一度操作してください。");
    } else {
      setMessage(result.message);
    }
    setMemoryBusy(false);
  }

  async function confirmMemoryDelete() {
    if (!person || !deleteScope) return;
    setMemoryBusy(true);
    const result = await deleteConsultMemory(person.id, deleteScope);
    if (result.ok) {
      setMemory(result.data);
      setMemoryDraft(result.data?.memory.userSummary ?? "");
      setVisibleImportantChangeCount(IMPORTANT_CHANGES_PAGE_SIZE);
      setMessage(deleteScope === "history"
        ? "自分の相談履歴を削除しました。"
        : "家族共有のAI記憶を削除しました。元の手帳記録は残っています。");
      setDeleteScope(null);
    } else if (result.code === "partial_delete") {
      setMemory(null);
      setMemoryDraft("");
      setVisibleImportantChangeCount(IMPORTANT_CHANGES_PAGE_SIZE);
      setDeleteScope("history");
      setMessage("家族共有のAI記憶は削除済みです。相談履歴だけ残ったため、確認画面を『相談履歴を削除』へ切り替えました。もう一度削除してください。");
    } else {
      setMessage(result.message);
    }
    setMemoryBusy(false);
  }

  async function loadOlderHistory() {
    if (!person || !memory?.historyHasMore || memoryBusy) return;
    setMemoryBusy(true);
    const result = await fetchConsultMemory(person.id, memory.history.length);
    if (result.ok) {
      const byId = new Map([...result.data.history, ...memory.history].map((turn) => [turn.id, turn]));
      setMemory({
        ...result.data,
        history: [...byId.values()].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
      });
    } else {
      setMessage(result.message);
    }
    setMemoryBusy(false);
  }

  function renderMemoryDeleteControls(canManageSharedMemory: boolean) {
    return (
      <View style={styles.memoryDeleteBox}>
        <Text style={styles.sectionTitle}>記憶や相談履歴を削除する</Text>
        <Text style={styles.body}>元の手帳記録そのものは削除しません。削除は次の確認でもう一度押すまで実行されません。</Text>
        <Pressable disabled={memoryBusy} onPress={() => setDeleteScope("history")} style={styles.memoryDangerButton}>
          <Text style={styles.memoryDangerText}>自分の相談履歴を削除</Text>
        </Pressable>
        {canManageSharedMemory ? (
          <>
            <Pressable disabled={memoryBusy} onPress={() => setDeleteScope("memory")} style={styles.memoryDangerButton}>
              <Text style={styles.memoryDangerText}>家族全員のAI記憶を削除</Text>
            </Pressable>
            <Pressable disabled={memoryBusy} onPress={() => setDeleteScope("all")} style={styles.memoryDangerButton}>
              <Text style={styles.memoryDangerText}>家族共有の記憶と自分の履歴を削除</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.hint}>家族共有のAI記憶は、オーナーまたは管理者だけが削除できます。</Text>
        )}
        {deleteScope ? (
          <View style={styles.memoryDeleteConfirm}>
            <Text style={styles.checkTitle}>{deleteScope === "history"
              ? "自分の相談履歴を削除しますか？"
              : "この人の家族全員の専用AI記憶から削除しますか？"}</Text>
            <Text style={styles.body}>{deleteScope === "history"
              ? "手帳記録と家族共有のAI記憶は残ります。"
              : "元の手帳記録は残りますが、長期要約・重要な変化・家族の補足が家族全員の専用AIから消えます。"}</Text>
            <Pressable disabled={memoryBusy} onPress={() => void confirmMemoryDelete()} style={styles.memoryDangerPrimary}>
              <Text style={styles.primaryButtonText}>{memoryBusy ? "削除しています…" : "削除する"}</Text>
            </Pressable>
            <Pressable disabled={memoryBusy} onPress={() => setDeleteScope(null)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>やめる</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  async function ask() {
    if (!person) return;
    const asked = question.trim();
    setPhase("asking");
    setMessage("");

    // いま画面にある分も渡す。サーバーは保存済み履歴と重複させず、対象者ごとの続きとして扱う。
    const history = turns
      .slice(-CONSULT_MAX_HISTORY)
      .map((turn) => consultAnswerToHistoryTurn(turn.question, turn.answer));

    const result = await requestConsult({
      question: asked,
      // 対象者IDを正本にし、サーバーで家族権限を確認してから記録と長期記憶を取得する。
      personId: person.id,
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
    void refreshMemory();
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

  const importantChanges = memory?.memory.importantChanges ?? [];
  const visibleImportantChanges = importantChanges.slice(0, visibleImportantChangeCount);
  const hiddenImportantChangeCount = Math.max(0, importantChanges.length - visibleImportantChanges.length);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>長期相談</Text>
        <Text style={styles.title}>毎回ゼロから説明せずに、相談できます。</Text>
        <Text style={styles.body}>
          クラウドに保存したこの人の全期間の手帳記録と、あなた自身のこれまでの相談履歴を前提に、いま確認するとよいこと、窓口で聞くこと、相談先の候補を整理します。
          診断や法律・税務の結論は出しません。
        </Text>
        <ConsultAccessNotice access={access} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>送る情報と、送らない情報</Text>
        <Text style={styles.body}>
          {CONSULT_MEMORY_CONSENT_TEXT} 相談のたびに、下の内容だけを外部の生成AI（Anthropic Claude）へ送ります。送った内容は学習には使われません。
        </Text>
        <Text style={styles.body}>
          氏名・住所・病名など、本人を特定できる情報は相談文や手帳記録に入力しないでください。
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
        <Pressable disabled={consentChanging} onPress={toggleConsent} style={styles.consent}>
          <MaterialCommunityIcons
            color={consent ? colors.green : colors.line}
            name={consent ? "checkbox-marked" : "checkbox-blank-outline"}
            size={26}
          />
          <Text style={styles.consentText}>{consentChanging
            ? "同意状態を保存しています…"
            : "長期記憶への保存と、相談時のAI送信に同意します。（別端末にも反映されます）"}</Text>
        </Pressable>
        <Text style={styles.hint}>
          同意はこの人とあなたの組み合わせで保存され、別の端末にも反映されます。
        </Text>
      </View>

      {!consent ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>同意しないまま、保存済みデータを削除できます</Text>
          <Text style={styles.body}>同意を取り消した後でも、以前の相談履歴やAI記憶はここから削除できます。</Text>
          {renderMemoryDeleteControls(consentCanManageSharedMemory)}
          {message ? <Text style={styles.hint}>{message}</Text> : null}
        </View>
      ) : null}

      {consent ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>この人専用の長期記憶</Text>
          <Text style={styles.cardTitle}>専用AIが覚えていること</Text>
          {!memory ? (
            <>
              <Text style={styles.body}>クラウドに保存した手帳と相談履歴を読み込みます。</Text>
              <Pressable disabled={memoryBusy} onPress={() => void refreshMemory()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{memoryBusy ? "読み込んでいます…" : "記憶と相談履歴を読み込む"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.memoryStats}>
                <View style={styles.memoryStat}>
                  <Text style={styles.memoryStatValue}>{memory.memory.recordCount}</Text>
                  <Text style={styles.memoryStatLabel}>手帳記録</Text>
                </View>
                <View style={styles.memoryStat}>
                  <Text style={styles.memoryStatValue}>{memory.historyTotal}</Text>
                  <Text style={styles.memoryStatLabel}>保存済み相談</Text>
                </View>
              </View>

              <View style={styles.memoryFactBox}>
                <Text style={styles.disclosureLabel}>手帳の元記録から整理した事実</Text>
                <Text style={styles.answerBody}>{memory.memory.longTermSummary || "手帳の記録はまだありません。"}</Text>
              </View>

              <Text style={styles.sectionTitle}>重要な変化の履歴</Text>
              {memory.memory.importantChanges.length === 0 ? (
                <Text style={styles.body}>変化あり・急ぎの記録はまだありません。</Text>
              ) : visibleImportantChanges.map((change) => (
                <View key={change.sourceEventId} style={styles.memoryChange}>
                  <Text style={styles.memoryChangeMeta}>{change.date ?? "日付なし"}・{change.mood === "urgent" ? "急ぎ" : "変化あり"}</Text>
                  <Text style={styles.answerBody}>{change.summary}</Text>
                  {memory.canEditSharedMemory ? (
                    <Pressable
                      disabled={memoryBusy}
                      onPress={() => void toggleMemorySource(change.sourceEventId, false)}
                      style={styles.memorySmallButton}
                    >
                      <Text style={styles.memorySmallButtonText}>この記録をAIの記憶から外す</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {hiddenImportantChangeCount > 0 ? (
                <Pressable
                  disabled={memoryBusy}
                  onPress={() => setVisibleImportantChangeCount((current) => (
                    Math.min(current + IMPORTANT_CHANGES_PAGE_SIZE, importantChanges.length)
                  ))}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    さらに表示（残り{hiddenImportantChangeCount}件）
                  </Text>
                </Pressable>
              ) : null}
              {memory.excludedSources.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>AIの記憶から外している記録</Text>
                  {memory.excludedSources.map((source) => (
                    <View key={source.sourceEventId} style={styles.memoryChange}>
                      <Text style={styles.memoryChangeMeta}>{source.date ?? "日付なし"}・元の手帳記録は残っています</Text>
                      <Text style={styles.answerBody}>{source.body}</Text>
                      {memory.canEditSharedMemory ? (
                        <Pressable
                          disabled={memoryBusy}
                          onPress={() => void toggleMemorySource(source.sourceEventId, true)}
                          style={styles.memorySmallButton}
                        >
                          <Text style={styles.memorySmallButtonText}>この記録をAIの記憶へ戻す</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}

              <Text style={styles.sectionTitle}>あなた・家族の補足・訂正</Text>
              {memory.canEditSharedMemory ? (
                <>
                  <TextInput
                    maxLength={2000}
                    multiline
                    onChangeText={setMemoryDraft}
                    placeholder="元の記録と違うことや、AIに優先して覚えてほしいこと"
                    placeholderTextColor={colors.muted}
                    style={styles.memoryInput}
                    value={memoryDraft}
                  />
                  <Pressable disabled={memoryBusy} onPress={() => void saveMemoryCorrection()} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{memoryBusy ? "保存しています…" : "補足・訂正を記憶する"}</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.body}>{memory.memory.userSummary || "補足・訂正はありません。閲覧専用メンバーは変更できません。"}</Text>
              )}

              <Text style={styles.sectionTitle}>自動保存された相談履歴</Text>
              <Text style={styles.body}>手帳の事実とは分け、相談したあなた本人だけが見られる形で保存しています。あなた自身の全履歴の概要と、今回に関連する過去相談を次の回答に使います。</Text>
              {memory.history.length === 0 ? (
                <Text style={styles.body}>相談履歴はまだありません。</Text>
              ) : memory.history.map((turn) => (
                <View key={turn.id} style={styles.memoryHistoryTurn}>
                  <Text style={styles.memoryChangeMeta}>{turn.createdAt?.slice(0, 10) ?? "日付なし"}</Text>
                  <Text style={styles.turnQuestionText}>{turn.question}</Text>
                  <Text style={styles.body}>AIの整理: {turn.answer.situation}</Text>
                </View>
              ))}
              {memory.historyHasMore ? (
                <Pressable disabled={memoryBusy} onPress={() => void loadOlderHistory()} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{memoryBusy ? "読み込んでいます…" : "さらに前の相談を表示"}</Text>
                </Pressable>
              ) : null}

              {renderMemoryDeleteControls(memory.canManageSharedMemory)}
              {message ? <Text style={styles.hint}>{message}</Text> : null}
            </>
          )}
        </View>
      ) : null}

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
            クラウド側では、この人の全期間の手帳記録と、あなた自身の過去相談を保存し、全履歴の概要・直近の相談・今回に関連する古い相談を踏まえます。「その後こうなった」「次はどうすれば」と、続けて聞けます。
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
            {phase === "asking"
              ? "整理しています…"
              : !access.canConsult
                ? access.signedIn ? "今日の無料相談は利用済みです" : "メール確認後に使えます"
                : turns.length > 0 ? "続けて相談する" : "相談メモを作る"}
          </Text>
        </Pressable>
        {!access.canConsult && access.signedIn ? (
          <Link asChild href="/account/plan">
            <Pressable style={styles.plusButton}>
              <Text style={styles.plusButtonText}>Plusで今日も続けて相談する</Text>
            </Pressable>
          </Link>
        ) : null}
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
        <Text style={styles.accessText}>1日5回・月30回まで、この人の記録をもとに相談できます。</Text>
      </View>
    );
  }

  if (access.dailyFreeAvailable) {
    return (
      <View style={styles.accessNotice}>
        <Text style={styles.accessTitle}>今日は1回、無料で相談できます</Text>
        <Text style={styles.accessText}>相談に成功した時だけ今日の枠を使います。失敗では減らず、毎日0時に戻ります。</Text>
      </View>
    );
  }

  if (access.signedIn) {
    return (
      <View style={styles.accessNoticeMuted}>
        <Text style={styles.accessTitle}>今日の無料相談は利用済みです</Text>
        <Text style={styles.accessText}>明日0時からまた1回使えます。今すぐ続ける場合はPlusで使えます。</Text>
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
  memoryStats: { flexDirection: "row", gap: 10 },
  memoryStat: { alignItems: "center", backgroundColor: "#eef6f1", borderRadius: radius.control, flex: 1, gap: 2, padding: 12 },
  memoryStatValue: { color: colors.greenDark, fontSize: 20, fontWeight: "900" },
  memoryStatLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  memoryFactBox: { backgroundColor: "#f0f7f3", borderColor: "#cfe1d5", borderRadius: radius.control, borderWidth: 1, gap: 7, padding: 14 },
  memoryChange: { backgroundColor: colors.surfaceSoft, borderRadius: radius.control, gap: 6, padding: 13 },
  memoryChangeMeta: { color: colors.blue, fontSize: 11.5, fontWeight: "900" },
  memorySmallButton: { alignSelf: "flex-start", borderColor: colors.blue, borderRadius: 999, borderWidth: 1, marginTop: 3, paddingHorizontal: 12, paddingVertical: 8 },
  memorySmallButtonText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  memoryInput: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1.5, color: colors.ink, fontSize: 14, lineHeight: 23, minHeight: 96, padding: 13, textAlignVertical: "top" },
  memoryHistoryTurn: { borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, gap: 5, padding: 13 },
  memoryDeleteBox: { borderTopColor: colors.line, borderTopWidth: 1, gap: 9, marginTop: 6, paddingTop: 13 },
  memoryDangerButton: { alignItems: "center", borderColor: colors.rose, borderRadius: 999, borderWidth: 1, paddingVertical: 11 },
  memoryDangerText: { color: colors.rose, fontSize: 13, fontWeight: "900", textAlign: "center" },
  memoryDeleteConfirm: { backgroundColor: "#fff1ec", borderColor: "#e9c6b8", borderRadius: radius.control, borderWidth: 1, gap: 8, marginTop: 4, padding: 13 },
  memoryDangerPrimary: { alignItems: "center", backgroundColor: colors.rose, borderRadius: radius.control, paddingVertical: 13 },
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
