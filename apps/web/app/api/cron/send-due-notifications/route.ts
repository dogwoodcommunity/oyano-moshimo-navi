import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSupabase } from "@/lib/serverSupabase";

type ScheduledNotificationRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  notification_type: string;
  scheduled_for: string;
  tasks?: {
    title: string;
    due_date: string | null;
    assigned_member_id: string | null;
  } | Array<{
    title: string;
    due_date: string | null;
    assigned_member_id: string | null;
  }> | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type FamilyMemberRow = {
  id: string;
  relationship: string | null;
  role: string;
};

type DigestGroup = {
  userId: string;
  localDate: string;
  rows: ScheduledNotificationRow[];
};

function verifyCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return null;

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const actual = token ? Buffer.from(token) : null;
  const expectedBuffer = Buffer.from(expected);

  if (!actual || actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
    return NextResponse.json({ error: "Invalid cron token" }, { status: 401 });
  }

  return null;
}

function tokyoDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function taskTitle(row: ScheduledNotificationRow) {
  const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
  return task?.title ?? "確認が必要なタスク";
}

function assignedMemberId(row: ScheduledNotificationRow) {
  const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
  return task?.assigned_member_id ?? null;
}

function assigneeLabel(row: ScheduledNotificationRow, members: Map<string, string>) {
  const memberId = assignedMemberId(row);
  if (!memberId) return "未割当";
  return members.get(memberId) ?? "担当者";
}

function isMonthlyCheckin(row: ScheduledNotificationRow) {
  return row.notification_type === "monthly_checkin";
}

function digestTitle(rows: ScheduledNotificationRow[]) {
  const dueCount = rows.filter((row) => !isMonthlyCheckin(row)).length;
  const checkinCount = rows.length - dueCount;

  if (dueCount === 0 && checkinCount > 0) return "月1回の状況確認です";
  if (dueCount === 1 && checkinCount === 0) return "期限が近いタスクがあります";
  if (checkinCount > 0) return `今日の確認: ${rows.length}件`;
  return `今日の期限: ${rows.length}件`;
}

function digestLine(row: ScheduledNotificationRow, members: Map<string, string>) {
  if (isMonthlyCheckin(row)) {
    return "・親御さんの状況に変わりがないか確認しましょう";
  }

  return `・${taskTitle(row)}(担当: ${assigneeLabel(row, members)})`;
}

function buildDigestBody(rows: ScheduledNotificationRow[], members: Map<string, string>) {
  const sortedRows = [...rows].sort((a, b) => Number(isMonthlyCheckin(a)) - Number(isMonthlyCheckin(b)));
  const lines = sortedRows.slice(0, 2).map((row) => digestLine(row, members));
  const rest = rows.length - lines.length;
  return rest > 0 ? `${lines.join("\n")}\n他${rest}件` : lines.join("\n");
}

function buildDigestGroups(rows: ScheduledNotificationRow[]) {
  const map = new Map<string, DigestGroup>();

  for (const row of rows) {
    const localDate = tokyoDateKey(row.scheduled_for);
    const key = `${row.user_id}:${localDate}`;
    const current = map.get(key) ?? { userId: row.user_id, localDate, rows: [] };
    current.rows.push(row);
    map.set(key, current);
  }

  return [...map.values()];
}

export async function GET(request: Request) {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ sent: 0, skipped: true, reason: "Supabase is not configured" });
  }

  await supabase.rpc("ensure_monthly_checkin_notifications");

  const now = new Date().toISOString();
  const { data: schedules, error } = await supabase
    .from("scheduled_notifications")
    .select("id, user_id, task_id, notification_type, scheduled_for, tasks(title, due_date, assigned_member_id)")
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
  const assignedMemberIds = [
    ...new Set(rows.map(assignedMemberId).filter((id): id is string => Boolean(id)))
  ];
  const assigneeMap = new Map<string, string>();

  if (assignedMemberIds.length > 0) {
    const { data: members } = await supabase
      .from("family_members")
      .select("id, relationship, role")
      .in("id", assignedMemberIds);

    for (const member of (members ?? []) as FamilyMemberRow[]) {
      assigneeMap.set(member.id, member.relationship || member.role);
    }
  }

  const digests = buildDigestGroups(rows);
  const messages = digests.flatMap((digest) => {
    const title = digestTitle(digest.rows);
    const body = buildDigestBody(digest.rows, assigneeMap);
    const scheduledNotificationIds = digest.rows.map((row) => row.id);

    return tokenRows
      .filter((token) => token.user_id === digest.userId)
      .map((token) => ({
        to: token.expo_push_token,
        sound: "default",
        title,
        body,
        data: {
          localDate: digest.localDate,
          scheduled_notification_id: scheduledNotificationIds[0],
          scheduled_notification_ids: scheduledNotificationIds,
          scheduledNotificationId: scheduledNotificationIds[0],
          scheduledNotificationIds,
          taskIds: digest.rows.map((row) => row.task_id).filter(Boolean)
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
