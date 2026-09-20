import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getSupabase } from "./supabase";

export type PushRegistrationResult = {
  token: string | null;
  saved: boolean;
  reason?: "permission_denied" | "token_failed" | "login_required" | "save_failed" | "legacy_registration_unknown" | "registration_unverified";
};

export type NotificationPreferences = {
  remindersEnabled: boolean;
  dailyDigestEnabled: boolean;
  urgentEnabled: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  remindersEnabled: true,
  dailyDigestEnabled: true,
  urgentEnabled: true
};

async function loadNotifications() {
  return import("expo-notifications");
}

async function getAccessToken() {
  const client = getSupabase();
  const { data: sessionResult } = client ? await client.auth.getSession() : { data: { session: null } };
  return {
    accessToken: sessionResult.session?.access_token,
    client,
    userId: sessionResult.session?.user.id
  };
}

const PUSH_DEVICE_KEY = "oyano.push-device.v1";
type DeviceRegistration = { version: 1; userId: string; tokens: string[]; unsettledTokens: string[] };
const legacyMessage = "以前の通知登録をこの端末のものと確認できないため、ログアウトを中止しました。端末の設定でこのアプリの通知をオフにし、サポートへお問い合わせください。";
const revokeMessage = "この端末の通知解除を確認できないため、ログアウトを中止しました。通信を確認してもう一度お試しください。";
const unsettledMessage = "通知登録の通信結果が未確認のため、ログアウトを中止しました。端末の設定でこのアプリの通知をオフにし、サポートへお問い合わせください。";
let pushQueue: Promise<unknown> = Promise.resolve();

// Keep the lock through sign-out, so a pending permission/token request cannot
// register an old user's token after the logout cleanup has completed.
function serializePush<T>(operation: () => Promise<T>): Promise<T> {
  const next = pushQueue.then(operation, operation);
  pushQueue = next.catch(() => undefined);
  return next;
}

async function readDeviceRegistration(): Promise<DeviceRegistration | null> {
  const raw = await SecureStore.getItemAsync(PUSH_DEVICE_KEY);
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as DeviceRegistration;
  if (parsed.version !== 1 || typeof parsed.userId !== "string" || !Array.isArray(parsed.tokens)
    || !Array.isArray(parsed.unsettledTokens)
    || parsed.unsettledTokens.some((token) => !parsed.tokens.includes(token))
    || parsed.tokens.some((token) => typeof token !== "string" || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,256}\]$/.test(token))) {
    throw new Error("Invalid device registration");
  }
  return parsed;
}

async function storeDeviceRegistration(record: DeviceRegistration) {
  await SecureStore.setItemAsync(PUSH_DEVICE_KEY, JSON.stringify(record));
}

async function currentPermittedPushToken() {
  const Notifications = await loadNotifications();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return undefined;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
}

async function revokeRequest(accessToken: string, token?: string): Promise<"ok" | "legacy" | "failed"> {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return "failed";
  try {
    const response = await fetch(`${baseUrl}/api/push-tokens/unregister`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(token ? { mode: "revoke", expoPushToken: token } : { mode: "check" })
    });
    const body = await response.json() as { ok?: boolean; error?: string };
    if (response.ok && body.ok === true) return "ok";
    return response.status === 409 && body.error === "legacy_registration_unknown" ? "legacy" : "failed";
  } catch { return "failed"; }
}

async function establishDeviceRegistration(userId: string, accessToken: string, currentToken?: string) {
  const record = await readDeviceRegistration();
  if (record?.userId === userId) return { record };
  // A previous owner's unresolved registration must not be adopted or removed.
  if (record?.tokens.length) return { reason: "legacy" as const };
  let result = await revokeRequest(accessToken);
  if (result === "legacy") {
    if (currentToken) {
      const removed = await revokeRequest(accessToken, currentToken);
      if (removed !== "ok") return { reason: removed };
      result = await revokeRequest(accessToken);
    }
  }
  if (result !== "ok") return { reason: result };
  // No current OS token + no local history can only verify this owner's rows;
  // unknown older-owner installations require the separate migration gate.
  const initial: DeviceRegistration = { version: 1, userId, tokens: currentToken ? [currentToken] : [], unsettledTokens: [] };
  await storeDeviceRegistration(initial);
  return { record: initial };
}

