import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSupabase } from "./supabase";

export type PushRegistrationResult = {
  token: string | null;
  saved: boolean;
  reason?: "permission_denied" | "token_failed" | "login_required" | "save_failed";
};

export async function registerPushToken(): Promise<PushRegistrationResult> {
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

  const client = getSupabase();
  const { data: sessionResult } = client ? await client.auth.getSession() : { data: { session: null } };
  const userId = sessionResult.session?.user.id;
  const accessToken = sessionResult.session?.access_token;
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
