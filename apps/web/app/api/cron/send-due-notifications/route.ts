import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";

type ScheduledNotificationRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  scheduled_for: string;
  tasks?: {
    title: string;
    due_date: string | null;
  } | Array<{
    title: string;
    due_date: string | null;
  }> | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

function verifyCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return null;

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const urlToken = new URL(request.url).searchParams.get("cronToken");

  if (token !== expected && urlToken !== expected) {
    return NextResponse.json({ error: "Invalid cron token" }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request) {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ sent: 0, skipped: true, reason: "Supabase is not configured" });
  }

  const now = new Date().toISOString();
  const { data: schedules, error } = await supabase
    .from("scheduled_notifications")
    .select("id, user_id, task_id, scheduled_for, tasks(title, due_date)")
    .lte("scheduled_for", now)
    .eq("status", "scheduled")
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (schedules ?? []) as ScheduledNotificationRow[];
  if (rows.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: tokens, error: tokenError } = await supabase
    .from("push_tokens")
    .select("user_id, expo_push_token")
    .in("user_id", userIds)
    .eq("is_active", true);

  if (tokenError) {
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }

  const tokenRows = (tokens ?? []) as PushTokenRow[];
  const messages = rows.flatMap((row) => {
    const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
    return tokenRows
      .filter((token) => token.user_id === row.user_id)
      .map((token) => ({
        to: token.expo_push_token,
        sound: "default",
        title: "親のもしもナビ",
        body: task?.title ? `期限が近いタスク: ${task.title}` : "確認が必要なタスクがあります",
        data: {
          taskId: row.task_id,
          scheduledNotificationId: row.id
        }
      }));
  });

  if (messages.length > 0) {
    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(messages)
    });

    if (!expoResponse.ok) {
      return NextResponse.json({ error: await expoResponse.text() }, { status: 502 });
    }
  }

  await supabase
    .from("scheduled_notifications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString()
    })
    .in("id", rows.map((row) => row.id));

  return NextResponse.json({ sent: messages.length, scheduledNotifications: rows.length });
}
