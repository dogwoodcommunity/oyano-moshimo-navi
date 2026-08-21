import { NextResponse, type NextRequest } from "next/server";
import { buildDiagnosisResult, type DiagnosisAnswers, type ParentStatus } from "@oyano/shared";
import { getServerSupabase } from "@/lib/serverSupabase";

type AnyRecord = Record<string, any>;

type LocalTask = {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: number;
  category?: string;
  requiresProfessional?: boolean;
};

type LocalCase = {
  id?: string;
  selectedStatus?: string;
  answers?: AnyRecord;
  personProfile?: AnyRecord;
  status?: string;
  createdAt?: string;
  result?: {
    summary?: string;
    tasks?: LocalTask[];
    familyQuestions?: string[];
    registryItems?: string[];
    providerCategories?: string[];
    warnings?: string[];
  };
  supportPackStatus?: string;
};

type LocalDiaryEntry = {
  id?: string;
  caseId?: string;
  date?: string;
  mood?: "stable" | "changed" | "urgent";
  body?: string;
  attachments?: unknown[];
  createdAt?: string;
};

const parentStatuses = new Set<ParentStatus>([
  "hospitalized",
  "post_discharge_home",
  "facility",
  "cognitive_decline",
  "end_of_life",
  "after_death",
  "after_funeral",
  "inheritance",
  "home_clearance",
  "preparing",
  "completed"
]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeStatus(value: unknown): ParentStatus {
  if (value === "after_discharge_home") return "post_discharge_home";
  if (value === "care_starting") return "facility";
  return typeof value === "string" && parentStatuses.has(value as ParentStatus) ? value as ParentStatus : "preparing";
}

function safeDate(value: unknown, fallback = new Date().toISOString().slice(0, 10)) {
  return typeof value === "string" && value.length >= 8 ? value.slice(0, 10) : fallback;
}

function safeIso(value: unknown) {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function clampPriority(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 2;
  return Math.min(3, Math.max(1, Math.round(numeric)));
}

function displayNameForCase(localCase: LocalCase) {
  const profile = asRecord(localCase.personProfile);
  const answers = asRecord(localCase.answers);
  return String(
    profile.displayName ||
    profile.fullName ||
    answers.targetName ||
    answers.contactName ||
    "対象者"
  ).trim();
}

function relationshipForCase(localCase: LocalCase) {
  const profile = asRecord(localCase.personProfile);
  const answers = asRecord(localCase.answers);
  return String(profile.relationship || answers.targetRelationship || "家族");
}

function profilePayload(localCase: LocalCase, now: string) {
  return {
    localCaseId: localCase.id,
    localCreatedAt: localCase.createdAt,
    localAnswers: asRecord(localCase.answers),
    personProfile: asRecord(localCase.personProfile),
    localResultSummary: localCase.result?.summary ?? null,
    syncedAt: now,
    source: "pwa-notebook"
  };
}

async function authorize(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return { error: jsonError("Supabase is not configured.", 501) };

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: jsonError("ログイン確認が必要です。", 401) };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: jsonError("ログインが確認できませんでした。", 401) };

  return { supabase, user: data.user };
}

async function getOrCreateFamily(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, user: { id: string; email?: string | null }) {
  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1);

  if (membershipError) throw membershipError;
  if (memberships?.[0]?.family_id) return memberships[0].family_id as string;

  const familyName = user.email ? `${user.email.split("@")[0]}さんの家族` : "親のもしもナビの家族";
  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: familyName, owner_user_id: user.id, plan: "free" })
    .select("id")
    .single();

  if (familyError) throw familyError;

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: user.id, role: "owner", relationship: "本人" });

  if (memberError) throw memberError;
  return family.id as string;
}

