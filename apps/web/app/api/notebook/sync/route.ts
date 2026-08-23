import { NextResponse, type NextRequest } from "next/server";
import {
  buildDiagnosisResult,
  canCreateNotebook,
  NOTEBOOK_LIMIT_MESSAGE,
  type DiagnosisAnswers,
  type ParentStatus
} from "@oyano/shared";
import { getServerSupabase } from "@/lib/serverSupabase";

type AnyRecord = Record<string, any>;
type ServerSupabase = NonNullable<ReturnType<typeof getServerSupabase>>;
type NotebookAttachmentSnapshot = {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
  storageBucket?: string;
  storagePath?: string;
  uploadedAt?: string;
  uploadStatus?: "local" | "uploaded";
};

type LocalTask = {
  id?: string;
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: number;
  category?: string;
  requiresProfessional?: boolean;
  progress?: string;
  assignee?: string;
  note?: string;
  updatedAt?: string;
};

type LocalCase = {
  id?: string;
  selectedStatus?: string;
  answers?: AnyRecord;
  personProfile?: AnyRecord;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
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

const notebookPhotoBucket = "home-photos";

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

function normalizeTaskProgress(value: unknown) {
  return value === "doing" || value === "done" || value === "skipped" ? value : "todo";
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function taskSnapshot(localCase: LocalCase) {
  return asArray<LocalTask>(localCase.result?.tasks).slice(0, 40).map((task, index) => ({
    id: safeText(task.id) || `task-${index}`,
    title: safeText(task.title) || "確認すること",
    description: safeText(task.description),
    dueDate: safeDate(task.dueDate),
    priority: clampPriority(task.priority),
    category: safeText(task.category) || "notebook",
    requiresProfessional: Boolean(task.requiresProfessional),
    progress: normalizeTaskProgress(task.progress),
    assignee: safeText(task.assignee),
    note: safeText(task.note),
    updatedAt: safeIso(task.updatedAt)
  }));
}

function notebookPhotoOwnerId(storagePath: string) {
  const parts = storagePath.split("/");
  return parts[0] === "notebook" && parts[1] ? parts[1] : null;
}

function canUseNotebookPhoto(
  storageBucket: string,
  storagePath: string,
  allowedNotebookPhotoUserIds?: Set<string>
) {
  if (storageBucket !== notebookPhotoBucket) return false;

  const ownerId = notebookPhotoOwnerId(storagePath);
  if (!ownerId) return false;

  return allowedNotebookPhotoUserIds ? allowedNotebookPhotoUserIds.has(ownerId) : true;
}

function attachmentSnapshot(value: unknown, allowedNotebookPhotoUserIds?: Set<string>): NotebookAttachmentSnapshot[] {
  return asArray<AnyRecord>(value).slice(0, 10).map((attachment, index) => {
    const storageBucket = safeText(attachment.storageBucket);
    const storagePath = safeText(attachment.storagePath);
    const canKeepStorage = Boolean(
      storageBucket &&
      storagePath &&
      canUseNotebookPhoto(storageBucket, storagePath, allowedNotebookPhotoUserIds)
    );
    const snapshot: NotebookAttachmentSnapshot = {
      id: safeText(attachment.id) || `attachment-${index}`,
      name: safeText(attachment.name) || "写真",
      type: safeText(attachment.type) || "image/jpeg",
      size: Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : 0,
      uploadStatus: canKeepStorage ? "uploaded" : "local"
    };

    if (canKeepStorage) {
      snapshot.storageBucket = storageBucket;
      snapshot.storagePath = storagePath;
      snapshot.uploadedAt = safeText(attachment.uploadedAt) || undefined;
    } else if (!storageBucket && !storagePath) {
      const previewUrl = safeText(attachment.previewUrl);
      if (previewUrl) snapshot.previewUrl = previewUrl;
    }

    return snapshot;
  });
}

async function attachSignedPhotoPreviews(
  supabase: ServerSupabase,
  value: unknown,
  allowedNotebookPhotoUserIds: Set<string>
): Promise<NotebookAttachmentSnapshot[]> {
  const attachments = attachmentSnapshot(value, allowedNotebookPhotoUserIds);
  return Promise.all(attachments.map(async (attachment) => {
    if (
      !attachment.storageBucket ||
      !attachment.storagePath ||
      !canUseNotebookPhoto(attachment.storageBucket, attachment.storagePath, allowedNotebookPhotoUserIds)
    ) return attachment;

    const { data, error } = await supabase.storage
      .from(attachment.storageBucket)
      .createSignedUrl(attachment.storagePath, 60 * 60);

    if (error || !data?.signedUrl) return attachment;
    return { ...attachment, previewUrl: data.signedUrl };
  }));
}

function newestIso(values: unknown[], fallback = new Date().toISOString()) {
  let newest = 0;
  values.forEach((value) => {
    if (typeof value !== "string") return;
    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) newest = Math.max(newest, timestamp);
  });
  return newest > 0 ? new Date(newest).toISOString() : fallback;
}

function localCaseUpdatedAt(localCase: LocalCase, fallback = new Date().toISOString()) {
  const profile = asRecord(localCase.personProfile);
  const tasks = asArray<LocalTask>(localCase.result?.tasks);
  return newestIso([
    localCase.updatedAt,
    localCase.createdAt,
    profile.updatedAt,
    ...tasks.map((task) => task.updatedAt)
  ], fallback);
}

function isStaleNotebookWrite(remoteProfile: AnyRecord, incomingLocalUpdatedAt: string) {
  const remoteLocalUpdatedAt = remoteProfile.localUpdatedAt;
  if (typeof remoteLocalUpdatedAt !== "string") return false;

  const remoteTime = new Date(remoteLocalUpdatedAt).getTime();
  const incomingTime = new Date(incomingLocalUpdatedAt).getTime();
  if (Number.isNaN(remoteTime) || Number.isNaN(incomingTime)) return false;

  return remoteTime > incomingTime + 1000;
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

function parentLocationForCase(localCase: LocalCase) {
  const profile = asRecord(localCase.personProfile);
  return {
    prefecture: safeText(profile.parentPrefecture),
    city: safeText(profile.parentCity)
  };
}

function postgrestMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as AnyRecord;
    return [record.message, record.details, record.hint, record.code].filter(Boolean).join(" ");
  }
  return String(error ?? "");
}

