import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FunnelEvent } from "@oyano/shared";

const ANON_KEY = "oyano_anon_id_v01";

async function anonId(): Promise<string | null> {
  try {
    const existing = await AsyncStorage.getItem(ANON_KEY);
    if (existing) return existing;

    const created = `anon_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(ANON_KEY, created);
    return created;
  } catch {
    return null;
  }
}

/** 計測は失敗しても何も起こさない。利用者の操作を止めないことを優先する。 */
export async function trackFunnel(event: FunnelEvent): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return;

  const id = await anonId();
  if (!id) return;

  try {
    await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: id, event, platform: "app" })
    });
  } catch {
    // 計測の失敗は無視する。
  }
}