export async function GET(request: NextRequest) {
  const authorized = await authorize(request);
  if ("error" in authorized) return authorized.error;

  const { supabase, user } = authorized;
  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id);

  if (membershipError) return jsonError(membershipError.message, 500);
  const familyIds = asArray<AnyRecord>(memberships).map((item) => item.family_id).filter(Boolean);
  if (familyIds.length === 0) return NextResponse.json({ cases: [], diaryEntries: [] });

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("*")
    .in("family_id", familyIds)
    .order("created_at", { ascending: false });

  if (peopleError) return jsonError(peopleError.message, 500);

  const personIds = asArray<AnyRecord>(people).map((person) => person.id).filter(Boolean);
  if (personIds.length === 0) return NextResponse.json({ cases: [], diaryEntries: [] });

  const [{ data: tasks, error: tasksError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("tasks").select("*").in("person_id", personIds).order("due_date", { ascending: true }),
    supabase.from("timeline_events").select("*").in("person_id", personIds).eq("event_type", "diary").order("event_date", { ascending: false })
  ]);

  if (tasksError) return jsonError(tasksError.message, 500);
  if (eventsError) return jsonError(eventsError.message, 500);

  const tasksByPerson = new Map<string, AnyRecord[]>();
  asArray<AnyRecord>(tasks).forEach((task) => {
    tasksByPerson.set(task.person_id, [...(tasksByPerson.get(task.person_id) ?? []), task]);
  });

  const personToLocalCaseId = new Map<string, string>();
  const cases = asArray<AnyRecord>(people).map((person) => {
    const profile = asRecord(person.profile);
    const localCaseId = String(profile.localCaseId || person.id);
    personToLocalCaseId.set(person.id, localCaseId);
    const personProfile = asRecord(profile.personProfile);
    const answers = asRecord(profile.localAnswers);
    const selectedStatus = normalizeStatus(person.current_status || answers.selectedStatus);
    const localTasks = (tasksByPerson.get(person.id) ?? []).map((task) => ({
      status: selectedStatus,
      title: task.title,
      description: task.description ?? "",
      defaultDueOffsetDays: 0,
      priority: clampPriority(task.priority),
      category: task.category ?? "notebook",
      requiresProfessional: Boolean(task.requires_professional),
      dueDate: safeDate(task.due_date)
    }));
    const fallbackResult = buildDiagnosisResult({
      selectedStatus,
      targetRelationship: answers.targetRelationship,
      targetName: answers.targetName || person.display_name,
      parentSituation: String(profile.localResultSummary || personProfile.careStatus || person.current_status || ""),
      familyStructure: String(personProfile.familyStructureNote || ""),
      hasHome: "unknown",
      knowsAssets: "unknown",
      concerns: [],
      homeClearance: "",
      consentToSensitiveInfo: true
    } as unknown as DiagnosisAnswers);

    return {
      id: localCaseId,
      selectedStatus,
      answers: { ...answers, selectedStatus },
      personProfile,
      status: "result_ready",
      createdAt: safeIso(profile.localCreatedAt || person.created_at),
      result: {
        ...fallbackResult,
        summary: String(profile.localResultSummary || fallbackResult.summary),
        tasks: localTasks.length > 0 ? localTasks : fallbackResult.tasks
      },
      supportPackStatus: "none"
    };
  });

  const diaryEntries = asArray<AnyRecord>(events).map((event) => {
    const metadata = asRecord(event.metadata);
    return {
      id: String(metadata.localDiaryId || event.id),
      caseId: String(metadata.localCaseId || personToLocalCaseId.get(event.person_id) || event.person_id),
      date: safeDate(event.event_date),
      mood: ["stable", "changed", "urgent"].includes(event.mood) ? event.mood : "stable",
      body: String(event.body || event.title || ""),
      attachments: asArray(event.attachments),
      createdAt: safeIso(event.created_at)
    };
  });

  return NextResponse.json({ cases, diaryEntries });
}

