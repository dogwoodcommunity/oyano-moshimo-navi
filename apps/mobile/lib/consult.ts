import {
  CONSULT_MEMORY_CONSENT_VERSION,
  normalizeConsultAnswer,
  type ConsultAnswer,
  type ConsultRequest
} from "@oyano/shared";
import { getSupabase } from "./supabase";

export type ConsultOutcome =
  | { ok: true; answer: ConsultAnswer; disclaimer: string }
  | { ok: false; code?: string; message: string };

export type ConsultAccess = {
  signedIn: boolean;
  plan: "free" | "plus";
  dailyFreeAvailable: boolean;
  dailyFreeUsedAt: string | null;
  canConsult: boolean;
};

export type MobileConsultMemory = {
  personId: string;
  memory: {
    longTermSummary: string;
    userSummary: string;
    importantChanges: Array<{
      sourceEventId: string;
      date?: string;
      mood: "changed" | "urgent";
      summary: string;
    }>;
    excludedEventIds: string[];
    recordCount: number;
    firstRecordDate: string | null;
    lastRecordDate: string | null;
    memoryVersion: number;
  };
  history: Array<{
    id: string;
    question: string;
    answer: ConsultAnswer;
    savedToNotebookAt: string | null;
    createdAt: string | null;
  }>;
  excludedSources: Array<{
    sourceEventId: string;
    date?: string;
    mood?: "stable" | "changed" | "urgent";
    body: string;
  }>;
  historyTotal: number;
  historyHasMore: boolean;
  canEditSharedMemory: boolean;
  canManageSharedMemory: boolean;
};

export type MobileConsultMemoryResult =
  | { ok: true; data: MobileConsultMemory }
  | { ok: false; code?: string; message: string };

export type MobileConsultConsentStatus = {
  active: boolean;
  revision: number;
  canManageSharedMemory: boolean;
};

export type MobileConsultConsentResult =
  | { ok: true; data: MobileConsultConsentStatus }
  | { ok: false; code?: string; message: string };

export type MobileConsultDeleteResult =
  | { ok: true; data: MobileConsultMemory | null }
  | { ok: false; code?: string; message: string };

function consultBaseUrl() {
  return process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "") ?? "";
}

function memoryFailureMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : fallback;
}

function memoryFailureCode(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const code = (value as { error?: unknown }).error;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

export async function readConsultConsent(personId: string): Promise<MobileConsultConsentResult> {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl || !personId) return { ok: false, message: "相談の接続先が設定されていません。" };
  try {
    const headers = await buildConsultHeaders();
    const response = await fetch(
      `${baseUrl}/api/consult/memory/consent?personId=${encodeURIComponent(personId)}`,
      { headers }
    );
    const data = await response.json().catch(() => null) as {
      consent?: { active?: boolean; revision?: number };
      canManageSharedMemory?: boolean;
      error?: string;
      message?: string;
    } | null;
    if (!response.ok) {
      return {
        ok: false,
        code: memoryFailureCode(data),
        message: memoryFailureMessage(data, "長期記憶の同意状態を確認できませんでした。")
      };
    }
    return {
      ok: true,
      data: {
        active: Boolean(data?.consent?.active),
        revision: typeof data?.consent?.revision === "number" ? Math.max(0, Math.floor(data.consent.revision)) : 0,
        canManageSharedMemory: Boolean(data?.canManageSharedMemory)
      }
    };
  } catch {
    return { ok: false, message: "通信できないため、長期記憶の同意状態を確認できませんでした。" };
  }
}

