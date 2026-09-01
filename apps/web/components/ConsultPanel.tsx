"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CONSULT_MEMORY_CONSENT_TEXT,
  CONSULT_MEMORY_CONSENT_VERSION,
  CONSULT_MAX_QUESTION_LENGTH,
  CONSULT_SENT_FIELDS,
  CONSULT_WITHHELD_FIELDS,
  consultAnswerToDiaryBody,
  hasNotebookSubstance,
  normalizeConsultAnswer,
  statusLabel,
  type ConsultAnswer
} from "@oyano/shared";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { japanDateInputValue } from "@/lib/date";
import { trackFunnel } from "@/lib/funnel";
import { markMonitorActivity } from "@/lib/monitorSession";
import {
  addDiaryEntry,
  listDiaryEntries,
  listLocalCases,
  readNotebookCloudBinding,
  type CaseRecord
} from "@/lib/store";

const suggestedQuestions = [
  "いまの記録から、見落としていることはありますか",
  "退院後の生活をどう決めればいいですか",
  "介護保険の申請はどう進めればいいですか",
  "家族でどう役割を分ければいいですか",
  "次の受診で何を聞けばいいですか"
];

type Phase = "idle" | "loading" | "done" | "error";
type SaveSyncPhase = "idle" | "saving" | "saved" | "local-only" | "error";
type ConversationTurn = {
  id: string;
  question: string;
  answer: ConsultAnswer;
  disclaimer: string;
  saved: boolean;
  saveSyncPhase: SaveSyncPhase;
  saveSyncMessage: string;
  createdAt?: string;
};
type MemoryMode = "consent-required" | "checking" | "durable" | "temporary";
type MemoryImportantChange = {
  id: string;
  eventId?: string;
  title: string;
  detail?: string;
  date?: string;
  source: string;
  status: string;
  excluded: boolean;
};
type DurableMemory = {
  longTermSummary: string;
  userSummary: string;
  importantChanges: MemoryImportantChange[];
  recordCount: number;
  firstRecordDate: string | null;
  lastRecordDate: string | null;
  memoryVersion: number;
  updatedAt: string | null;
  excludedEventIds: string[];
};
type DurableMemoryPayload = {
  personId: string;
  memory: DurableMemory;
  turns: ConversationTurn[];
  historyTotal: number;
  historyHasMore: boolean;
  historyOffset: number;
  canEditSharedMemory: boolean;
  canManageSharedMemory: boolean;
};
type MemoryLoadResult =
  | { mode: "durable"; payload: DurableMemoryPayload }
  | { mode: "temporary"; reason: string };
type MemoryDeleteScope = "memory" | "history" | "all";
type DurablePersonIdentifier =
  | { personId: string }
  | { localCaseId: string; familyId: string };
type ConsultAccess = {
  signedIn: boolean;
  plan: "free" | "plus";
  dailyFreeAvailable: boolean;
  dailyFreeUsedAt: string | null;
  canConsult: boolean;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function importantChangeEventId(change: Record<string, unknown>) {
  return textValue(change.eventId)
    || textValue(change.sourceEventId)
    || textValue(change.timelineEventId)
    || textValue(change.id)
    || undefined;
}

function normalizeImportantChanges(value: unknown, excludedEventIds: string[], forceExcluded = false): MemoryImportantChange[] {
  if (!Array.isArray(value)) return [];
  const excluded = new Set(excludedEventIds);

  return value.flatMap((item, index) => {
    const change = recordValue(item);
    if (!change) return [];
    const eventId = importantChangeEventId(change);
    const title = textValue(change.title)
      || textValue(change.summary)
      || textValue(change.change)
      || textValue(change.description)
      || textValue(change.body)
      || "記録された変化";
    const detail = textValue(change.detail)
      || textValue(change.reason)
      || textValue(change.context)
      || undefined;
    const date = textValue(change.date)
      || textValue(change.eventDate)
      || textValue(change.sourceDate)
      || undefined;
    const source = textValue(change.source)
      || textValue(change.sourceLabel)
      || "手帳の記録";
    const rawStatus = textValue(change.status)
      || textValue(change.urgency)
      || textValue(change.mood);
    const status = rawStatus === "urgent"
      ? "急ぎ"
      : rawStatus === "changed"
        ? "変化あり"
        : rawStatus || "記録済み";
    return [{
      id: textValue(change.id) || eventId || `change-${index}`,
      eventId,
      title,
      detail,
      date,
      source,
      status,
      excluded: forceExcluded || Boolean(change.excluded) || Boolean(eventId && excluded.has(eventId))
    }];
  });
}

function historyToTurns(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    const historyItem = recordValue(item);
    if (!historyItem) return [];
    const answer = normalizeConsultAnswer(historyItem.answer);
    const question = textValue(historyItem.question);
    if (!answer || !question) return [];
    const savedAt = textValue(historyItem.savedToNotebookAt);
    return [{
      id: textValue(historyItem.id) || `saved-turn-${index}`,
      question,
      answer,
      disclaimer: textValue(historyItem.disclaimer),
      saved: Boolean(savedAt),
      saveSyncPhase: savedAt ? "saved" as const : "idle" as const,
      saveSyncMessage: savedAt ? "手帳へ保存した相談です。" : "",
      createdAt: textValue(historyItem.createdAt) || undefined
    }];
  });
}

function normalizeMemoryPayload(value: unknown): DurableMemoryPayload | null {
  const response = recordValue(value);
  const memory = recordValue(response?.memory);
  const personId = textValue(response?.personId);
  if (!response || !memory || !personId) return null;
  const excludedEventIds = Array.isArray(memory.excludedEventIds)
    ? memory.excludedEventIds.map(textValue).filter(Boolean)
    : [];

  const importantChanges = normalizeImportantChanges(memory.importantChanges, excludedEventIds);
  const excludedSources = normalizeImportantChanges(response.excludedSources, excludedEventIds, true);
  const changesById = new Map<string, MemoryImportantChange>();
  [...importantChanges, ...excludedSources].forEach((change) => changesById.set(change.eventId || change.id, change));

  return {
    personId,
    memory: {
      longTermSummary: textValue(memory.longTermSummary),
      userSummary: textValue(memory.userSummary),
      importantChanges: [...changesById.values()],
      recordCount: numberValue(memory.recordCount),
      firstRecordDate: textValue(memory.firstRecordDate) || null,
      lastRecordDate: textValue(memory.lastRecordDate) || null,
      memoryVersion: numberValue(memory.memoryVersion),
      updatedAt: textValue(memory.updatedAt) || null,
      excludedEventIds
    },
    turns: historyToTurns(response.history),
    historyTotal: numberValue(response.historyTotal) || historyToTurns(response.history).length,
    historyHasMore: Boolean(response.historyHasMore),
    historyOffset: numberValue(response.historyOffset),
    canEditSharedMemory: Boolean(response.canEditSharedMemory),
    canManageSharedMemory: Boolean(response.canManageSharedMemory)
  };
}

function memoryFallbackMessage(status: number, value: unknown) {
  const response = recordValue(value);
  const message = textValue(response?.message) || textValue(response?.error);
  if (message) return message;
  if (status === 401) return "メール確認がまだ完了していないため、長期記憶を使えません。";
  if (status === 404) return "この手帳とクラウド上の対象者が、まだ結び付いていません。";
  if (status === 409 || status === 501 || status === 503) return "長期記憶の準備がまだ完了していません。";
  return "長期記憶を確認できませんでした。クラウド保存を確認してから、もう一度開いてください。";
}

