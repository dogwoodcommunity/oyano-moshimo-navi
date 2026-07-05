import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSupabase } from "./supabase";

export async function registerPushToken(userId: string) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const token = await Notifications.getExpoPushTokenAsync();
  const expoPushToken = token.data;

  const client = getSupabase();
  if (client) {
    await client.from("push_tokens").upsert({
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      device_name: Platform.OS,
      is_active: true
    });
  }

  return expoPushToken;
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
