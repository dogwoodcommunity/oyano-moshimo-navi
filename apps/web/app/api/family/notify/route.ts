import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";

export const dynamic = "force-dynamic";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** 記録のたびに鳴らすと通知疲れで切られる。見守りが死ぬので、送る回数自体を抑える。 */
const NOTIFY_LIMIT_PER_HOUR = 12;
const ONE_HOUR_SECONDS = 3600;
/** 存在しないpersonIdと、権限のないpersonIdの区別をつけさせないための共通の返事。 */
const SILENT_OK = { ok: true, sent: 0 };

/**
 * 家族の誰かが記録を足す・状態を更新したとき、離れた家族へ「変化があった」ことを届ける。
 * 記録の中身そのものは送らず、「誰が・何をしたか」だけを通知する。
 * 呼び出し側（アプリ）は書き込みが成功した後にこれを叩く。通知が失敗しても記録は残る。
 */
export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { personId?: string; kind?: string };
  try {
    body = (await request.json()) as { personId?: string; kind?: string };
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const personId = typeof body.personId === "string" ? body.personId : "";
  const kind = body.kind === "status" ? "status" : "record";
  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "family-notify",
    limit: NOTIFY_LIMIT_PER_HOUR,
    windowSeconds: ONE_HOUR_SECONDS
  });
  if (limited) return limited;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(bearer);
  if (userError || !userResult.user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const actorId = userResult.user.id;

  const { data: person } = await supabase
    .from("people")
    .select("family_id, display_name")
    .eq("id", personId)
    .single();
  const familyId = (person as { family_id?: string } | null)?.family_id;
  if (!familyId) {
    return NextResponse.json(SILENT_OK);
  }

  const { data: members } = await supabase
    .from("family_members")
    .select("user_id, relationship, role")
    .eq("family_id", familyId);
  const rows = (members ?? []) as Array<{ user_id: string | null; relationship: string | null; role: string }>;

  // 送信元が本当にその家族のメンバーか確認する。無関係な人が通知を撒けないようにする。
  // 権限が無い場合も「存在しない場合」と同じ返事にして、IDの当てずっぽうで
  // 手帳の有無を探れないようにする。
  const actorMember = rows.find((member) => member.user_id === actorId);
  if (!actorMember) {
    return NextResponse.json(SILENT_OK);
  }
  if (!["owner", "admin", "member"].includes(actorMember.role)) {
    return NextResponse.json(
      { error: "viewer_cannot_notify", message: "閲覧のみの家族は、更新通知を送れません。" },
      { status: 403 }
    );
  }

  const recipientIds = rows
    .map((member) => member.user_id)
    .filter((id): id is string => Boolean(id) && id !== actorId);
  if (recipientIds.length === 0) {
    return NextResponse.json(SILENT_OK);
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .in("user_id", recipientIds)
    .eq("is_active", true);
  const pushTokens = ((tokens ?? []) as Array<{ expo_push_token: string }>)
    .map((row) => row.expo_push_token)
    .filter((token): token is string => Boolean(token));
  if (pushTokens.length === 0) {
    return NextResponse.json(SILENT_OK);
  }

  // ロック画面のプレビューに出るため、本文には記録の中身やタイトルを一切含めない。
  // 「危篤」「亡くなった直後」のような言葉が通知で露出すると取り返しがつかない。
  const actorLabel = actorMember.relationship || "家族";
  const personName = (person as { display_name?: string } | null)?.display_name || "対象者";
  const verb = kind === "status" ? "状態を更新" : "記録を追加";
  const message = `${actorLabel}が${verb}しました。アプリで確認できます。`;

  const messages = pushTokens.map((to) => ({
    to,
    title: `${personName}さんの家族ボード`,
    body: message,
    sound: "default" as const,
    data: { personId, kind }
  }));

  let expoBody: { data?: Array<{ status?: string; details?: { error?: string } }> } | null = null;
  try {
    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(messages)
    });

    const expoBodyText = await expoResponse.text();
    try {
      expoBody = expoBodyText ? JSON.parse(expoBodyText) : null;
    } catch {
      expoBody = null;
    }

    if (!expoResponse.ok) {
      return NextResponse.json({ ok: false, error: "push_failed" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "push_failed" }, { status: 502 });
  }

  // 端末を替えた・アプリを消した家族の宛先は死んだままになる。
  // 送るたびに掃除して、無効な宛先へ送り続けないようにする。
  const inactiveTokens = (expoBody?.data ?? [])
    .map((ticket, index) => ({ ticket, token: messages[index]?.to }))
    .filter(({ ticket, token }) => token && ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered")
    .map(({ token }) => token as string);

  if (inactiveTokens.length > 0) {
    await supabase.from("push_tokens").update({ is_active: false }).in("expo_push_token", inactiveTokens);
  }

  return NextResponse.json({ ok: true, sent: pushTokens.length - inactiveTokens.length });
}
