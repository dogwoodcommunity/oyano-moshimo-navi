import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cronAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

type ScheduledNotificationRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  notification_type: string;
  scheduled_for: string;
  task_title?: string | null;
  assigned_member_id?: string | null;
  push_sent_at?: string | null;
  email_sent_at?: string | null;
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

type ProfileRow = {
  id: string;
  email: string | null;
};

type NotificationPreferenceRow = {
  user_id: string;
  reminders_enabled: boolean | null;
  daily_digest_enabled: boolean | null;
};

type DeliveryStateRow = {
  id: string;
  push_sent_at: string | null;
  email_sent_at: string | null;
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

type PushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, unknown>;
};

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
  if (row.task_title) return row.task_title;
  const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
  return task?.title ?? "確認が必要なタスク";
}

function assignedMemberId(row: ScheduledNotificationRow) {
  if (row.assigned_member_id) return row.assigned_member_id;
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

  return `・${taskTitle(row)}（担当: ${assigneeLabel(row, members)}）`;
}

function buildDigestBody(rows: ScheduledNotificationRow[], members: Map<string, string>) {
  const sortedRows = [...rows].sort((a, b) => Number(isMonthlyCheckin(a)) - Number(isMonthlyCheckin(b)));
  const lines = sortedRows.slice(0, 2).map((row) => digestLine(row, members));
  const rest = rows.length - lines.length;
  return rest > 0 ? `${lines.join("\n")}\nほか${rest}件` : lines.join("\n");
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

function isValidEmail(value: string | null | undefined): value is string {
  if (!value || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function rowIsEnabled(
  row: ScheduledNotificationRow,
  preferences: Map<string, NotificationPreferenceRow>
) {
  const preference = preferences.get(row.user_id);
  if (isMonthlyCheckin(row)) return preference?.daily_digest_enabled ?? true;
  return preference?.reminders_enabled ?? true;
}

function emailText(body: string, homeUrl: string) {
  return [
    body,
    "",
    "手帳を開く",
    homeUrl,
    "",
    "このメールは、期限リマインドまたは月1回の確認が有効な方へお送りしています。",
    "通知はアプリの「通知設定」から変更できます。"
  ].join("\n");
}

function emailBatchIdempotencyKey(groups: DigestGroup[]) {
  const notificationIds = groups
    .flatMap((group) => group.rows.map((row) => row.id))
    .sort()
    .join(":");
  const digest = createHash("sha256").update(notificationIds).digest("hex");
  return `scheduled-notifications/${digest}`;
}

export async function GET(request: Request) {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ sent: 0, skipped: true, reason: "Supabase is not configured" });
  }

  const { error: monthlyError } = await supabase.rpc("ensure_monthly_checkin_notifications");
  if (monthlyError) {
    return NextResponse.json({ error: monthlyError.message }, { status: 500 });
  }

  const { error: resetError } = await supabase.rpc("reset_stale_sending_notifications");
  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 });
  }

  const { data: schedules, error } = await supabase.rpc("claim_due_scheduled_notifications", {
    p_limit: 100
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const claimedRows = (schedules ?? []) as ScheduledNotificationRow[];
  if (claimedRows.length === 0) {
    return NextResponse.json({ sent: 0, pushSent: 0, emailSent: 0 });
  }

  const claimedIds = claimedRows.map((row) => row.id);
  const userIds = [...new Set(claimedRows.map((row) => row.user_id))];
  const [tokenResult, profileResult, preferenceResult, deliveryStateResult] = await Promise.all([
    supabase
      .from("push_tokens")
      .select("user_id, expo_push_token")
      .in("user_id", userIds)
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds),
    supabase
      .from("notification_preferences")
      .select("user_id, reminders_enabled, daily_digest_enabled")
      .in("user_id", userIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("scheduled_notifications")
      .select("id, push_sent_at, email_sent_at")
      .in("id", claimedIds)
  ]);

  if (tokenResult.error || profileResult.error || preferenceResult.error) {
    await supabase
      .from("scheduled_notifications")
      .update({ status: "scheduled", claimed_at: null })
      .in("id", claimedIds)
      .eq("status", "sending");

    return NextResponse.json({
      error: tokenResult.error?.message ?? profileResult.error?.message ?? preferenceResult.error?.message
    }, { status: 500 });
  }

  // Deploying the Web code before the additive SQL migration must not stop push delivery.
  // Until the columns exist, email stays off and this route behaves like the legacy push-only worker.
  const deliveryTrackingAvailable = !deliveryStateResult.error;
  const deliveryStateMap = new Map<string, DeliveryStateRow>();
  for (const state of (deliveryStateResult.data ?? []) as DeliveryStateRow[]) {
    deliveryStateMap.set(state.id, state);
  }

  const rows = claimedRows.map((row) => ({
    ...row,
    push_sent_at: deliveryStateMap.get(row.id)?.push_sent_at ?? null,
    email_sent_at: deliveryStateMap.get(row.id)?.email_sent_at ?? null
  }));
  const tokenRows = (tokenResult.data ?? []) as PushTokenRow[];
  const profileRows = (profileResult.data ?? []) as ProfileRow[];
  const profileEmails = new Map(profileRows.map((profile) => [profile.id, profile.email]));
  const preferenceMap = new Map<string, NotificationPreferenceRow>();
  for (const preference of (preferenceResult.data ?? []) as NotificationPreferenceRow[]) {
    if (!preferenceMap.has(preference.user_id)) preferenceMap.set(preference.user_id, preference);
  }

  const enabledRows = rows.filter((row) => rowIsEnabled(row, preferenceMap));
  const usersWithPush = new Set(tokenRows.map((token) => token.user_id));
  const pushRows = enabledRows.filter((row) =>
    usersWithPush.has(row.user_id) && (!deliveryTrackingAvailable || !row.push_sent_at)
  );

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const notificationEmailFrom = process.env.NOTIFICATION_EMAIL_FROM?.trim();
  const notificationEmailReplyTo = process.env.NOTIFICATION_EMAIL_REPLY_TO?.trim();
  const emailConfigured = Boolean(resendApiKey && notificationEmailFrom);
  const emailRows = deliveryTrackingAvailable && emailConfigured
    ? enabledRows.filter((row) => isValidEmail(profileEmails.get(row.user_id)) && !row.email_sent_at)
    : [];

  const assignedMemberIds = [
    ...new Set(enabledRows.map(assignedMemberId).filter((id): id is string => Boolean(id)))
  ];
  const assigneeMap = new Map<string, string>();

  if (assignedMemberIds.length > 0) {
    const { data: members, error: memberError } = await supabase
      .from("family_members")
      .select("id, relationship, role")
      .in("id", assignedMemberIds);

    if (memberError) {
      await supabase
        .from("scheduled_notifications")
        .update({ status: "scheduled", claimed_at: null })
        .in("id", claimedIds)
        .eq("status", "sending");
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    for (const member of (members ?? []) as FamilyMemberRow[]) {
      assigneeMap.set(member.id, member.relationship || member.role);
    }
  }

  const failedIds = new Set<string>();
  const deliveryErrors: string[] = [];
  let pushSent = 0;
  let emailSent = 0;

  const pushDigests = buildDigestGroups(pushRows);
  const pushMessages: PushMessage[] = pushDigests.flatMap((digest) => {
    const title = digestTitle(digest.rows);
    const body = buildDigestBody(digest.rows, assigneeMap);
    const scheduledNotificationIds = digest.rows.map((row) => row.id);

    return tokenRows
      .filter((token) => token.user_id === digest.userId)
      .map((token) => ({
        to: token.expo_push_token,
        sound: "default" as const,
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

  if (pushMessages.length > 0) {
    try {
      const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(pushMessages)
      });

      const expoBodyText = await expoResponse.text();
      let expoBody: { data?: Array<{ status?: string; details?: { error?: string } }> } | null = null;
      try {
        expoBody = expoBodyText ? JSON.parse(expoBodyText) : null;
      } catch {
        expoBody = null;
      }

      if (!expoResponse.ok) {
        pushRows.forEach((row) => failedIds.add(row.id));
        deliveryErrors.push(`Expo push failed (${expoResponse.status})`);
      } else {
        pushSent = pushMessages.length;
        const inactiveTokens = (expoBody?.data ?? [])
          .map((ticket, index) => ({ ticket, token: pushMessages[index]?.to }))
          .filter(({ ticket, token }) => token && ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered")
          .map(({ token }) => token as string);

        if (inactiveTokens.length > 0) {
          await supabase
            .from("push_tokens")
            .update({ is_active: false })
            .in("expo_push_token", inactiveTokens);
        }

        if (deliveryTrackingAvailable) {
          const { error: pushStateError } = await supabase
            .from("scheduled_notifications")
            .update({ push_sent_at: new Date().toISOString() })
            .in("id", pushRows.map((row) => row.id));
          if (pushStateError) {
            pushRows.forEach((row) => failedIds.add(row.id));
            deliveryErrors.push("Push delivery state could not be saved");
          }
        }
      }
    } catch {
      pushRows.forEach((row) => failedIds.add(row.id));
      deliveryErrors.push("Expo push request failed");
    }
  }

  const emailDigests = buildDigestGroups(emailRows)
    .filter((digest) => isValidEmail(profileEmails.get(digest.userId)))
    .sort((a, b) => `${a.userId}:${a.localDate}`.localeCompare(`${b.userId}:${b.localDate}`));

  if (emailDigests.length > 0 && resendApiKey && notificationEmailFrom) {
    const homeBaseUrl = (process.env.NEXT_PUBLIC_WEB_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
    const homeUrl = `${homeBaseUrl}/home?source=email-notification`;
    const emailPayload = emailDigests.map((digest) => {
      const message = {
        from: notificationEmailFrom,
        to: [profileEmails.get(digest.userId) as string],
        subject: `【親のもしもナビ】${digestTitle(digest.rows)}`,
        text: emailText(buildDigestBody(digest.rows, assigneeMap), homeUrl)
      } as {
        from: string;
        to: string[];
        subject: string;
        text: string;
        reply_to?: string;
      };
      if (notificationEmailReplyTo) message.reply_to = notificationEmailReplyTo;
      return message;
    });

    try {
      const emailResponse = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": emailBatchIdempotencyKey(emailDigests)
        },
        body: JSON.stringify(emailPayload)
      });

      if (!emailResponse.ok) {
        emailRows.forEach((row) => failedIds.add(row.id));
        deliveryErrors.push(`Notification email failed (${emailResponse.status})`);
      } else {
        emailSent = emailDigests.length;
        const { error: emailStateError } = await supabase
          .from("scheduled_notifications")
          .update({ email_sent_at: new Date().toISOString() })
          .in("id", emailRows.map((row) => row.id));
        if (emailStateError) {
          emailRows.forEach((row) => failedIds.add(row.id));
          deliveryErrors.push("Email delivery state could not be saved");
        }
      }
    } catch {
      emailRows.forEach((row) => failedIds.add(row.id));
      deliveryErrors.push("Notification email request failed");
    }
  }

  const retryIds = [...failedIds];
  const completedIds = claimedIds.filter((id) => !failedIds.has(id));
  const completedAt = new Date().toISOString();

  if (completedIds.length > 0) {
    const { error: sentError } = await supabase
      .from("scheduled_notifications")
      .update({
        status: "sent",
        claimed_at: null,
        sent_at: completedAt
      })
      .in("id", completedIds)
      .eq("status", "sending");

    if (sentError) {
      return NextResponse.json({ error: sentError.message }, { status: 500 });
    }
  }

  if (retryIds.length > 0) {
    const { error: retryError } = await supabase
      .from("scheduled_notifications")
      .update({ status: "scheduled", claimed_at: null })
      .in("id", retryIds)
      .eq("status", "sending");

    if (retryError) {
      return NextResponse.json({ error: retryError.message }, { status: 500 });
    }
  }

  const responseBody = {
    sent: pushSent + emailSent,
    pushSent,
    emailSent,
    scheduledNotifications: rows.length,
    completedNotifications: completedIds.length,
    retryingNotifications: retryIds.length,
    suppressedByPreference: rows.length - enabledRows.length,
    emailConfigured,
    deliveryTrackingAvailable,
    emailSkippedReason: emailConfigured
      ? (deliveryTrackingAvailable ? null : "notification_email_delivery.sql is not applied")
      : "RESEND_API_KEY or NOTIFICATION_EMAIL_FROM is not configured",
    errors: deliveryErrors
  };

  return NextResponse.json(responseBody, { status: deliveryErrors.length > 0 ? 502 : 200 });
}