export async function POST(request: NextRequest) {
  const authorized = await authorize(request);
  if ("error" in authorized) return authorized.error;

  const { supabase, user } = authorized;
  const body = await request.json().catch(() => ({}));
  const localCases = asArray<LocalCase>(body.cases).filter((item) => item?.id);
  const diaryEntries = asArray<LocalDiaryEntry>(body.diaryEntries).filter((item) => item?.caseId);
  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email ?? null,
      display_name: user.email?.split("@")[0] ?? "利用者",
      updated_at: now
    });

  if (profileError) return jsonError(profileError.message, 500);

  let familyId: string;
  try {
    familyId = await getOrCreateFamily(supabase, user);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "家族データの準備に失敗しました。", 500);
  }

  let syncedPeople = 0;
  let syncedTasks = 0;
  let syncedEntries = 0;

  for (const localCase of localCases) {
    const localCaseId = String(localCase.id);
    const selectedStatus = normalizeStatus(localCase.selectedStatus || localCase.answers?.selectedStatus);
    const displayName = displayNameForCase(localCase);
    const relationship = relationshipForCase(localCase);
    const profile = profilePayload(localCase, now);

    const { data: existingPeople, error: existingPeopleError } = await supabase
      .from("people")
      .select("id")
      .eq("family_id", familyId)
      .eq("profile->>localCaseId", localCaseId)
      .limit(1);

    if (existingPeopleError) return jsonError(existingPeopleError.message, 500);

    const personRow = {
      family_id: familyId,
      display_name: displayName,
      relationship_to_family: relationship,
      current_status: selectedStatus,
      profile,
      profile_updated_at: now,
      updated_at: now
    };

    const personId = existingPeople?.[0]?.id
      ? await updatePerson(supabase, existingPeople[0].id, personRow)
      : await insertPerson(supabase, personRow);

    syncedPeople += 1;

    const { data: existingTasks, error: existingTasksError } = await supabase
      .from("tasks")
      .select("id,title,due_date")
      .eq("person_id", personId);

    if (existingTasksError) return jsonError(existingTasksError.message, 500);

    const existingTaskRows = asArray<AnyRecord>(existingTasks);
    for (const task of asArray<LocalTask>(localCase.result?.tasks).slice(0, 40)) {
      if (!task.title) continue;
      const dueDate = safeDate(task.dueDate);
      const existingTask = existingTaskRows.find((row) => row.title === task.title && safeDate(row.due_date) === dueDate);
      const taskRow = {
        person_id: personId,
        title: task.title,
        description: task.description ?? "",
        due_date: dueDate,
        status: "todo",
        priority: clampPriority(task.priority),
        category: task.category ?? "notebook",
        requires_professional: Boolean(task.requiresProfessional),
        created_by: user.id,
        updated_at: now
      };

      if (existingTask?.id) {
        const { error } = await supabase.from("tasks").update(taskRow).eq("id", existingTask.id);
        if (error) return jsonError(error.message, 500);
      } else {
        const { error } = await supabase.from("tasks").insert(taskRow);
        if (error) return jsonError(error.message, 500);
      }
      syncedTasks += 1;
    }

    const { data: existingEvents, error: existingEventsError } = await supabase
      .from("timeline_events")
      .select("id,metadata")
      .eq("person_id", personId)
      .eq("event_type", "diary");

    if (existingEventsError) return jsonError(existingEventsError.message, 500);

    const existingEventRows = asArray<AnyRecord>(existingEvents);
    for (const entry of diaryEntries.filter((item) => item.caseId === localCaseId).slice(0, 500)) {
      const localDiaryId = String(entry.id || `${localCaseId}-${entry.date || now}`);
      const existingEvent = existingEventRows.find((row) => asRecord(row.metadata).localDiaryId === localDiaryId);
      const eventRow = {
        person_id: personId,
        event_type: "diary",
        event_date: safeDate(entry.date),
        title: entry.mood === "urgent" ? "急ぎの記録" : entry.mood === "changed" ? "変化の記録" : "日々の記録",
        body: String(entry.body || "記録"),
        mood: ["stable", "changed", "urgent"].includes(entry.mood ?? "") ? entry.mood : "stable",
        attachments: asArray(entry.attachments),
        metadata: { localDiaryId, localCaseId, syncedAt: now },
        created_by: user.id
      };

      if (existingEvent?.id) {
        const { error } = await supabase.from("timeline_events").update(eventRow).eq("id", existingEvent.id);
        if (error) return jsonError(error.message, 500);
      } else {
        const { error } = await supabase.from("timeline_events").insert(eventRow);
        if (error) return jsonError(error.message, 500);
      }
      syncedEntries += 1;
    }
  }

  return NextResponse.json({ ok: true, familyId, syncedPeople, syncedTasks, syncedEntries });
}

async function updatePerson(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, id: string, row: AnyRecord) {
  const { data, error } = await supabase
    .from("people")
    .update(row)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function insertPerson(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, row: AnyRecord) {
  const { data, error } = await supabase
    .from("people")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
