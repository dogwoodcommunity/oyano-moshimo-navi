import { Platform } from "react-native";
import { getSupabase } from "./supabase";

export type PushRegistrationResult = {
  token: string | null;
  saved: boolean;
  reason?: "permission_denied" | "token_failed" | "login_required" | "save_failed";
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

export async function registerPushToken(): Promise<PushRegistrationResult> {
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

  const { accessToken, client, userId } = await getAccessToken();
  if (!client || !userId || !accessToken) {
    return { token: expoPushToken, saved: false, reason: "login_required" };
  }

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

      if (response.ok) return { token: expoPushToken, saved: true };
    } catch {
      // Fall back to direct Supabase upsert for local development.
    }
  }

  const { error } = await client.from("push_tokens").upsert({
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      device_name: Platform.OS,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,expo_push_token" });

  if (error) return { token: expoPushToken, saved: false, reason: "save_failed" };
  return { token: expoPushToken, saved: true };
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