export async function writeConsultConsent(
  personId: string,
  value: boolean,
  revision: number
): Promise<MobileConsultConsentResult> {
  const baseUrl = consultBaseUrl();
  if (!baseUrl || !personId) return { ok: false, message: "相談の接続先が設定されていません。" };
  try {
    const headers = await buildConsultHeaders();
    const response = await fetch(`${baseUrl}/api/consult/memory/consent`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        personId,
        action: value ? "accept" : "revoke",
        version: CONSULT_MEMORY_CONSENT_VERSION,
        acceptedVia: "mobile",
        revision
      })
    });
    const data = await response.json().catch(() => null) as {
      consent?: { active?: boolean; revision?: number };
      canManageSharedMemory?: boolean;
    } | null;
    if (!response.ok) {
      return {
        ok: false,
        code: memoryFailureCode(data),
        message: memoryFailureMessage(data, "同意状態を保存できませんでした。")
      };
    }
    return {
      ok: true,
      data: {
        active: Boolean(data?.consent?.active),
        revision: typeof data?.consent?.revision === "number" ? Math.max(0, Math.floor(data.consent.revision)) : 0,
        canManageSharedMemory: Boolean(data?.canManageSharedMemory)
      }
    };
  } catch {
    return { ok: false, message: "通信できないため、同意状態を保存できませんでした。" };
  }
}

export async function fetchConsultMemory(personId: string, historyOffset = 0): Promise<MobileConsultMemoryResult> {
  const baseUrl = consultBaseUrl();
  if (!baseUrl) return { ok: false, message: "相談の接続先が設定されていません。" };
  try {
    const headers = await buildConsultHeaders();
    headers["X-Oyano-Memory-Consent-Version"] = CONSULT_MEMORY_CONSENT_VERSION;
    const response = await fetch(
      `${baseUrl}/api/consult/memory?personId=${encodeURIComponent(personId)}&historyOffset=${Math.max(0, historyOffset)}`,
      { headers }
    );
    const raw = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !raw || typeof raw.memory !== "object" || !Array.isArray(raw.history)) {
      return { ok: false, message: memoryFailureMessage(raw, "専用AIの記憶を読み込めませんでした。") };
    }
    const memory = raw.memory as MobileConsultMemory["memory"];
    const history = raw.history.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const answer = normalizeConsultAnswer(row.answer);
      if (!answer || typeof row.id !== "string" || typeof row.question !== "string") return [];
      return [{
        id: row.id,
        question: row.question,
        answer,
        savedToNotebookAt: typeof row.savedToNotebookAt === "string" ? row.savedToNotebookAt : null,
        createdAt: typeof row.createdAt === "string" ? row.createdAt : null
      }];
    });
    const excludedSources = Array.isArray(raw.excludedSources)
      ? raw.excludedSources.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const row = item as Record<string, unknown>;
          if (typeof row.sourceEventId !== "string" || typeof row.body !== "string") return [];
          const mood: "stable" | "changed" | "urgent" | undefined = row.mood === "stable"
            || row.mood === "changed"
            || row.mood === "urgent"
              ? row.mood
              : undefined;
          return [{
            sourceEventId: row.sourceEventId,
            date: typeof row.date === "string" ? row.date : undefined,
            mood,
            body: row.body
          }];
        })
      : [];
    return {
      ok: true,
      data: {
        personId: typeof raw.personId === "string" ? raw.personId : personId,
        memory,
        history,
        excludedSources,
        historyTotal: typeof raw.historyTotal === "number" ? raw.historyTotal : history.length,
        historyHasMore: Boolean(raw.historyHasMore),
        canEditSharedMemory: Boolean(raw.canEditSharedMemory),
        canManageSharedMemory: Boolean(raw.canManageSharedMemory)
      }
    };
  } catch {
    return { ok: false, message: "通信できないため、専用AIの記憶を読み込めませんでした。" };
  }
}

export async function patchConsultMemory(
  personId: string,
  memoryVersion: number,
  change: { userSummary?: string; excludeEventId?: string; includeEventId?: string }
): Promise<MobileConsultMemoryResult> {
  const baseUrl = consultBaseUrl();
  if (!baseUrl) return { ok: false, message: "相談の接続先が設定されていません。" };
  try {
    const headers = await buildConsultHeaders();
    headers["X-Oyano-Memory-Consent-Version"] = CONSULT_MEMORY_CONSENT_VERSION;
    const response = await fetch(`${baseUrl}/api/consult/memory`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ personId, memoryVersion, ...change })
    });
    if (!response.ok) {
      const raw = await response.json().catch(() => null);
      return {
        ok: false,
        code: memoryFailureCode(raw),
        message: memoryFailureMessage(raw, "専用AIの記憶を更新できませんでした。")
      };
    }
    return fetchConsultMemory(personId);
  } catch {
    return { ok: false, message: "通信できないため、専用AIの記憶を更新できませんでした。" };
  }
}