/** Resolve only this installation's registrations before its session is revoked. */
export function withDevicePushRevoked<T>(signOut: () => Promise<T>): Promise<{ completed: true; result: T } | { completed: false; message: string }> {
  return serializePush(async () => {
    try {
      const { userId, accessToken } = await getAccessToken();
      if (!userId || !accessToken) return { completed: false, message: revokeMessage };
      const currentToken = await currentPermittedPushToken();
      const prepared = await establishDeviceRegistration(userId, accessToken, currentToken);
      if (!prepared.record) return { completed: false, message: prepared.reason === "legacy" ? legacyMessage : revokeMessage };
      const tokens = [...new Set([...prepared.record.tokens, ...(currentToken ? [currentToken] : [])])];
      // Retain an OS-recovered token too, including when an older owner's row
      // prevents verification. Never claim that token's delivery is stopped.
      await storeDeviceRegistration({ ...prepared.record, tokens });
      for (const token of tokens) {
        if (await revokeRequest(accessToken, token) !== "ok") return { completed: false, message: revokeMessage };
      }
      // A request interrupted before its registration reply might still commit
      // after this revocation. Without a server generation ledger, do not claim
      // a stopped registration or forget the pending token.
      if (prepared.record.unsettledTokens.length) return { completed: false, message: unsettledMessage };
      await storeDeviceRegistration({ ...prepared.record, tokens: [] });
      const latest = await getAccessToken();
      if (latest.userId !== userId) return { completed: false, message: revokeMessage };
      return { completed: true, result: await signOut() };
    } catch { return { completed: false, message: revokeMessage }; }
  });
}

export function registerPushToken(): Promise<PushRegistrationResult> {
  return serializePush(() => registerDevicePushToken().catch(() => ({ token: null, saved: false, reason: "save_failed" as const })));
}

