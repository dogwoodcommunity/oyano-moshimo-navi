import type { DiagnosisResult, ParentStatus } from "@oyano/shared";
import { trackFunnel } from "@/lib/funnel";
import { demoPerson, demoResult, demoTimeline } from "./demoData";
import { getSupabase } from "./supabase";
import { canCreateNotebook, NOTEBOOK_LIMIT_MESSAGE, statusLabel } from "@oyano/shared";

/**
 * 家族の誰かが記録を足す・状態を更新したとき、離れた家族へ「変化があった」ことを届ける。
 * 書き込みが成功した後に呼ぶ。通知が失敗しても記録自体は残るので、黙って続ける。
 * 記録のタイトルや中身は送らない。ロック画面に「危篤」等が出る事故を防ぐため、
 * 通知は「誰が・何をしたか」だけにする。
 */
async function notifyFamilyUpdate(personId: string, kind: "record" | "status") {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  const supabase = getSupabase();
  if (!baseUrl || !supabase) return;

  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch(`${baseUrl}/api/family/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ personId, kind })
    });
  } catch {
    // 通知の失敗は無視する。記録・更新はすでに成功している。
  }
}

export type MobilePersonProfile = {
  fullName?: string;
  displayName?: string;
  relationship?: string;
  birthDate?: string;
  careStatus?: string;
  keyContact?: string;
  hospitalOrFacility?: string;
  medicationNote?: string;
  documentLocationNote?: string;
  familyStructure?: string;
  firstSituation?: string;
  documentKnowledge?: string;
  updatedAt?: string;
};

export type MobilePerson = {
  id: string;
  displayName: string;
  relationship?: string;
  currentStatus: ParentStatus;
  profile?: MobilePersonProfile;
};

export type MobileTask = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done" | "skipped";
  dueDate?: string;
  priority: number;
  category?: string;
  assignedMemberId?: string | null;
  assigneeLabel?: string;
};

export type FamilyMember = {
  id: string;
  userId?: string;
  role: string;
  relationship?: string;
  displayName: string;
  isCurrentUser: boolean;
};

export type FamilyInviteResult = {
  source: "supabase" | "demo";
  token?: string;
  inviteUrl?: string;
  fallbackUrl?: string;
  limitReached?: boolean;
  error?: string;
};

export type AcceptFamilyInviteResult = {
  source: "supabase" | "demo";
  accepted: boolean;
  error?: string;
};

export type MobileDiaryMood = "stable" | "changed" | "urgent";

export type MobileTimelineAttachment = {
  name: string;
  type?: string;
  size?: number;
  storagePath?: string;
  uri?: string;
};

export type MobileTimelineEntry = {
  id: string;
  personId: string;
  eventType: string;
  date: string;
  title: string;
  body?: string;
  mood?: MobileDiaryMood;
  attachments: MobileTimelineAttachment[];
  createdAt?: string;
  /** 誰が書いたか。家族共有で「長女が記録」と出すために使う。 */
  createdBy?: string;
};

export type CreatePersonResult = {
  source: "supabase" | "demo";
  person?: MobilePerson;
  warning?: string;
  error?: string;
};

type InitialFamilyPersonRpcResult = {
  familyId?: string;
  personId?: string;
  tasksCreated?: number;
};

export type DashboardData = {
  person: MobilePerson;
  people: MobilePerson[];
  tasks: MobileTask[];
  registryItems: string[];
  firstSteps: string[];
  source: "supabase" | "demo" | "empty";
};

type PersonRow = {
  id: string;
  display_name: string;
  relationship_to_family: string | null;
  current_status: ParentStatus;
  profile?: unknown;
  profile_updated_at?: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: MobileTask["status"];
  due_date: string | null;
  priority: number | null;
  category: string | null;
  assigned_member_id: string | null;
};

type FamilyMemberRow = {
  id: string;
  user_id: string | null;
  role: string;
  relationship: string | null;
};

type PersonFamilyRow = {
  family_id: string | null;
};

type TimelineRow = {
  id: string;
  person_id: string;
  event_type: string;
  event_date: string | null;
  title: string;
  body: string | null;
  mood?: MobileDiaryMood | null;
  attachments?: unknown;
  created_at: string | null;
  created_by?: string | null;
};

const demoFamilyMembers: FamilyMember[] = [
  {
    id: "demo-member-self",
    userId: "demo-user-self",
    role: "owner",
    relationship: "長男",
    displayName: "長男",
    isCurrentUser: true
  },
  {
    id: "demo-member-sister",
    userId: "demo-user-sister",
    role: "member",
    relationship: "長女",
    displayName: "長女",
    isCurrentUser: false
  }
];

function demoTasksFromResult(result: DiagnosisResult): MobileTask[] {
  return result.tasks.map((task, index) => ({
    id: `demo-task-${index}`,
    title: task.title,
    description: task.description,
    status: index % 3 === 0 ? "todo" : index % 3 === 1 ? "doing" : "done",
    dueDate: task.dueDate,
    priority: task.priority,
    category: task.category,
    assignedMemberId: index === 0 ? null : index % 2 === 0 ? "demo-member-sister" : "demo-member-self",
    assigneeLabel: index === 0 ? undefined : index % 2 === 0 ? "長女" : "長男"
  }));
}

function isProfile(value: unknown): value is MobilePersonProfile {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeProfile(row: PersonRow): MobilePersonProfile {
  const rawProfile = isProfile(row.profile) ? row.profile : {};
  return {
    ...rawProfile,
    displayName: rawProfile.displayName ?? row.display_name,
    relationship: rawProfile.relationship ?? row.relationship_to_family ?? undefined,
    careStatus: rawProfile.careStatus ?? row.current_status,
    updatedAt: rawProfile.updatedAt ?? row.profile_updated_at ?? undefined
  };
}

function personFromRow(row: PersonRow): MobilePerson {
  const profile = normalizeProfile(row);
  return {
    id: row.id,
    displayName: profile.displayName || row.display_name,
    relationship: profile.relationship ?? row.relationship_to_family ?? undefined,
    currentStatus: row.current_status,
    profile
  };
}

function normalizeAttachments(value: unknown): MobileTimelineAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MobileTimelineAttachment =>
    Boolean(item && typeof item === "object" && "name" in item)
  );
}

function timelineFromRow(row: TimelineRow): MobileTimelineEntry {
  return {
    id: row.id,
    personId: row.person_id,
    eventType: row.event_type,
    date: row.event_date ?? "",
    title: row.title,
    body: row.body ?? undefined,
    mood: row.mood ?? undefined,
    attachments: normalizeAttachments(row.attachments),
    createdAt: row.created_at ?? undefined,
    createdBy: row.created_by ?? undefined
  };
}

function demoTimelineEntries(personId: string): MobileTimelineEntry[] {
  return demoTimeline.map((item) => ({
    id: item.id,
    personId,
    eventType: "diary",
    date: item.date,
    title: item.title,
    body: item.body,
    mood: "changed",
    attachments: [],
    createdAt: item.date
  }));
}

export function demoDashboardData(): DashboardData {
  return {
    person: demoPerson,
    people: [demoPerson],
    tasks: demoTasksFromResult(demoResult),
    registryItems: demoResult.registryItems,
    firstSteps: demoResult.firstSteps,
    source: "demo"
  };
}

export function emptyDashboardData(): DashboardData {
  return {
    person: {
      id: "",
      displayName: "未登録",
      currentStatus: "preparing"
    },
    people: [],
    tasks: [],
    registryItems: [],
    firstSteps: [],
    source: "empty"
  };
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = getSupabase();
  if (!supabase) return demoDashboardData();

  const { data: peopleWithProfile, error: peopleError } = await supabase
    .from("people")
    .select("id, display_name, relationship_to_family, current_status, profile, profile_updated_at")
    .order("created_at", { ascending: true });
  let people = peopleWithProfile as PersonRow[] | null;

  if (peopleError) {
    const fallback = await supabase
      .from("people")
      .select("id, display_name, relationship_to_family, current_status")
      .order("created_at", { ascending: true });
    people = fallback.data as PersonRow[] | null;
  }

  const personRow = (people?.[0] ?? null) as PersonRow | null;
  if (!personRow) return emptyDashboardData();

  const tasks = await fetchTasks(personRow.id);
  const personList = ((people ?? []) as PersonRow[]).map(personFromRow);

  return {
    person: personFromRow(personRow),
    people: personList,
    tasks,
    registryItems: demoResult.registryItems,
    firstSteps: tasks.slice(0, 3).map((task) => task.title),
    source: "supabase"
  };
}

export async function fetchPerson(personId: string): Promise<MobilePerson> {
  const supabase = getSupabase();
  if (!supabase) return demoPerson;

  const { data, error } = await supabase
    .from("people")
    .select("id, display_name, relationship_to_family, current_status, profile, profile_updated_at")
    .eq("id", personId)
    .single();
  let personData = data as PersonRow | null;

  if (error) {
    const fallback = await supabase
      .from("people")
      .select("id, display_name, relationship_to_family, current_status")
      .eq("id", personId)
      .single();
    personData = fallback.data as PersonRow | null;
  }

  const row = personData;
  if (!row) return demoPerson;

  return personFromRow(row);
}

export async function fetchTasks(personId: string): Promise<MobileTask[]> {
  const supabase = getSupabase();
  if (!supabase) return demoTasksFromResult(demoResult);

  const members = await fetchFamilyMembers(personId);
  const memberLabels = new Map(members.map((member) => [member.id, member.displayName]));

  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, status, due_date, priority, category, assigned_member_id")
    .eq("person_id", personId)
    .order("due_date", { ascending: true });

  const rows = (data ?? []) as TaskRow[];
  if (rows.length === 0) return [];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    dueDate: row.due_date ?? undefined,
    priority: row.priority ?? 3,
    category: row.category ?? undefined,
    assignedMemberId: row.assigned_member_id,
    assigneeLabel: row.assigned_member_id ? memberLabels.get(row.assigned_member_id) : undefined
  }));
}

export async function fetchFamilyMembers(personId: string): Promise<FamilyMember[]> {
  const supabase = getSupabase();
  if (!supabase) return demoFamilyMembers;

  const familyId = await fetchFamilyId(personId);
  if (!familyId) return demoFamilyMembers;

  const { data: userResult } = await supabase.auth.getUser();
  const currentUserId = userResult.user?.id;

  const { data } = await supabase
    .from("family_members")
    .select("id, user_id, role, relationship")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as FamilyMemberRow[];
  if (rows.length === 0) return demoFamilyMembers;

  return rows.map((row) => {
    const displayName = row.relationship || (row.role === "owner" ? "家族代表" : row.role);
    return {
      id: row.id,
      userId: row.user_id ?? undefined,
      role: row.role,
      relationship: row.relationship ?? undefined,
      displayName,
      isCurrentUser: Boolean(currentUserId && row.user_id === currentUserId)
    };
  });
}

async function fetchFamilyId(personId: string) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: person } = await supabase
    .from("people")
    .select("family_id")
    .eq("id", personId)
    .single();

  return (person as PersonFamilyRow | null)?.family_id ?? null;
}

export async function createPersonForFamily({
  anchorPersonId,
  currentStatus,
  displayName,
  relationship
}: {
  anchorPersonId: string;
  currentStatus: ParentStatus;
  displayName: string;
  relationship?: string;
}): Promise<CreatePersonResult> {
  const normalizedName = displayName.trim();
  if (!normalizedName) return { source: "demo", error: "呼び名を入力してください。" };

  const supabase = getSupabase();
  if (!supabase) {
    return {
      source: "demo",
      person: {
        id: `demo-person-${Date.now()}`,
        displayName: normalizedName,
        relationship: relationship?.trim() || undefined,
        currentStatus
      }
    };
  }

  const familyId = await fetchFamilyId(anchorPersonId);
  if (!familyId) return { source: "supabase", error: "家族ボードが見つかりませんでした。" };

  // 無料で作れる手帳の数を、Webと同じ基準で止める。
  // Webでは断られてアプリでは通る、という食い違いを作らない。
  const [{ data: familyRow }, { data: existingPeople }] = await Promise.all([
    supabase.from("families").select("plan").eq("id", familyId).single(),
    supabase.from("people").select("id").eq("family_id", familyId)
  ]);
  const plan = (familyRow as { plan?: string } | null)?.plan === "plus" ? "plus" : "free";
  if (!canCreateNotebook(plan, Array.isArray(existingPeople) ? existingPeople.length : 0)) {
    return { source: "supabase", error: NOTEBOOK_LIMIT_MESSAGE };
  }

  const profile: MobilePersonProfile = {
    displayName: normalizedName,
    relationship: relationship?.trim() || undefined,
    careStatus: currentStatus,
    updatedAt: new Date().toISOString()
  };

  const primaryInsert = await supabase
    .from("people")
    .insert({
      family_id: familyId,
      display_name: normalizedName,
      relationship_to_family: relationship?.trim() || null,
      current_status: currentStatus,
      profile,
      profile_updated_at: new Date().toISOString()
    })
    .select("id, display_name, relationship_to_family, current_status, profile, profile_updated_at")
    .single();
  let insertedPerson = primaryInsert.data as PersonRow | null;
  let insertError = primaryInsert.error;

  if (insertError) {
    const fallback = await supabase
      .from("people")
      .insert({
        family_id: familyId,
        display_name: normalizedName,
        relationship_to_family: relationship?.trim() || null,
        current_status: currentStatus
      })
      .select("id, display_name, relationship_to_family, current_status")
      .single();
    insertedPerson = fallback.data as PersonRow | null;
    insertError = fallback.error;
  }

  if (insertError) return { source: "supabase", error: insertError.message };

  const row = insertedPerson as PersonRow | null;
  if (!row) return { source: "supabase", error: "対象者を作成できませんでした。" };

  const { data: userResult } = await supabase.auth.getUser();
  const { error: eventError } = await supabase.from("person_status_events").insert({
    person_id: row.id,
    previous_status: null,
    new_status: currentStatus,
    note: "mobile person created",
    created_by: userResult.user?.id ?? null
  });

  void trackFunnel("person_created");
  return {
    source: "supabase",
    person: personFromRow(row),
    warning: eventError ? "対象者は追加できましたが、初期タスクの作成に失敗しました。ステータス変更画面でもう一度保存してください。" : undefined
  };
}

export async function createInitialFamilyPerson({
  currentStatus,
  displayName,
  relationship
}: {
  currentStatus: ParentStatus;
  displayName: string;
  relationship?: string;
}): Promise<CreatePersonResult> {
  const normalizedName = displayName.trim();
  if (!normalizedName) return { source: "demo", error: "呼び名を入力してください。" };

  const supabase = getSupabase();
  if (!supabase) {
    return {
      source: "demo",
      person: {
        id: `demo-person-${Date.now()}`,
        displayName: normalizedName,
        relationship: relationship?.trim() || undefined,
        currentStatus
      }
    };
  }

  const { data, error } = await supabase.rpc("create_initial_family_person", {
    p_display_name: normalizedName,
    p_relationship: relationship?.trim() || null,
    p_status: currentStatus
  });

  if (error) return { source: "supabase", error: error.message };

  const result = data as InitialFamilyPersonRpcResult | null;
  if (!result?.personId) return { source: "supabase", error: "家族ボードを作成できませんでした。" };

  const person = await fetchPerson(result.personId);
  void trackFunnel("person_created");
  return {
    source: "supabase",
    person,
    warning: result.tasksCreated === 0 ? "対象者は作成できましたが、初期タスクがありません。状態変更画面でもう一度保存してください。" : undefined
  };
}

export async function createFamilyInvite(
  personId: string,
  invitedEmail: string,
  relationship?: string
): Promise<FamilyInviteResult> {
  const normalizedEmail = invitedEmail.trim().toLowerCase();
  if (!normalizedEmail) return { source: "demo", error: "メールアドレスを入力してください。" };

  const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? "oyanomoshimo";
  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  const supabase = getSupabase();

  if (!supabase) {
    const token = "demo-invite-token";
    return {
      source: "demo",
      token,
      inviteUrl: `${appScheme}://invite?token=${token}`,
      fallbackUrl: webBaseUrl ? `${webBaseUrl}/invite/${token}` : undefined
    };
  }

  const familyId = await fetchFamilyId(personId);
  if (!familyId) return { source: "supabase", error: "家族情報が見つかりませんでした。" };

  const { data, error } = await supabase.rpc("create_family_invite", {
    p_family_id: familyId,
    p_invited_email: normalizedEmail,
    p_role: "member",
    p_relationship: relationship?.trim() || null
  });

  if (error) {
    const message = error.message ?? "";
    return {
      source: "supabase",
      limitReached: message.includes("free_plan_limit_reached"),
      error: message
    };
  }

  const token = (data as { token?: string } | null)?.token;
  if (!token) return { source: "supabase", error: "招待リンクを作成できませんでした。" };

  return {
    source: "supabase",
    token,
    inviteUrl: `${appScheme}://invite?token=${token}`,
    fallbackUrl: webBaseUrl ? `${webBaseUrl}/invite/${token}` : undefined
  };
}