function isPeopleLocationSchemaError(error: unknown) {
  const message = postgrestMessage(error);
  return /people|schema cache|column/i.test(message) && /prefecture|city/i.test(message);
}

function personRowWithoutLocation(row: AnyRecord) {
  const copy = { ...row };
  delete copy.prefecture;
  delete copy.city;
  return copy;
}

function profilePayload(localCase: LocalCase, now: string) {
  const localUpdatedAt = localCaseUpdatedAt(localCase, now);
  return {
    localCaseId: localCase.id,
    localCreatedAt: localCase.createdAt,
    localUpdatedAt,
    localAnswers: asRecord(localCase.answers),
    personProfile: asRecord(localCase.personProfile),
    localResultSummary: localCase.result?.summary ?? null,
    localTasks: taskSnapshot(localCase),
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

type FamilyBillingContext = {
  plan: "free" | "plus";
  isFamilyOwner: boolean;
};

async function billingContextForFamilies(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  familyIds: string[],
  userId: string
): Promise<FamilyBillingContext> {
  const { data } = await supabase
    .from("families")
    .select("id,plan,owner_user_id")
    .in("id", familyIds);
  const rows = asArray<AnyRecord>(data);
  return {
    plan: rows.some((row) => row.plan === "plus") ? "plus" : "free",
    isFamilyOwner: rows.some((row) => row.owner_user_id === userId)
  };
}

async function billingContextForFamily(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  familyId: string,
  userId: string
): Promise<FamilyBillingContext> {
  const { data, error } = await supabase
    .from("families")
    .select("plan,owner_user_id")
    .eq("id", familyId)
    .single();
  if (error) throw error;
  return {
    plan: data?.plan === "plus" ? "plus" : "free",
    isFamilyOwner: data?.owner_user_id === userId
  };
}

async function notebookPhotoOwnerIdsForFamilies(
  supabase: ServerSupabase,
  familyIds: string[]
) {
  if (familyIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from("family_members")
    .select("user_id")
    .in("family_id", familyIds);
  if (error) throw error;

  return new Set(asArray<AnyRecord>(data).map((row) => safeText(row.user_id)).filter(Boolean));
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
  if (familyIds.length === 0) {
    return NextResponse.json({
      cases: [],
      diaryEntries: [],
      plan: "free",
      isFamilyOwner: true,
      canManageFamilyBilling: true
    });
  }

  // 手帳を何冊まで作れるかの判定に使うため、planも返す。
  // これが無いと、クライアントは上限を知らないまま2冊目を作らせてしまう。
  const billing = await billingContextForFamilies(supabase, familyIds, user.id);
  const { plan } = billing;
  let allowedNotebookPhotoUserIds: Set<string>;
  try {
    allowedNotebookPhotoUserIds = await notebookPhotoOwnerIdsForFamilies(supabase, familyIds);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "写真の閲覧権限を確認できませんでした。", 500);
  }

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("*")
    .in("family_id", familyIds)
    .order("created_at", { ascending: false });

  if (peopleError) return jsonError(peopleError.message, 500);

  const personIds = asArray<AnyRecord>(people).map((person) => person.id).filter(Boolean);
  if (personIds.length === 0) {
    return NextResponse.json({
      cases: [],
      diaryEntries: [],
      plan,
      isFamilyOwner: billing.isFamilyOwner,
      canManageFamilyBilling: billing.isFamilyOwner
    });
  }

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
    const rawPersonProfile = asRecord(profile.personProfile);
    const parentPrefecture = safeText(rawPersonProfile.parentPrefecture) || safeText(person.prefecture);
    const parentCity = safeText(rawPersonProfile.parentCity) || safeText(person.city);
    const personProfile: AnyRecord = {
      ...rawPersonProfile,
      ...(parentPrefecture ? { parentPrefecture } : {}),
      ...(parentCity ? { parentCity } : {})
    };
    const answers = asRecord(profile.localAnswers);
    const selectedStatus = normalizeStatus(person.current_status || answers.selectedStatus);
    const profileTasks = asArray<LocalTask>(profile.localTasks).map((task) => ({
      status: selectedStatus,
      id: safeText(task.id),
      title: safeText(task.title) || "確認すること",
      description: safeText(task.description),
      defaultDueOffsetDays: 0,
      priority: clampPriority(task.priority),
      category: safeText(task.category) || "notebook",
      requiresProfessional: Boolean(task.requiresProfessional),
      dueDate: safeDate(task.dueDate),
      progress: normalizeTaskProgress(task.progress),
      assignee: safeText(task.assignee),
      note: safeText(task.note),
      updatedAt: safeIso(task.updatedAt)
    }));
    const dbTasks = (tasksByPerson.get(person.id) ?? []).map((task) => ({
      status: selectedStatus,
      title: task.title,
      description: task.description ?? "",
      defaultDueOffsetDays: 0,
      priority: clampPriority(task.priority),
      category: task.category ?? "notebook",
      dueDate: safeDate(task.due_date),
      progress: normalizeTaskProgress(task.status),
      updatedAt: safeIso(task.updated_at)
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
      updatedAt: safeIso(profile.localUpdatedAt || person.profile_updated_at || person.updated_at || profile.localCreatedAt || person.created_at),
      result: {
        ...fallbackResult,
        summary: String(profile.localResultSummary || fallbackResult.summary),
        tasks: profileTasks.length > 0 ? profileTasks : dbTasks.length > 0 ? dbTasks : []
      },
      supportPackStatus: "none"
    };
  });

  const diaryEntries = await Promise.all(asArray<AnyRecord>(events).map(async (event) => {
    const metadata = asRecord(event.metadata);
    return {
      id: String(metadata.localDiaryId || event.id),
      caseId: String(metadata.localCaseId || personToLocalCaseId.get(event.person_id) || event.person_id),
      date: safeDate(event.event_date),
      mood: ["stable", "changed", "urgent"].includes(event.mood) ? event.mood : "stable",
      body: String(event.body || event.title || ""),
      attachments: await attachSignedPhotoPreviews(supabase, event.attachments, allowedNotebookPhotoUserIds),
      createdAt: safeIso(event.created_at)
    };
  }));

  return NextResponse.json({
    cases,
    diaryEntries,
    plan,
    isFamilyOwner: billing.isFamilyOwner,
    canManageFamilyBilling: billing.isFamilyOwner
  });
}

async function syncDiaryEntriesForPerson(input: {
  supabase: ServerSupabase;
  personId: string;
  userId: string;
  localCaseId: string;
  diaryEntries: LocalDiaryEntry[];
  now: string;
  allowedNotebookPhotoUserIds: Set<string>;
}) {
  const { supabase, personId, userId, localCaseId, diaryEntries, now, allowedNotebookPhotoUserIds } = input;
  const { data: existingEvents, error: existingEventsError } = await supabase
    .from("timeline_events")
    .select("id,metadata")
    .eq("person_id", personId)
    .eq("event_type", "diary");

  if (existingEventsError) throw existingEventsError;

  let syncedEntries = 0;
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
      attachments: attachmentSnapshot(entry.attachments, allowedNotebookPhotoUserIds),
      metadata: { localDiaryId, localCaseId, syncedAt: now },
      created_by: userId
    };

    if (existingEvent?.id) {
      const { error } = await supabase.from("timeline_events").update(eventRow).eq("id", existingEvent.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("timeline_events").insert(eventRow);
      if (error) throw error;
    }
    syncedEntries += 1;
  }

  return syncedEntries;
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

  // 無料プランで作れる手帳の数を、クラウド側でも止める。
  // 画面側の判定だけでは、古い端末や直接呼び出しをすり抜けてしまう。
  // すでにクラウドにある手帳の更新は、上限に関係なく通す。止めるのは新しく増えるぶんだけ。
  let billing: FamilyBillingContext;
  try {
    billing = await billingContextForFamily(supabase, familyId, user.id);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "家族データを確認できませんでした。", 500);
  }
  const { plan } = billing;
  const { data: currentPeople, error: currentPeopleError } = await supabase
    .from("people")
    .select("id")
    .eq("family_id", familyId);
  if (currentPeopleError) return jsonError(currentPeopleError.message, 500);
  let peopleInCloud = asArray<AnyRecord>(currentPeople).length;
  let allowedNotebookPhotoUserIds: Set<string>;
  try {
    allowedNotebookPhotoUserIds = await notebookPhotoOwnerIdsForFamilies(supabase, [familyId]);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "写真の保存権限を確認できませんでした。", 500);
  }

  let syncedPeople = 0;
  let syncedTasks = 0;
  let syncedEntries = 0;
  let skippedPeople = 0;
  let skippedSharedPeople = 0;

  for (const localCase of localCases) {
    const localCaseId = String(localCase.id);
    const selectedStatus = normalizeStatus(localCase.selectedStatus || localCase.answers?.selectedStatus);
    const displayName = displayNameForCase(localCase);
    const relationship = relationshipForCase(localCase);
    const parentLocation = parentLocationForCase(localCase);
    const profile = profilePayload(localCase, now);
    const incomingLocalUpdatedAt = safeIso(profile.localUpdatedAt);

    const { data: existingPeople, error: existingPeopleError } = await supabase
      .from("people")
      .select("id, profile")
      .eq("family_id", familyId)
      .eq("profile->>localCaseId", localCaseId)
      .limit(1);

    if (existingPeopleError) return jsonError(existingPeopleError.message, 500);

    const personRow = {
      family_id: familyId,
      display_name: displayName,
      relationship_to_family: relationship,
      prefecture: parentLocation.prefecture || null,
      city: parentLocation.city || null,
      current_status: selectedStatus,
      profile,
      profile_updated_at: now,
      updated_at: now
    };

    const existingPerson = existingPeople?.[0];
    const existingPersonId = existingPerson?.id;

    if (existingPersonId) {
      try {
        syncedEntries += await syncDiaryEntriesForPerson({
          supabase,
          personId: existingPersonId,
          userId: user.id,
          localCaseId,
          diaryEntries,
          now,
          allowedNotebookPhotoUserIds
        });
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "日記をクラウドへ保存できませんでした。", 500);
      }
    }

    if (existingPersonId && isStaleNotebookWrite(asRecord(existingPerson.profile), incomingLocalUpdatedAt)) {
      return NextResponse.json(
        {
          error: "notebook_conflict",
          message: "別の端末で新しい更新があります。先にクラウドの控えを復元してから、もう一度保存してください。"
        },
        { status: 409 }
      );
    }

    if (!existingPersonId && !billing.isFamilyOwner) {
      skippedPeople += 1;
      skippedSharedPeople += 1;
      continue;
    }

    if (!existingPersonId && !canCreateNotebook(plan, peopleInCloud)) {
      // 上限を超える新しい手帳は、クラウドへ上げない。端末の中には残る。
      skippedPeople += 1;
      continue;
    }

    const personId = existingPersonId
      ? await updatePerson(supabase, existingPersonId, personRow)
      : await insertPerson(supabase, personRow);

    if (!existingPersonId) peopleInCloud += 1;
    syncedPeople += 1;

    const { data: existingTasks, error: existingTasksError } = await supabase
      .from("tasks")
      .select("id,title,due_date")
      .eq("person_id", personId);

    if (existingTasksError) return jsonError(existingTasksError.message, 500);

    const existingTaskRows = asArray<AnyRecord>(existingTasks);
    for (const task of taskSnapshot(localCase)) {
      if (!task.title) continue;
      const dueDate = safeDate(task.dueDate);
      const existingTask = existingTaskRows.find((row) => row.title === task.title && safeDate(row.due_date) === dueDate);
      const taskRow = {
        person_id: personId,
        title: task.title,
        description: task.description ?? "",
        due_date: dueDate,
        status: normalizeTaskProgress(task.progress),
        priority: clampPriority(task.priority),
        category: task.category ?? "notebook",
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

    if (!existingPersonId) {
      try {
        syncedEntries += await syncDiaryEntriesForPerson({
          supabase,
          personId,
          userId: user.id,
          localCaseId,
          diaryEntries,
          now,
          allowedNotebookPhotoUserIds
        });
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "日記をクラウドへ保存できませんでした。", 500);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    familyId,
    plan,
    isFamilyOwner: billing.isFamilyOwner,
    canManageFamilyBilling: billing.isFamilyOwner,
    syncedPeople,
    syncedTasks,
    syncedEntries,
    skippedPeople,
    ...(skippedSharedPeople > 0
      ? { notice: "共有された手帳では、新しい対象者の追加は手帳を作った人が行います。" }
      : skippedPeople > 0
        ? { notice: NOTEBOOK_LIMIT_MESSAGE }
        : {})
  });
}

async function updatePerson(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, id: string, row: AnyRecord) {
  let { data, error } = await supabase
    .from("people")
    .update(row)
    .eq("id", id)
    .select("id")
    .single();
  if (error && isPeopleLocationSchemaError(error)) {
    ({ data, error } = await supabase
      .from("people")
      .update(personRowWithoutLocation(row))
      .eq("id", id)
      .select("id")
      .single());
  }
  if (error) throw error;
  if (!data) throw new Error("person_update_failed");
  return data.id as string;
}

async function insertPerson(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, row: AnyRecord) {
  let { data, error } = await supabase
    .from("people")
    .insert(row)
    .select("id")
    .single();
  if (error && isPeopleLocationSchemaError(error)) {
    ({ data, error } = await supabase
      .from("people")
      .insert(personRowWithoutLocation(row))
      .select("id")
      .single());
  }
  if (error) throw error;
  if (!data) throw new Error("person_insert_failed");
  return data.id as string;
}