async function registerDevicePushToken(): Promise<PushRegistrationResult> {
  const { accessToken, client, userId } = await getAccessToken();
  if (!client || !userId || !accessToken) return { token: null, saved: false, reason: "login_required" };
  const Notifications = await loadNotifications();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { token: null, saved: false, reason: "permission_denied" };

  let expoPushToken: string;
  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    expoPushToken = token.data;
  } catch {
    return { token: null, saved: false, reason: "token_failed" };
  }

  const prepared = await establishDeviceRegistration(userId, accessToken, expoPushToken);
  if (!prepared.record) return { token: null, saved: false, reason: prepared.reason === "legacy" ? "legacy_registration_unknown" : "save_failed" };
  if (prepared.record.unsettledTokens.length) return { token: null, saved: false, reason: "registration_unverified" };
  const latest = await getAccessToken();
  if (latest.userId !== userId) return { token: null, saved: false, reason: "login_required" };
  // Persist before the network write. Even a lost response remains revocable.
  const record = { ...prepared.record, tokens: [...new Set([...prepared.record.tokens, expoPushToken])] };
  await storeDeviceRegistration(record);
  for (const previous of record.tokens) {
    if (await revokeRequest(accessToken, previous) !== "ok") return { token: null, saved: false, reason: "save_failed" };
  }
  const pendingRecord = { ...record, tokens: [expoPushToken], unsettledTokens: [expoPushToken] };
  await storeDeviceRegistration(pendingRecord);

  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (webBaseUrl) {
    try {
      const response = await fetch(`${webBaseUrl}/api/push-tokens/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expoPushToken,
          platform: Platform.OS,
          deviceName: Platform.OS
        })
      });

      const data = await response.json() as { ok?: boolean; registrationState?: string };
      if (response.ok && data.ok === true) {
        await storeDeviceRegistration({ ...pendingRecord, unsettledTokens: [] });
        return { token: expoPushToken, saved: true };
      }
      // Only this explicit server receipt proves the push write never began.
      // A bare HTTP status, timeout or failed upsert remains uncertain.
      if (!response.ok && [400, 401, 409, 501, 503].includes(response.status)
        && data.registrationState === "not_written") {
        await storeDeviceRegistration({ ...pendingRecord, unsettledTokens: [] });
        return { token: null, saved: false, reason: response.status === 401 ? "login_required" : "save_failed" };
      }
    } catch {
      // Keep the pending token for a verified retry or logout.
    }
  }
  return { token: null, saved: false, reason: "registration_unverified" };
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences & { source: "supabase" | "web" | "default" }> {
  const { accessToken, client, userId } = await getAccessToken();
  if (!client || !userId || !accessToken) return { ...defaultNotificationPreferences, source: "default" };

  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (webBaseUrl) {
    try {
      const response = await fetch(`${webBaseUrl}/api/notification-preferences`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (response.ok) {
        const data = await response.json() as Partial<NotificationPreferences>;
        return {
          remindersEnabled: data.remindersEnabled ?? true,
          dailyDigestEnabled: data.dailyDigestEnabled ?? true,
          urgentEnabled: data.urgentEnabled ?? true,
          source: "web"
        };
      }
    } catch {
      // Fall back to direct Supabase read for local development.
    }
  }

  const { data } = await client
    .from("notification_preferences")
    .select("reminders_enabled, daily_digest_enabled, urgent_enabled")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    remindersEnabled: (data as { reminders_enabled?: boolean } | null)?.reminders_enabled ?? true,
    dailyDigestEnabled: (data as { daily_digest_enabled?: boolean } | null)?.daily_digest_enabled ?? true,
    urgentEnabled: (data as { urgent_enabled?: boolean } | null)?.urgent_enabled ?? true,
    source: "supabase"
  };
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences
): Promise<{ saved: boolean; reason?: "login_required" | "save_failed" }> {
  const { accessToken, client, userId } = await getAccessToken();
  if (!client || !userId || !accessToken) return { saved: false, reason: "login_required" };

  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (webBaseUrl) {
    try {
      const response = await fetch(`${webBaseUrl}/api/notification-preferences`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(preferences)
      });
      if (response.ok) return { saved: true };
    } catch {
      // Fall back to direct Supabase write for local development.
    }
  }

  const values = {
    reminders_enabled: preferences.remindersEnabled,
    daily_digest_enabled: preferences.dailyDigestEnabled,
    urgent_enabled: preferences.urgentEnabled,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: readError } = await client
    .from("notification_preferences")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) return { saved: false, reason: "save_failed" };

  const query = (existing as { id?: string } | null)?.id
    ? client.from("notification_preferences").update(values).eq("id", (existing as { id: string }).id)
    : client.from("notification_preferences").insert({ user_id: userId, ...values });

  const { error } = await query;
  if (error) return { saved: false, reason: "save_failed" };
  return { saved: true };
}

export async function saveTaskDueDates(userId: string, tasks: Array<{ id?: string; dueDate: string; title: string }>) {
  const client = getSupabase();
  if (!client) return;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  await Promise.all(tasks.map((task) => client.from("scheduled_notifications").insert({
    user_id: userId,
    task_id: task.id && uuidPattern.test(task.id) ? task.id : undefined,
    scheduled_for: `${task.dueDate}T09:00:00+09:00`,
    status: "scheduled"
  })));
}

function normalizeNotificationIds(data: Record<string, unknown>) {
  const ids = new Set<string>();
  const snakeIds = data.scheduled_notification_ids;
  const camelIds = data.scheduledNotificationIds;
  const snakeId = data.scheduled_notification_id;
  const camelId = data.scheduledNotificationId;

  if (Array.isArray(snakeIds)) {
    snakeIds.forEach((id) => typeof id === "string" && ids.add(id));
  }

  if (Array.isArray(camelIds)) {
    camelIds.forEach((id) => typeof id === "string" && ids.add(id));
  }

  if (typeof snakeId === "string") ids.add(snakeId);
  if (typeof camelId === "string") ids.add(camelId);

  return [...ids];
}

export async function markNotificationsOpened(data: Record<string, unknown>) {
  const ids = normalizeNotificationIds(data);
  if (ids.length === 0) return { updated: 0, source: "none" as const };

  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (webBaseUrl) {
    try {
      const session = await getSupabase()?.auth.getSession();
      const accessToken = session?.data.session?.access_token;
      if (!accessToken) throw new Error("Missing Supabase access token");

      await fetch(`${webBaseUrl}/api/notifications/opened`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ scheduled_notification_ids: ids })
      });
      return { updated: ids.length, source: "web" as const };
    } catch {
      // Fall back to Supabase below when local/dev Web is unavailable.
    }
  }

  const client = getSupabase();
  if (!client) return { updated: 0, source: "none" as const };

  await client
    .from("scheduled_notifications")
    .update({ opened_at: new Date().toISOString() })
    .in("id", ids)
    .is("opened_at", null);

  return { updated: ids.length, source: "supabase" as const };
}