export async function deleteConsultMemory(
  personId: string,
  scope: "memory" | "history" | "all"
): Promise<MobileConsultDeleteResult> {
  const baseUrl = consultBaseUrl();
  if (!baseUrl) return { ok: false, message: "相談の接続先が設定されていません。" };
  try {
    const headers = await buildConsultHeaders();
    const response = await fetch(
      `${baseUrl}/api/consult/memory?personId=${encodeURIComponent(personId)}&scope=${scope}`,
      { method: "DELETE", headers }
    );
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        code: memoryFailureCode(raw),
        message: memoryFailureMessage(raw, "専用AIの記憶を削除できませんでした。")
      };
    }
    // 同意が有効なら最新表示を返す。同意取消後はGETが拒否されても、削除自体は成功として扱う。
    const refreshed = await fetchConsultMemory(personId);
    return refreshed.ok ? refreshed : { ok: true, data: null };
  } catch {
    return { ok: false, message: "通信できないため、専用AIの記憶を削除できませんでした。" };
  }
}

/**
 * 相談はWeb側の /api/consult に集約している。
 * 送る内容の絞り込みと伏字処理をサーバー1か所で完結させるため、アプリからも同じ入口を使う。
 */
export async function requestConsult(payload: ConsultRequest): Promise<ConsultOutcome> {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return { ok: false, message: "相談の接続先が設定されていません。" };
  }

  try {
    const headers = await buildConsultHeaders();
    const response = await fetch(`${baseUrl}/api/consult`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload.personId
        ? { ...payload, memoryConsentVersion: CONSULT_MEMORY_CONSENT_VERSION }
        : payload)
    });

    const data = await response.json().catch(() => null) as {
      answer?: unknown;
      disclaimer?: string;
      error?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        code: data?.error,
        message: data?.message ?? "相談を整理できませんでした。時間をおいてお試しください。"
      };
    }

    const answer = normalizeConsultAnswer(data?.answer);
    if (!answer) {
      return { ok: false, message: "うまく整理できませんでした。相談内容を少し変えてお試しください。" };
    }

    return { ok: true, answer, disclaimer: data?.disclaimer ?? "" };
  } catch {
    return { ok: false, message: "通信できませんでした。電波のよい場所でお試しください。" };
  }
}

export async function fetchConsultAccess(): Promise<ConsultAccess> {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return signedOutAccess();

  try {
    const headers = await buildConsultHeaders();
    const response = await fetch(`${baseUrl}/api/consult`, { headers });
    const data = await response.json().catch(() => null) as (Partial<ConsultAccess> & {
      trialAvailable?: boolean;
      trialUsedAt?: string | null;
    }) | null;
    if (!response.ok || !data?.signedIn) return signedOutAccess();

    return {
      signedIn: true,
      plan: data.plan === "plus" ? "plus" : "free",
      dailyFreeAvailable: Boolean(data.dailyFreeAvailable ?? data.trialAvailable),
      dailyFreeUsedAt: typeof data.dailyFreeUsedAt === "string"
        ? data.dailyFreeUsedAt
        : typeof data.trialUsedAt === "string" ? data.trialUsedAt : null,
      canConsult: Boolean(data.canConsult)
    };
  } catch {
    return signedOutAccess();
  }
}

async function buildConsultHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const supabase = getSupabase();
  if (!supabase) return headers;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function signedOutAccess(): ConsultAccess {
  return {
    signedIn: false,
    plan: "free",
    dailyFreeAvailable: false,
    dailyFreeUsedAt: null,
    canConsult: false
  };
}