function durablePersonIdentifier(caseRecord: CaseRecord, authUserId: string): DurablePersonIdentifier | null {
  const personId = textValue(caseRecord.cloudPersonId);
  if (personId) return { personId };
  const binding = readNotebookCloudBinding();
  if (!binding || binding.authUserId !== authUserId || !binding.familyId) return null;
  return { localCaseId: caseRecord.id, familyId: binding.familyId };
}

function appendDurableIdentifier(params: URLSearchParams, identifier: DurablePersonIdentifier) {
  if ("personId" in identifier) {
    params.set("personId", identifier.personId);
  } else {
    params.set("localCaseId", identifier.localCaseId);
    params.set("familyId", identifier.familyId);
  }
}

async function requestDurableMemory(caseRecord: CaseRecord, historyOffset = 0): Promise<MemoryLoadResult> {
  const client = getBrowserSupabase();
  if (!client) {
    return { mode: "temporary", reason: "クラウド保存の環境設定がないため、長期記憶を準備できません。" };
  }
  const sessionData = (await client.auth.getSession()).data;
  const accessToken = sessionData.session?.access_token;
  const authUserId = sessionData.session?.user.id;
  if (!accessToken) {
    return { mode: "temporary", reason: "メール確認とクラウド保存をすると、この人専用の長期記憶を使えます。" };
  }
  const identifier = authUserId ? durablePersonIdentifier(caseRecord, authUserId) : null;
  if (!identifier) {
    return { mode: "temporary", reason: "この手帳を使う家族を確認できません。家族ボードでクラウド保存を確認してください。" };
  }

  try {
    const params = new URLSearchParams({ historyOffset: String(historyOffset) });
    appendDurableIdentifier(params, identifier);
    const response = await fetch(`/api/consult/memory?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Oyano-Memory-Consent-Version": CONSULT_MEMORY_CONSENT_VERSION
      }
    });
    const data: unknown = await response.json().catch(() => null);
    const payload = response.ok ? normalizeMemoryPayload(data) : null;
    if (payload) return { mode: "durable", payload };
    return { mode: "temporary", reason: memoryFallbackMessage(response.status, data) };
  } catch {
    return { mode: "temporary", reason: "通信できないため、長期記憶を確認できません。通信が戻ってから、もう一度開いてください。" };
  }
}

function formatMemoryDate(value?: string | null, withTime = false) {
  if (!value) return "日付なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

async function requestDurableConsent(caseRecord: CaseRecord): Promise<{
  active: boolean;
  revision: number;
  canManageSharedMemory: boolean;
  reason?: string;
}> {
  const client = getBrowserSupabase();
  if (!client) return { active: false, revision: 0, canManageSharedMemory: false, reason: "クラウド保存の環境設定がありません。" };
  const session = (await client.auth.getSession()).data.session;
  const accessToken = session?.access_token;
  if (!accessToken) return { active: false, revision: 0, canManageSharedMemory: false, reason: "メール確認とクラウド保存を先に設定してください。" };
  const identifier = durablePersonIdentifier(caseRecord, session.user.id);
  if (!identifier) return { active: false, revision: 0, canManageSharedMemory: false, reason: "この手帳を使う家族を確認できません。家族ボードでクラウド保存を確認してください。" };
  try {
    const params = new URLSearchParams();
    appendDurableIdentifier(params, identifier);
    const response = await fetch(`/api/consult/memory/consent?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data: unknown = await response.json().catch(() => null);
    const row = recordValue(data);
    const consent = recordValue(row?.consent);
    if (!response.ok) return { active: false, revision: 0, canManageSharedMemory: false, reason: memoryFallbackMessage(response.status, data) };
    return {
      active: Boolean(consent?.active),
      revision: Math.max(0, Math.floor(numberValue(consent?.revision))),
      canManageSharedMemory: Boolean(row?.canManageSharedMemory)
    };
  } catch {
    return { active: false, revision: 0, canManageSharedMemory: false, reason: "通信できないため、長期記憶の同意状態を確認できません。" };
  }
}

async function changeDurableConsent(caseRecord: CaseRecord, action: "accept" | "revoke", revision: number) {
  const client = getBrowserSupabase();
  const session = client ? (await client.auth.getSession()).data.session : null;
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("メール確認とクラウド保存を先に設定してください。");
  const identifier = durablePersonIdentifier(caseRecord, session.user.id);
  if (!identifier) throw new Error("この手帳を使う家族を確認できません。家族ボードでクラウド保存を確認してください。");
  const response = await fetch("/api/consult/memory/consent", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identifier,
      action,
      version: CONSULT_MEMORY_CONSENT_VERSION,
      acceptedVia: "web",
      revision
    })
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(memoryFallbackMessage(response.status, data));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const row = recordValue(data);
  const savedConsent = recordValue(row?.consent);
  return {
    active: Boolean(savedConsent?.active),
    revision: Math.max(0, Math.floor(numberValue(savedConsent?.revision))),
    canManageSharedMemory: Boolean(row?.canManageSharedMemory)
  };
}

function todayInputValue() {
  return japanDateInputValue();
}

function consultNotebookBaseName(caseRecord: CaseRecord) {
  const profile = caseRecord.personProfile;
  const candidates = [
    profile?.displayName,
    profile?.fullName,
    caseRecord.answers.targetName,
    profile?.relationship ? `${profile.relationship}の手帳` : undefined
  ];
  const name = candidates.find((item) => item?.trim())?.trim();
  return name || "名前未入力";
}

function consultNotebookLabel(caseRecord: CaseRecord, index: number, allCases: CaseRecord[]) {
  const baseName = consultNotebookBaseName(caseRecord);
  const sameNameCount = allCases.filter((item) => consultNotebookBaseName(item) === baseName).length;
  const shouldPrefix = sameNameCount > 1 || baseName === "名前未入力" || baseName === "この手帳";
  return shouldPrefix ? `${index + 1}人目：${baseName}` : baseName;
}

function consultNotebookMeta(caseRecord: CaseRecord) {
  const createdAt = new Date(caseRecord.createdAt);
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? "作成日未設定"
    : `${createdAt.getMonth() + 1}/${createdAt.getDate()}作成`;
  return `${statusLabel(caseRecord.selectedStatus)}・${createdLabel}`;
}

