import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeConsultAnswer, type ConsultAnswer, type ConsultRequest } from "@oyano/shared";

const CONSENT_KEY = "oyano_consult_consent_v01";

export type ConsultOutcome =
  | { ok: true; answer: ConsultAnswer; disclaimer: string }
  | { ok: false; message: string };

export async function readConsultConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function writeConsultConsent(value: boolean): Promise<void> {
  try {
    if (value) {
      await AsyncStorage.setItem(CONSENT_KEY, "1");
    } else {
      await AsyncStorage.removeItem(CONSENT_KEY);
    }
  } catch {
    // 保存できなくても、その場の操作は続けられる。
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
    const response = await fetch(`${baseUrl}/api/consult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null) as {
      answer?: unknown;
      disclaimer?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      return { ok: false, message: data?.message ?? "相談を整理できませんでした。時間をおいてお試しください。" };
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
