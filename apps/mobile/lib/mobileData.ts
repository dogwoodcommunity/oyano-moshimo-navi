import type { DiagnosisResult, ParentStatus } from "@oyano/shared";
import { demoPerson, demoResult } from "./demoData";
import { getSupabase } from "./supabase";

export type MobilePerson = {
  id: string;
  displayName: string;
  relationship?: string;
  currentStatus: ParentStatus;
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

  const { data: people } = await supabase
    .from("people")
    .select("id, display_name, relationship_to_family, current_status")
    .order("created_at", { ascending: true });

  const personRow = (people?.[0] ?? null) as PersonRow | null;
  if (!personRow) return emptyDashboardData();

  const tasks = await fetchTasks(personRow.id);
  const personList = ((people ?? []) as PersonRow[]).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    relationship: row.relationship_to_family ?? undefined,
    currentStatus: row.current_status
  }));

  return {
    person: {
      id: personRow.id,
      displayName: personRow.display_name,
      relationship: personRow.relationship_to_family ?? undefined,
      currentStatus: personRow.current_status
    },
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

  const { data } = await supabase
    .from("people")
    .select("id, display_name, relationship_to_family, current_status")
    .eq("id", personId)
    .single();

  const row = data as PersonRow | null;
  if (!row) return demoPerson;

  return {
    id: row.id,
    displayName: row.display_name,
    relationship: row.relationship_to_family ?? undefined,
    currentStatus: row.current_status
  };
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
  if (rows.length === 0) return demoTasksFromResult(demoResult);

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
  return { source: "supabase" };
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