export async function promoteFamilyMemberToOwner(
  memberId: string
): Promise<{ source: "supabase" | "demo"; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { source: "demo" };

  const { error } = await supabase.rpc("promote_family_member_to_owner", {
    p_family_member_id: memberId
  });

  if (error) {
    const message = error.message ?? "";
    const friendlyMessage = message.includes("not_family_admin")
      ? "共同管理者にできるのは家族代表または管理者だけです。"
      : message.includes("member_not_found")
        ? "メンバーが見つかりませんでした。"
        : "共同管理者に変更できませんでした。時間をおいてもう一度お試しください。";
    return { source: "supabase", error: friendlyMessage };
  }

  return { source: "supabase" };
}

export async function acceptFamilyInvite(token: string): Promise<AcceptFamilyInviteResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return { source: "demo", accepted: false, error: "招待リンクが正しくありません。" };

  const supabase = getSupabase();
  if (!supabase) return { source: "demo", accepted: true };

  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) {
    return { source: "supabase", accepted: false, error: "ログインが必要です。" };
  }

  const { error } = await supabase.rpc("accept_family_invite", {
    p_token: normalizedToken
  });

  if (error) {
    const message = error.message ?? "";
    const friendlyMessage = message.includes("invite_invalid_or_expired")
      ? "招待リンクの期限が切れているか、すでに使われています。"
      : message.includes("family_limit_reached")
        ? "無料枠の上限に達しているため参加できません。"
        : "招待を受け取れませんでした。時間をおいてもう一度お試しください。";
    return { source: "supabase", accepted: false, error: friendlyMessage };
  }

  return { source: "supabase", accepted: true };
}