export function ConsultPanel() {
  const [loaded, setLoaded] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSubstance, setHasSubstance] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [consultAccess, setConsultAccess] = useState<ConsultAccess | null>(null);
  const [openedFromRecord, setOpenedFromRecord] = useState(false);
  const [memoryMode, setMemoryMode] = useState<MemoryMode>("consent-required");
  const [memoryReason, setMemoryReason] = useState("");
  const [memoryPayload, setMemoryPayload] = useState<DurableMemoryPayload | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryEditing, setMemoryEditing] = useState(false);
  const [memoryAction, setMemoryAction] = useState<"idle" | "saving" | "updating" | "deleting">("idle");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentRevision, setConsentRevision] = useState(0);
  const [consentCanManageSharedMemory, setConsentCanManageSharedMemory] = useState(false);
  const [memoryMessage, setMemoryMessage] = useState("");
  const [deleteIntent, setDeleteIntent] = useState<MemoryDeleteScope | null>(null);
  const memoryRequestRef = useRef(0);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    const localCases = listLocalCases();
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const requestedCaseId = params?.get("caseId") ?? undefined;
    const requestedQuestion = params?.get("q")?.trim() ?? "";
    const initialCase = requestedCaseId && localCases.some((item) => item.id === requestedCaseId)
      ? requestedCaseId
      : localCases[0]?.id;

    setCases(localCases);
    setActiveCaseId(initialCase);
    if (requestedQuestion) {
      setQuestion(requestedQuestion.slice(0, CONSULT_MAX_QUESTION_LENGTH));
      setOpenedFromRecord(true);
    }
    setLoaded(true);

    const client = getBrowserSupabase();
    void (async () => {
      try {
        const data = client ? (await client.auth.getSession()).data : null;
        if (cancelled) return;
        const token = data?.session?.access_token;
        const response = await fetch("/api/consult", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const access = await response.json().catch(() => null) as ConsultAccess | null;
        if (!cancelled && response.ok && access) setConsultAccess(access);
      } catch {
        // 利用条件の確認に失敗しても、送信時にAPI側で再判定できる。
        if (!cancelled) setConsultAccess(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId),
    [cases, activeCaseId]
  );
  const durableMemoryEnabled = memoryMode === "durable" && Boolean(memoryPayload?.personId);
  const needsPlus = Boolean(authChecked && consultAccess && !consultAccess.canConsult);
  const submitDisabled = !authChecked
    || !durableMemoryEnabled
    || !consent
    || consentSaving
    || !hasSubstance
    || question.trim().length < 4
    || phase === "loading";
  const consultButtonLabel = phase === "loading"
    ? "整理しています…"
    : memoryMode === "checking"
      ? "専用AIの記憶を確認しています…"
    : !authChecked
      ? "利用条件を確認しています…"
      : turns.length > 0
        ? "続けて相談する"
      : consultAccess?.dailyFreeAvailable
        ? "今日の無料AI相談を使う"
        : "AI相談をはじめる";

  useEffect(() => {
    if (!activeCase) return;
    setHasSubstance(hasNotebookSubstance({
      question: "",
      person: activeCase.personProfile,
      entries: listDiaryEntries(activeCase.id).map((entry) => ({ body: entry.body }))
    }));
  }, [activeCase]);

  useEffect(() => {
    if (!activeCase) return;
    const requestId = memoryRequestRef.current + 1;
    memoryRequestRef.current = requestId;
    setMemoryMode("checking");
    setConsent(false);
    setMemoryReason("");
    setConsentRevision(0);
    setConsentCanManageSharedMemory(false);
    setMemoryPayload(null);
    setMemoryDraft("");
    setMemoryEditing(false);
    setMemoryMessage("");
    setDeleteIntent(null);
    setTurns([]);

    void (async () => {
      const consentResult = await requestDurableConsent(activeCase);
      if (memoryRequestRef.current !== requestId) return;
      setConsentRevision(consentResult.revision);
      setConsentCanManageSharedMemory(consentResult.canManageSharedMemory);
      if (!consentResult.active) {
        setConsent(false);
        setMemoryMode(consentResult.reason ? "temporary" : "consent-required");
        setMemoryReason(consentResult.reason ?? "");
        return;
      }
      setConsent(true);
      const result = await requestDurableMemory(activeCase);
      if (memoryRequestRef.current !== requestId) return;
      if (result.mode === "durable") {
        setMemoryMode("durable");
        setMemoryPayload(result.payload);
        setMemoryDraft(result.payload.memory.userSummary);
        setTurns(result.payload.turns);
        setMemoryReason("");
        return;
      }
      setMemoryMode("temporary");
      setMemoryReason(result.reason);
      setMemoryPayload(null);
      setTurns([]);
    })();
  }, [activeCase]);

  async function refreshDurableMemory(options?: { keepMessage?: boolean }) {
    if (!activeCase) return null;
    const requestId = memoryRequestRef.current + 1;
    memoryRequestRef.current = requestId;
    const result = await requestDurableMemory(activeCase);
    if (memoryRequestRef.current !== requestId) return null;
    if (result.mode === "durable") {
      setMemoryMode("durable");
      setMemoryPayload(result.payload);
      setMemoryDraft(result.payload.memory.userSummary);
      setTurns(result.payload.turns);
      setMemoryReason("");
      if (!options?.keepMessage) setMemoryMessage("");
      return result.payload;
    }
    if (memoryMode === "durable" && memoryPayload) {
      setMemoryMessage(`${result.reason} 直前に確認できた長期記憶の表示は維持しています。`);
      return null;
    }
    setMemoryMode("temporary");
    setMemoryReason(result.reason);
    setMemoryPayload(null);
    setTurns([]);
    return null;
  }

  async function sendMemoryPatch(body: Record<string, unknown>) {
    if (!memoryPayload?.personId) throw new Error("専用AIの対象者を確認できませんでした。");
    const client = getBrowserSupabase();
    const sessionData = client ? (await client.auth.getSession()).data : null;
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("メール確認をやり直してから、もう一度お試しください。");
    const response = await fetch("/api/consult/memory", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Oyano-Memory-Consent-Version": CONSULT_MEMORY_CONSENT_VERSION
      },
      body: JSON.stringify({
        personId: memoryPayload.personId,
        memoryConsentVersion: CONSULT_MEMORY_CONSENT_VERSION,
        memoryVersion: memoryPayload.memory.memoryVersion,
        ...body
      })
    });
    const data: unknown = await response.json().catch(() => null);
    const responseData = recordValue(data);
    if (response.status === 409 && textValue(responseData?.error) === "memory_conflict") {
      await refreshDurableMemory({ keepMessage: true });
      throw new Error("別の端末で記憶が更新されました。最新の内容に更新したので、内容を確認してもう一度お試しください。");
    }
    if (!response.ok) throw new Error(memoryFallbackMessage(response.status, data));
    return data;
  }

  async function saveMemoryCorrection() {
    if (!memoryPayload) return;
    const attemptedSummary = memoryDraft.trim();
    setMemoryAction("saving");
    setMemoryMessage("");
    try {
      await sendMemoryPatch({ userSummary: attemptedSummary });
      await refreshDurableMemory({ keepMessage: true });
      setMemoryEditing(false);
      setMemoryMessage(attemptedSummary
        ? "あなたの補足・訂正を専用AIの記憶へ反映しました。"
        : "あなたが追加した補足・訂正を削除しました。");
    } catch (error) {
      setMemoryDraft(attemptedSummary);
      setMemoryMessage(error instanceof Error ? error.message : "補足・訂正を保存できませんでした。");
    } finally {
      setMemoryAction("idle");
    }
  }

  async function toggleMemorySource(eventId: string, excluded: boolean) {
    if (!eventId) return;
    setMemoryAction("updating");
    setMemoryMessage("");
    try {
      await sendMemoryPatch(excluded
        ? { includeEventId: eventId, sourceEventId: eventId, excluded: false }
        : { excludeEventId: eventId, sourceEventId: eventId, excluded: true });
      await refreshDurableMemory({ keepMessage: true });
      setMemoryMessage(excluded
        ? "この記録を専用AIの記憶に戻しました。"
        : "元の手帳記録は残したまま、専用AIの記憶から外しました。");
    } catch (error) {
      setMemoryMessage(error instanceof Error ? error.message : "記憶に使う記録を変更できませんでした。");
    } finally {
      setMemoryAction("idle");
    }
  }

  async function markDurableTurnSaved(turnId: string) {
    if (!durableMemoryEnabled) return;
    try {
      await sendMemoryPatch({ markSavedTurnId: turnId });
    } catch {
      // 手帳本体への保存は完了しているため、相談履歴の表示更新だけで失敗扱いにしない。
    }
  }

  async function loadOlderConsultHistory() {
    if (!activeCase || !memoryPayload?.historyHasMore || historyLoading) return;
    setHistoryLoading(true);
    setMemoryMessage("");
    try {
      const result = await requestDurableMemory(activeCase, turns.length);
      if (result.mode !== "durable") throw new Error(result.reason);
      const older = result.payload.turns;
      setTurns((current) => {
        const byId = new Map([...older, ...current].map((turn) => [turn.id, turn]));
        return [...byId.values()].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      });
      setMemoryPayload((current) => current ? {
        ...current,
        historyTotal: result.payload.historyTotal,
        historyHasMore: result.payload.historyHasMore,
        historyOffset: 0,
        turns: [...older, ...current.turns]
      } : result.payload);
    } catch (error) {
      setMemoryMessage(error instanceof Error ? error.message : "前の相談履歴を読み込めませんでした。");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function confirmMemoryDelete() {
    if (!deleteIntent || !activeCase) return;
    setMemoryAction("deleting");
    setMemoryMessage("");
    try {
      const client = getBrowserSupabase();
      const session = client ? (await client.auth.getSession()).data.session : null;
      const accessToken = session?.access_token;
      if (!session || !accessToken) throw new Error("メール確認をやり直してから、もう一度お試しください。");
      const identifier: DurablePersonIdentifier | null = memoryPayload?.personId
        ? { personId: memoryPayload.personId }
        : durablePersonIdentifier(activeCase, session.user.id);
      if (!identifier) throw new Error("この手帳を使う家族を確認できません。家族ボードでクラウド保存を確認してください。");
      const params = new URLSearchParams({ scope: deleteIntent });
      appendDurableIdentifier(params, identifier);
      const response = await fetch(`/api/consult/memory?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data: unknown = await response.json().catch(() => null);
      const responseData = recordValue(data);
      if (response.status === 500 && textValue(responseData?.error) === "partial_delete") {
        setTurns([]);
        setDeleteIntent("history");
        if (consent) await refreshDurableMemory({ keepMessage: true });
        const partialMessage = "家族共有のAI記憶は削除済みです。相談履歴だけ残ったため、確認画面を『相談履歴を削除』へ切り替えました。もう一度削除してください。";
        setMemoryMessage(partialMessage);
        return;
      }
      if (!response.ok) throw new Error(memoryFallbackMessage(response.status, data));
      const deletedScope = deleteIntent;
      if (deletedScope === "history" || deletedScope === "all") setTurns([]);
      setDeleteIntent(null);
      if (consent) await refreshDurableMemory({ keepMessage: true });
      const successMessage = deletedScope === "memory"
        ? "専用AIの要約・変化・補足を削除しました。元の手帳記録は残りますが、長期記憶からは外れました。これから追加する新しい記録だけを覚えます。"
        : deletedScope === "history"
          ? "これまでのAI相談履歴を削除しました。手帳記録と専用AIの記憶は残っています。"
          : "専用AIの記憶とAI相談履歴を削除しました。元の手帳記録は残りますが、長期記憶からは外れました。これから追加する新しい記録だけを覚えます。";
      setMemoryMessage(successMessage);
    } catch (error) {
      setMemoryMessage(error instanceof Error ? error.message : "削除できませんでした。");
    } finally {
      setMemoryAction("idle");
    }
  }

  async function toggleConsent(next: boolean) {
    if (!activeCase || consentSaving) return;
    const caseRecord = activeCase;
    const requestId = memoryRequestRef.current + 1;
    memoryRequestRef.current = requestId;
    setConsentSaving(true);
    setMemoryReason("");
    if (!next) {
      // 取消通信中に旧同意のまま相談を送れないよう、先に画面を停止する。
      setConsent(false);
    }
    try {
      const changed = await changeDurableConsent(caseRecord, next ? "accept" : "revoke", consentRevision);
      if (memoryRequestRef.current !== requestId) return;
      setConsentRevision(changed.revision);
      setConsentCanManageSharedMemory(changed.canManageSharedMemory);
      if (!next) {
        setConsent(false);
        setMemoryMode("consent-required");
        setMemoryPayload(null);
        setMemoryDraft("");
        setTurns([]);
        setMemoryReason("この人への長期記憶・AI送信の同意を取り消しました。別の端末にも反映されます。保存済みデータは削除していません。");
        return;
      }
      setConsent(true);
      setMemoryMode("checking");
      const result = await requestDurableMemory(caseRecord);
      if (memoryRequestRef.current !== requestId) return;
      if (result.mode !== "durable") {
        setMemoryMode("temporary");
        setMemoryReason(result.reason);
        return;
      }
      setMemoryMode("durable");
      setMemoryPayload(result.payload);
      setMemoryDraft(result.payload.memory.userSummary);
      setTurns(result.payload.turns);
    } catch (error) {
      if (memoryRequestRef.current !== requestId) return;
      const current = await requestDurableConsent(caseRecord);
      if (memoryRequestRef.current !== requestId) return;
      setConsent(current.active);
      setConsentRevision(current.revision);
      setConsentCanManageSharedMemory(current.canManageSharedMemory);
      setMemoryReason(error instanceof Error ? error.message : "同意状態を変更できませんでした。");
      if (!current.active) {
        setMemoryMode(current.reason ? "temporary" : "consent-required");
        setMemoryPayload(null);
        setMemoryDraft("");
        setTurns([]);
        return;
      }
      setMemoryMode("checking");
      const result = await requestDurableMemory(caseRecord);
      if (memoryRequestRef.current !== requestId) return;
      if (result.mode === "durable") {
        setMemoryMode("durable");
        setMemoryPayload(result.payload);
        setMemoryDraft(result.payload.memory.userSummary);
        setTurns(result.payload.turns);
      } else {
        setMemoryMode("temporary");
        setMemoryReason(result.reason);
      }
    } finally {
      setConsentSaving(false);
    }
  }

  function updateTurn(id: string, patch: Partial<ConversationTurn>) {
    setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, ...patch } : turn));
  }

  function selectCase(caseId: string) {
    if (phase === "loading" || memoryAction !== "idle") return;
    setActiveCaseId(caseId);
    setTurns([]);
    setQuestion("");
    setErrorMessage("");
    setOpenedFromRecord(false);
    setPhase("idle");
  }

  function addSuggestedQuestion(item: string) {
    setQuestion((current) => {
      const existing = current.trim();
      if (!existing) return item;
      if (existing.includes(item)) return current;
      return `${existing}\n\n${item}`.slice(0, CONSULT_MAX_QUESTION_LENGTH);
    });
    window.setTimeout(() => {
      questionRef.current?.focus();
      questionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 40);
  }

  async function submit() {
    if (!activeCase || !durableMemoryEnabled || !memoryPayload?.personId || question.trim().length < 4) return;

    const submittedQuestion = question.trim();
    setPhase("loading");
    setErrorMessage("");

    try {
      const client = getBrowserSupabase();
      const sessionData = client ? (await client.auth.getSession()).data : null;
      const accessToken = sessionData?.session?.access_token;
      setAuthChecked(true);

      const response = await fetch("/api/consult", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          question: submittedQuestion,
          personId: memoryPayload.personId,
          memoryConsentVersion: CONSULT_MEMORY_CONSENT_VERSION
        })
      });
      const data: unknown = await response.json().catch(() => null);

      const responseData = recordValue(data);
      const answer = normalizeConsultAnswer(responseData?.answer);
      if (!response.ok || !answer) {
        setErrorMessage(textValue(responseData?.message) || "うまく整理できませんでした。もう一度お試しください。");
        setPhase("error");
        return;
      }

      const returnedMemory = normalizeMemoryPayload(data);
      const returnedMemoryMetadata = recordValue(responseData?.memory);
      const generatedTurnId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${turns.length}`;
      const returnedTurns = returnedMemory?.turns ?? [];
      const turnId = returnedTurns.at(-1)?.id
        ?? textValue(returnedMemoryMetadata?.persistedTurnId)
        ?? generatedTurnId;
      const newTurn: ConversationTurn = {
          id: turnId,
          question: submittedQuestion,
          answer,
          disclaimer: textValue(responseData?.disclaimer),
          saved: false,
          saveSyncPhase: "idle",
          saveSyncMessage: ""
      };
      if (returnedMemory) {
        setMemoryPayload(returnedMemory);
        setMemoryDraft(returnedMemory.memory.userSummary);
        setTurns(returnedTurns.length > 0 ? returnedTurns : (current) => [...current, newTurn]);
      } else {
        setTurns((current) => [...current, newTurn]);
      }
      setQuestion("");
      setOpenedFromRecord(false);
      const accessResponse = await fetch("/api/consult", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      const access = await accessResponse.json().catch(() => null) as ConsultAccess | null;
      if (accessResponse.ok && access) setConsultAccess(access);
      trackFunnel("consult_asked");
      markMonitorActivity("aiConsultCompleted");
      setPhase("done");
      if (!returnedMemory) {
        void refreshDurableMemory({ keepMessage: true });
      }
      window.setTimeout(() => {
        document.getElementById(`consult-turn-${turnId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 80);
    } catch {
      setErrorMessage("通信できませんでした。電波のよい場所でもう一度お試しください。");
      setPhase("error");
    }
  }

  async function saveToNotebook(turn: ConversationTurn) {
    if (!activeCase) return;

    const savedEntry = addDiaryEntry({
      caseId: activeCase.id,
      date: todayInputValue(),
      mood: "stable",
      body: consultAnswerToDiaryBody(turn.question, turn.answer),
      attachments: []
    });
    updateTurn(turn.id, {
      saved: true,
      saveSyncPhase: "saving",
      saveSyncMessage: "クラウドにも保存しています。"
    });
    try {
      const client = getBrowserSupabase();
      if (!client) {
        updateTurn(turn.id, {
          saveSyncPhase: "local-only",
          saveSyncMessage: "この端末の手帳に残しました。家族ボードでメール確認をすると、クラウドにも保存できます。"
        });
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) {
        updateTurn(turn.id, {
          saveSyncPhase: "local-only",
          saveSyncMessage: "この端末の手帳に残しました。家族ボードでメール確認をすると、クラウドにも保存できます。"
        });
        return;
      }
      const accessToken = session.access_token;
      const binding = readNotebookCloudBinding();
      if (!binding || binding.authUserId !== session.user.id || !binding.familyId) {
        updateTurn(turn.id, {
          saveSyncPhase: "local-only",
          saveSyncMessage: "この端末の手帳に残しました。家族ボードで使う家族を確認すると、クラウドにも保存できます。"
        });
        return;
      }

      const response = await fetch("/api/notebook/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          familyId: binding.familyId,
          requestId: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `consult-save-${Date.now()}`,
          cases: [activeCase],
          diaryEntries: [savedEntry]
        })
      });

      if (!response.ok) {
        updateTurn(turn.id, {
          saveSyncPhase: "error",
          saveSyncMessage: "この端末の手帳には残しました。クラウド保存は家族ボードで確認してください。"
        });
        return;
      }

      await markDurableTurnSaved(turn.id);
      updateTurn(turn.id, {
        saveSyncPhase: "saved",
        saveSyncMessage: "クラウドにも保存しました。"
      });
    } catch {
      updateTurn(turn.id, {
        saveSyncPhase: "error",
        saveSyncMessage: "この端末の手帳には残しました。通信できる場所で家族ボードを開くと、クラウドにも保存できます。"
      });
    }
  }

  if (!loaded) {
    return <p className="consult-loading">読み込み中です</p>;
  }

  if (!activeCase) {
    return (
      <section className="consult-empty">
        <h2>先に1人分の手帳を作ってください</h2>
        <p>相談は、その人のプロフィールと記録を前提に整理します。手帳がないと、一般論しか返せません。</p>
        <Link className="button" href="/start">手帳を作る</Link>
      </section>
    );
  }

  return (
    <div className="consult-panel">
      {cases.length > 1 ? (
        <div className="consult-case-picker" aria-label="相談する手帳">
          <div className="consult-step-head">
            <span>1</span>
            <div>
              <strong>相談する手帳を選ぶ</strong>
              <small>複数ある時は、まず誰の相談かを選びます。</small>
            </div>
          </div>
          <div className="consult-case-tabs" role="group">
            {cases.map((caseRecord, index) => (
              <button
                className={caseRecord.id === activeCaseId ? "is-active" : ""}
                disabled={phase === "loading" || memoryAction !== "idle"}
                key={caseRecord.id}
                onClick={() => selectCase(caseRecord.id)}
                type="button"
              >
                <strong>{consultNotebookLabel(caseRecord, index, cases)}</strong>
                <small>{consultNotebookMeta(caseRecord)}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="consult-chat" aria-label="AI相談チャット">
        <header className="consult-chat-head">
          <div className="consult-chat-title">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <div>
              <p>AI相談チャット</p>
              <h2>{consultNotebookBaseName(activeCase)}の手帳を読んで答えます</h2>
            </div>
          </div>
          <p className="consult-plan-status">
            {memoryMode === "consent-required"
              ? "長期記憶への同意が必要"
              : memoryMode === "checking"
              ? "長期記憶を確認中"
              : memoryMode === "temporary"
                ? "長期記憶の準備が必要"
            : !authChecked
              ? "利用条件を確認中"
              : consultAccess?.plan === "plus"
                ? "Family Plus・1日5回／月30回まで"
                : consultAccess?.dailyFreeAvailable
                  ? "無料・今日は1回相談できます"
                  : "今日の無料相談は利用済みです"}
          </p>
        </header>

        {memoryMode === "consent-required" ? (
          <section className="consult-memory-fallback is-consent" aria-label="この人専用AIの長期記憶への同意">
            <div>
              <span>最初に確認してください</span>
              <h2>この人の記録と相談を、次回にも引き継ぎます</h2>
            </div>
            <p>{CONSULT_MEMORY_CONSENT_TEXT}</p>
            <p>
              相談時は必要な要約と関連記録だけを外部の生成AIへ送ります。氏名・住所・病名など、本人を特定できる情報は記録や相談文に入力しないでください。
            </p>
            <label className="consult-consent consult-memory-consent">
              <input checked={consent} disabled={consentSaving} onChange={(event) => void toggleConsent(event.target.checked)} type="checkbox" />
              <span>{consentSaving ? "同意状態を保存しています…" : "長期記憶への保存と、相談時のAI送信に同意します。"}</span>
            </label>
            {memoryReason ? <p className="consult-error" role="status">{memoryReason}</p> : null}
            {memoryMessage ? <p className="consult-memory-message" role="status">{memoryMessage}</p> : null}
            <details className="consult-memory-delete">
              <summary>同意しないまま、保存済みデータを削除する</summary>
              <p>同意を取り消した後でも、保存済みの相談履歴やAI記憶は削除できます。元の手帳記録そのものは削除しません。</p>
              <div className="consult-memory-delete-actions">
                <button disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent("history")} type="button">自分の相談履歴を削除</button>
                {consentCanManageSharedMemory ? (
                  <button disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent("memory")} type="button">家族共有のAI記憶を削除</button>
                ) : null}
                {consentCanManageSharedMemory ? (
                  <button disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent("all")} type="button">家族共有の記憶と自分の相談履歴を削除</button>
                ) : null}
              </div>
              {!consentCanManageSharedMemory ? (
                <p>家族共有のAI記憶はオーナーまたは管理者だけが削除できます。ここでは自分の相談履歴を削除できます。</p>
              ) : null}
              {deleteIntent ? (
                <div className="consult-memory-delete-confirm" role="alert">
                  <strong>{deleteIntent === "history"
                    ? "これまでのAI相談履歴を削除しますか？"
                    : deleteIntent === "memory"
                      ? "この人の家族全員の専用AI記憶を削除しますか？"
                      : "家族全員のAI記憶と、自分の相談履歴を両方削除しますか？"}</strong>
                  <p>{deleteIntent === "history"
                    ? "相談履歴だけを削除します。元の手帳記録と家族共有のAI記憶は残ります。"
                    : "長期要約・重要な変化・家族の補足が家族全員の専用AIから消えます。元の手帳記録そのものは削除されません。"}</p>
                  <div>
                    <button disabled={memoryAction !== "idle"} onClick={confirmMemoryDelete} type="button">
                      {memoryAction === "deleting" ? "削除しています…" : "削除する"}
                    </button>
                    <button className="is-secondary" disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent(null)} type="button">やめる</button>
                  </div>
                </div>
              ) : null}
            </details>
          </section>
        ) : memoryMode === "checking" ? (
          <section className="consult-memory-card is-checking" aria-busy="true" aria-label="専用AIの長期記憶">
            <div className="consult-memory-head">
              <div>
                <span>この人専用の長期記憶</span>
                <h2>専用AIが覚えていること</h2>
              </div>
              <strong>確認中</strong>
            </div>
            <p className="consult-memory-loading" role="status">クラウドに保存された記録と、あなた自身のこれまでの相談を読み込んでいます。</p>
          </section>
        ) : memoryMode === "temporary" ? (
          <section className="consult-memory-fallback" aria-label="長期記憶の準備が必要">
            <div>
              <span>専用AIを使うための準備</span>
              <h2>長期記憶の準備が終わるまで、相談は送信しません</h2>
            </div>
            <p>{memoryReason}</p>
            <p>その場限りの回答には戻しません。クラウド保存とメール確認を終えると、この人の全記録と、あなた自身の相談履歴を継続して踏まえる専用AIとして使えます。</p>
            <Link href="/home#cloud-backup">クラウド保存とメール確認を設定する</Link>
          </section>
        ) : memoryPayload ? (
          <section className="consult-memory-card" aria-label="専用AIが覚えていること">
            <div className="consult-memory-head">
              <div>
                <span>この人専用の長期記憶</span>
                <h2>専用AIが覚えていること</h2>
              </div>
              <strong>長期記憶 有効</strong>
            </div>

            <p className="consult-memory-purpose">
              クラウドにあるこの人の手帳記録を継続して読み、長期要約・重要な変化・関連する過去記録・あなた自身のこれまでの相談を踏まえて答えます。
            </p>

            <div className="consult-memory-legend" aria-label="事実とAI提案の区別">
              <div>
                <strong>手帳に書いた事実</strong>
                <span>あなたや家族が記録した元の内容です</span>
              </div>
              <div>
                <strong>あなた・家族の補足・訂正</strong>
                <span>AIより優先して覚えさせる内容です</span>
              </div>
              <div>
                <strong>AIからの提案</strong>
                <span>事実ではなく、次に確認するための案です</span>
              </div>
            </div>

            <div className="consult-memory-stats" aria-label="記憶に使っている記録の範囲">
              <div><strong>{memoryPayload.memory.recordCount}</strong><span>件の手帳記録</span></div>
              <div>
                <strong>{memoryPayload.memory.firstRecordDate ? formatMemoryDate(memoryPayload.memory.firstRecordDate) : "まだなし"}</strong>
                <span>最初の記録</span>
              </div>
              <div>
                <strong>{memoryPayload.memory.lastRecordDate ? formatMemoryDate(memoryPayload.memory.lastRecordDate) : "まだなし"}</strong>
                <span>最新の記録</span>
              </div>
            </div>

            <div className="consult-memory-summary">
              <div className="consult-memory-section-head">
                <div>
                  <span>手帳の元記録から整理</span>
                  <h3>これまでの状況</h3>
                </div>
                <small>元の記録に基づく事実</small>
              </div>
              <p>{memoryPayload.memory.longTermSummary || "記録が増えると、ここにこれまでの状況がまとめられます。"}</p>
            </div>

            <div className="consult-memory-correction">
              <div className="consult-memory-section-head">
                <div>
                  <span>あなた・家族の補足・訂正</span>
                  <h3>AIに必ず覚えてほしいこと</h3>
                </div>
                {!memoryEditing && memoryPayload.canEditSharedMemory ? (
                  <button disabled={memoryAction !== "idle"} onClick={() => setMemoryEditing(true)} type="button">
                    {memoryPayload.memory.userSummary ? "訂正する" : "追加する"}
                  </button>
                ) : null}
              </div>
              {memoryEditing ? (
                <div className="consult-memory-editor">
                  <label htmlFor="consult-memory-correction">元の記録と違うことや、AIに優先して覚えてほしいこと</label>
                  <textarea
                    id="consult-memory-correction"
                    maxLength={2000}
                    onChange={(event) => setMemoryDraft(event.target.value)}
                    placeholder="例：薬が変わったのは8月ではなく9月です。今は姉が通院に付き添っています。"
                    rows={4}
                    value={memoryDraft}
                  />
                  <p>{memoryDraft.length} / 2000</p>
                  <div>
                    <button disabled={memoryAction !== "idle"} onClick={saveMemoryCorrection} type="button">
                      {memoryAction === "saving" ? "保存しています…" : "補足・訂正を記憶する"}
                    </button>
                    <button
                      className="is-secondary"
                      disabled={memoryAction !== "idle"}
                      onClick={() => {
                        setMemoryDraft(memoryPayload.memory.userSummary);
                        setMemoryEditing(false);
                      }}
                      type="button"
                    >
                      変更せず閉じる
                    </button>
                  </div>
                </div>
              ) : (
                <p>{memoryPayload.memory.userSummary || "補足・訂正はまだありません。必要な時だけ追加できます。"}</p>
              )}
            </div>

            <div className="consult-memory-changes">
              <div className="consult-memory-section-head">
                <div>
                  <span>手帳に書いた事実から抽出</span>
                  <h3>重要な変化の履歴</h3>
                </div>
                <small>{memoryPayload.memory.importantChanges.length}件</small>
              </div>
              {memoryPayload.memory.importantChanges.length > 0 ? (
                <ul>
                  {memoryPayload.memory.importantChanges.map((change) => (
                    <li className={change.excluded ? "is-excluded" : ""} key={change.id}>
                      <div className="consult-memory-change-meta">
                        <time dateTime={change.date}>{change.date ? formatMemoryDate(change.date) : "日付なし"}</time>
                        <span>{change.source}</span>
                        <span>{change.excluded ? "記憶から除外中" : change.status}</span>
                      </div>
                      <strong>{change.title}</strong>
                      {change.detail ? <p>{change.detail}</p> : null}
                      {change.eventId && memoryPayload.canEditSharedMemory ? (
                        <button
                          disabled={memoryAction !== "idle"}
                          onClick={() => toggleMemorySource(change.eventId as string, change.excluded)}
                          type="button"
                        >
                          {change.excluded ? "この記録を記憶に戻す" : "この記録をAIの記憶から外す"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="consult-memory-empty">変化の記録が増えると、日付順にここへ表示されます。</p>
              )}
              {memoryPayload.memory.excludedEventIds.filter((eventId) => (
                !memoryPayload.memory.importantChanges.some((change) => change.eventId === eventId)
              )).map((eventId, index) => (
                <div className="consult-memory-excluded" key={eventId}>
                  <div>
                    <strong>記憶から外している記録 {index + 1}</strong>
                    <span>元の手帳記録は削除されていません</span>
                  </div>
                  {memoryPayload.canEditSharedMemory ? (
                    <button disabled={memoryAction !== "idle"} onClick={() => toggleMemorySource(eventId, true)} type="button">
                      記憶に戻す
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <p className="consult-memory-updated">
              {memoryPayload.memory.updatedAt
                ? `記憶の最終更新：${formatMemoryDate(memoryPayload.memory.updatedAt, true)}`
                : "記憶は次の相談時にも更新されます。"}
            </p>
            {memoryMessage ? <p className="consult-memory-message" role="status">{memoryMessage}</p> : null}

            <details className="consult-memory-delete">
              <summary>記憶や相談履歴を管理・削除する</summary>
              <p>消したいものを選び、次の確認画面でもう一度「削除する」を押すまで削除されません。</p>
              <div className="consult-memory-delete-actions">
                {memoryPayload.canManageSharedMemory ? (
                  <button disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent("memory")} type="button">家族共有のAI記憶を削除</button>
                ) : null}
                <button disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent("history")} type="button">相談履歴を削除</button>
                {memoryPayload.canManageSharedMemory ? (
                  <button disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent("all")} type="button">家族共有の記憶と自分の相談履歴を削除</button>
                ) : null}
              </div>
              {!memoryPayload.canManageSharedMemory ? (
                <p>この人の家族全員で共有するAI記憶の削除は、家族ボードのオーナーまたは管理者が行います。ここでは自分の相談履歴だけ削除できます。</p>
              ) : null}
              {deleteIntent ? (
                <div className="consult-memory-delete-confirm" role="alert">
                  <strong>
                    {deleteIntent === "memory"
                      ? "この人の家族全員の専用AI記憶を削除しますか？"
                      : deleteIntent === "history"
                        ? "これまでのAI相談履歴を削除しますか？"
                        : "家族全員のAI記憶と、自分の相談履歴を両方削除しますか？"}
                  </strong>
                  <p>{deleteIntent !== "history"
                    ? "この人の手帳を共有する家族全員の専用AIから、長期要約・重要な変化・家族の補足が消えます。元の手帳記録そのものは削除されません。削除後は、これから新しく追加する記録だけを覚えます。"
                    : "相談履歴だけを削除します。元の手帳記録と専用AIの長期記憶は残ります。"}</p>
                  <div>
                    <button disabled={memoryAction !== "idle"} onClick={confirmMemoryDelete} type="button">
                      {memoryAction === "deleting" ? "削除しています…" : "削除する"}
                    </button>
                    <button className="is-secondary" disabled={memoryAction !== "idle"} onClick={() => setDeleteIntent(null)} type="button">やめる</button>
                  </div>
                </div>
              ) : null}
            </details>
          </section>
        ) : null}

        <div className="consult-storage-note" role="note">
          <strong>{memoryMode === "checking"
            ? "相談履歴の保存方法を確認しています。"
            : durableMemoryEnabled
              ? "AI相談の質問と回答は、相談履歴へ自動保存されます。"
              : "専用AIの長期記憶を準備してください。"}</strong>
          <p>{memoryMode === "checking"
            ? "確認が終わるまで、そのままお待ちください。"
            : durableMemoryEnabled
              ? "次の相談でも会話の経過を踏まえます。日付別の手帳には自動追加しません。手帳にも残したい回答だけ「この回答を手帳に残す」を押してください。"
              : "長期記憶が確認できるまで、相談内容はAIへ送りません。"}</p>
        </div>

        {durableMemoryEnabled && openedFromRecord && turns.length === 0 ? (
          <div className="consult-ready-card" role="status">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <div>
              <span>記録から相談</span>
              <strong>質問文は入っています。そのまま送れます。</strong>
              <p>保存した記録とプロフィールも一緒に読みます。</p>
            </div>
          </div>
        ) : null}

        {durableMemoryEnabled && turns.length === 0 ? (
          <div className="consult-chat-intro">
            <h2>聞きたいことを1つ書いてください</h2>
            <p>
              {consultAccess?.plan === "plus"
                ? "一度答えた後も、この画面で会話の続きを聞けます。"
                : "無料では1日1回答まで使えます。毎日0時に、また1回相談できます。"}
            </p>
            <p className="consult-suggestion-guide">下の質問例を押すと、入力欄の末尾に追加されます。いま入っている文章は消えません。</p>
            <div className="consult-suggestions">
              {suggestedQuestions.map((item) => (
                <button
                  aria-label={`${item}を相談内容に追加`}
                  key={item}
                  onClick={() => addSuggestedQuestion(item)}
                  type="button"
                >
                  <span aria-hidden="true">＋</span>{item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.length > 0 ? (
          <div className="consult-thread" aria-live="polite">
            {durableMemoryEnabled ? (
              <div className="consult-history-head">
                <div>
                  <span>自動保存された相談履歴</span>
                  <strong>保存済み相談 {memoryPayload?.historyTotal ?? turns.length}件</strong>
                </div>
                <small>あなた自身の全履歴の概要と、今回に関連する過去相談を次の相談でも使います</small>
              </div>
            ) : null}
            {durableMemoryEnabled && memoryPayload?.historyHasMore ? (
              <button
                className="consult-history-more"
                disabled={historyLoading}
                onClick={loadOlderConsultHistory}
                type="button"
              >
                {historyLoading ? "前の相談を読み込んでいます…" : `さらに前の相談を表示（現在${turns.length}件）`}
              </button>
            ) : null}
            {turns.map((turn) => (
              <article className="consult-turn" id={`consult-turn-${turn.id}`} key={turn.id}>
                <div className="consult-message consult-message-user">
                  <span>あなた{turn.createdAt ? `・${formatMemoryDate(turn.createdAt, true)}` : ""}</span>
                  <div className="consult-bubble"><p>{turn.question}</p></div>
                </div>
                <div className="consult-message consult-message-assistant">
                  <div className="consult-assistant-head">
                    <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                    <strong>AI相談</strong>
                  </div>
                  <div className="consult-answer-block">
                    <h3>いまの状況</h3>
                    <p>{turn.answer.situation}</p>
                  </div>

                  {turn.answer.nextChecks.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>次に確認するとよいこと</h3>
                      <ol className="consult-checks">
                        {turn.answer.nextChecks.map((check, index) => (
                          <li key={`${check.title}-${index}`}>
                            <strong>{check.title}</strong>
                            <small>{check.why}</small>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {turn.answer.askQuestions.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>窓口で聞くこと</h3>
                      <ul className="consult-list">
                        {turn.answer.askQuestions.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {turn.answer.providerCategories.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>相談先の候補</h3>
                      <div className="consult-chips">
                        {turn.answer.providerCategories.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
                      </div>
                    </div>
                  ) : null}

                  {turn.answer.watchOuts.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>気をつけること</h3>
                      <ul className="consult-list">
                        {turn.answer.watchOuts.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {turn.answer.recordSuggestion ? (
                    <div className="consult-answer-block">
                      <h3>次に手帳へ残すこと</h3>
                      <p>{turn.answer.recordSuggestion}</p>
                    </div>
                  ) : null}

                  <div className="consult-save">
                    <button
                      disabled={turn.saved || turn.saveSyncPhase === "saving"}
                      onClick={() => saveToNotebook(turn)}
                      type="button"
                    >
                      {turn.saveSyncPhase === "saving" ? "手帳に残しています…" : turn.saved ? "AI相談メモとして保存済み" : "この回答を手帳に残す"}
                    </button>
                    {turn.saved ? (
                      <p role="status">
                        手帳の「過去の手帳」に「AI相談メモ」として保存しました。
                        {turn.saveSyncMessage ? <span>{turn.saveSyncMessage}</span> : null}
                        <Link href="/home#diary-history">手帳で見る</Link>
                      </p>
                    ) : null}
                  </div>
                  {turn.disclaimer ? <p className="consult-disclaimer">{turn.disclaimer}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {phase === "loading" ? (
          <div className="consult-message consult-message-assistant consult-message-loading" role="status">
            <div className="consult-assistant-head">
              <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
              <strong>AI相談</strong>
            </div>
            <p>{durableMemoryEnabled
              ? "この人の長期記憶、関連する過去記録、あなた自身のこれまでの相談を読んでいます。30秒ほどかかることがあります。"
              : "手帳とこの画面の会話を読んでいます。30秒ほどかかることがあります。"}</p>
          </div>
        ) : null}

        <div className="consult-composer">
          <h2>{durableMemoryEnabled
            ? turns.length > 0 ? "続けて聞きたいことを書いてください" : "相談内容を書く"
            : "専用AIの準備をしてください"}</h2>
          {!durableMemoryEnabled ? (
            <div className="consult-memory-required">
              <strong>{memoryMode === "checking" ? "長期記憶を確認しています" : "その場限りの相談は送信しません"}</strong>
              <p>{memoryMode === "checking"
                ? "この人の記録と、あなた自身の相談履歴を安全に読み込んでいます。そのままお待ちください。"
                : "この人の記録を継続して覚えるため、先にクラウド保存とメール確認が必要です。"}</p>
              {memoryMode === "temporary" ? <Link href="/home#cloud-backup">長期記憶を準備する</Link> : null}
            </div>
          ) : needsPlus ? (
            <div className="consult-followup-gate">
              <strong>今日の無料AI相談は利用済みです。</strong>
              <p>明日0時からまた1回使えます。Family Plusなら、今日のうちも会話を続けられます。</p>
              <Link className="consult-submit consult-submit-link" href="/plans#plus">
                Plusでこの相談を続ける
              </Link>
            </div>
          ) : (
            <>
              <p className="consult-edit-note" id="consult-edit-note">
                {openedFromRecord
                  ? "記録から相談文を用意しました。内容は自由に修正・削除して構いません。"
                  : "文章は自由に修正できます。短い言葉でも大丈夫です。"}
              </p>
              <textarea
                aria-describedby="consult-edit-note"
                maxLength={CONSULT_MAX_QUESTION_LENGTH}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={turns.length > 0
                  ? "例: さっき教えてもらった中で、まず病院には何と聞けばいいですか。"
                  : "例: 退院の話が出ています。何から確認すればいいですか。"}
                rows={4}
                ref={questionRef}
                value={question}
              />
              <p className="consult-count">{question.length} / {CONSULT_MAX_QUESTION_LENGTH}</p>
              {!consent ? (
                <label className="consult-consent">
                  <input checked={consent} disabled={consentSaving} onChange={(event) => void toggleConsent(event.target.checked)} type="checkbox" />
                  <span>手帳の内容をAI相談に送ることに同意します。</span>
                </label>
              ) : null}
              <button className="consult-submit" disabled={submitDisabled} onClick={submit} type="button">
                {consultButtonLabel}
              </button>
            </>
          )}
          {durableMemoryEnabled && !hasSubstance ? (
            <p className="consult-hint">
              先に手帳へ記録を1件書くか、プロフィールを2つ以上埋めてください。
              <Link href="/home#today-diary">今日の記録を書く</Link>
            </p>
          ) : null}
          {durableMemoryEnabled && !consent && !needsPlus ? <p className="consult-hint">同意すると相談ボタンを押せます。</p> : null}
          {phase === "error" ? <p className="consult-error" role="status">{errorMessage}</p> : null}
        </div>
      </section>

      <details className="consult-disclosure">
        <summary>AIに送る情報を確認する</summary>
        <div className="consult-disclosure-body">
          <p>
            長期記憶は対象者ごとに家族共有で保存し、相談履歴は相談した利用者本人だけが見られる形で保存します。相談のたびに、質問に必要な要約・関連記録・あなた自身の過去相談だけを外部の生成AI（Anthropic Claude）へ送ります。送った内容は学習には使われません。
          </p>
          <p><strong>氏名は自由記述から確実に自動判定できません。氏名・住所・病名など、本人を特定できる情報は相談文や手帳記録に入力しないでください。</strong></p>
          <div className="consult-disclosure-grid">
            <div>
              <strong>送るもの</strong>
              <ul>{CONSULT_SENT_FIELDS.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="is-withheld">
              <strong>送らないもの</strong>
              <ul>{CONSULT_WITHHELD_FIELDS.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          {consent ? (
            <div className="consult-consent-withdraw-wrap">
              <p>同意を取り消すと、新しい相談をAIへ送れなくなります。保存済みの手帳・長期記憶・相談履歴は消えません。</p>
              <button className="consult-consent-withdraw" disabled={consentSaving} onClick={() => void toggleConsent(false)} type="button">
                AIへの送信同意を取り消す
              </button>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