export async function updatePersonStatus(
  personId: string,
  previousStatus: ParentStatus,
  nextStatus: ParentStatus
): Promise<{ source: "supabase" | "demo"; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { source: "demo" };

  const { error } = await supabase.from("person_status_events").insert({
    person_id: personId,
    previous_status: previousStatus,
    new_status: nextStatus,
    note: "mobile status update"
  });

  if (error) return { source: "demo", error: error.message };
  void notifyFamilyUpdate(personId, "status");
  return { source: "supabase" };
}

export async function updatePersonProfile(
  personId: string,
  profile: MobilePersonProfile
): Promise<{ source: "supabase" | "demo"; person?: MobilePerson; error?: string }> {
  const supabase = getSupabase();
  const nextProfile: MobilePersonProfile = {
    ...profile,
    updatedAt: new Date().toISOString()
  };

  if (!supabase) {
    return {
      source: "demo",
      person: {
        ...demoPerson,
        displayName: nextProfile.displayName || demoPerson.displayName,
        relationship: nextProfile.relationship || demoPerson.relationship,
        profile: nextProfile
      }
    };
  }

  const primaryUpdate = await supabase
    .from("people")
    .update({
      display_name: nextProfile.displayName || nextProfile.fullName || undefined,
      relationship_to_family: nextProfile.relationship || null,
      profile: nextProfile,
      profile_updated_at: nextProfile.updatedAt,
      updated_at: nextProfile.updatedAt
    })
    .eq("id", personId)
    .select("id, display_name, relationship_to_family, current_status, profile, profile_updated_at")
    .single();
  let updatedPerson = primaryUpdate.data as PersonRow | null;
  let updateError = primaryUpdate.error;

  if (updateError) {
    const fallback = await supabase
      .from("people")
      .update({
        display_name: nextProfile.displayName || nextProfile.fullName || undefined,
        relationship_to_family: nextProfile.relationship || null,
        updated_at: nextProfile.updatedAt
      })
      .eq("id", personId)
      .select("id, display_name, relationship_to_family, current_status")
      .single();
    updatedPerson = fallback.data as PersonRow | null;
    updateError = fallback.error;
  }

  if (updateError) return { source: "supabase", error: updateError.message };
  const row = updatedPerson;
  return { source: "supabase", person: row ? personFromRow(row) : undefined };
}

export async function fetchTimelineEntries(personId: string): Promise<MobileTimelineEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return demoTimelineEntries(personId);

  const timelineResult = await supabase
    .from("timeline_events")
    .select("id, person_id, event_type, event_date, title, body, mood, attachments, created_at, created_by")
    .eq("person_id", personId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  let timelineData = timelineResult.data as TimelineRow[] | null;

  if (timelineResult.error) {
    const fallback = await supabase
      .from("timeline_events")
      .select("id, person_id, event_type, event_date, title, body, created_at")
      .eq("person_id", personId)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    timelineData = fallback.data as TimelineRow[] | null;
  }

  const rows = timelineData ?? [];
  if (rows.length === 0) return [];
  return rows.map(timelineFromRow);
}

export async function addTimelineEntry({
  attachments = [],
  body,
  date,
  mood,
  notifyFamily = true,
  personId,
  title
}: {
  attachments?: MobileTimelineAttachment[];
  body: string;
  date?: string;
  mood: MobileDiaryMood;
  /** 相談メモのように、家族へ知らせたくない保存では false にする。 */
  notifyFamily?: boolean;
  personId: string;
  title?: string;
}): Promise<{ source: "supabase" | "demo"; entry?: MobileTimelineEntry; error?: string }> {
  const normalizedBody = body.trim();
  if (!normalizedBody && attachments.length === 0) {
    return { source: "demo", error: "記録する内容を入力してください。" };
  }

  const entryTitle = title?.trim() || (
    mood === "urgent" ? "急ぎで確認したいこと" : mood === "changed" ? "変化があった記録" : "今日の記録"
  );
  const entryDate = date || new Date().toISOString().slice(0, 10);
  const supabase = getSupabase();

  if (!supabase) {
    return {
      source: "demo",
      entry: {
        id: `demo-timeline-${Date.now()}`,
        personId,
        eventType: "diary",
        date: entryDate,
        title: entryTitle,
        body: normalizedBody || "写真・資料を追加しました。",
        mood,
        attachments
      }
    };
  }

  const { data: userResult } = await supabase.auth.getUser();
  const primaryEntryInsert = await supabase
    .from("timeline_events")
    .insert({
      person_id: personId,
      event_type: "diary",
      event_date: entryDate,
      title: entryTitle,
      body: normalizedBody || "写真・資料を追加しました。",
      mood,
      attachments,
      metadata: { source: "mobile_notebook" },
      created_by: userResult.user?.id ?? null
    })
    .select("id, person_id, event_type, event_date, title, body, mood, attachments, created_at")
    .single();
  let insertedEntry = primaryEntryInsert.data as TimelineRow | null;
  let entryError = primaryEntryInsert.error;

  if (entryError) {
    const fallback = await supabase
      .from("timeline_events")
      .insert({
        person_id: personId,
        event_type: "diary",
        event_date: entryDate,
        title: entryTitle,
        body: normalizedBody || "写真・資料を追加しました。",
        created_by: userResult.user?.id ?? null
      })
      .select("id, person_id, event_type, event_date, title, body, created_at")
      .single();
    insertedEntry = fallback.data as TimelineRow | null;
    entryError = fallback.error;
  }

  if (entryError) return { source: "supabase", error: entryError.message };
  const row = insertedEntry;
  void trackFunnel("record_written");
  if (notifyFamily) void notifyFamilyUpdate(personId, "record");
  return { source: "supabase", entry: row ? timelineFromRow(row) : undefined };
}

export async function updateTaskStatus(
  taskId: string,
  status: MobileTask["status"]
): Promise<{ source: "supabase" | "demo"; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { source: "demo" };

  const { error } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", taskId);

  if (error) return { source: "demo", error: error.message };
  return { source: "supabase" };
}

export async function updateTaskAssignee(
  taskId: string,
  memberId: string | null
): Promise<{ source: "supabase" | "demo"; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { source: "demo" };

  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_member_id: memberId,
      updated_at: new Date().toISOString()
    })
    .eq("id", taskId);

  if (error) return { source: "demo", error: error.message };
  return { source: "supabase" };
}
