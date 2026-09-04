import { NextResponse, type NextRequest } from "next/server";
import {
  buildDiagnosisResult,
  canCreateNotebook,
  NOTEBOOK_LIMIT_MESSAGE,
  type DiagnosisAnswers,
  type ParentStatus
} from "@oyano/shared";
import { getServerSupabase } from "@/lib/serverSupabase";
import { japanDateInputValue } from "@/lib/date";

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
  defaultDueOffsetDays?: number;
  priority?: number;
  category?: string;
  requiresProfessional?: boolean;
  progress?: string;
  assignee?: string;
  note?: string;
  updatedAt?: string;
  cloudRevision?: number;
  cloudHash?: string;
};

type LocalCase = {
  id?: string;
  selectedStatus?: string;
  answers?: AnyRecord;
  personProfile?: AnyRecord;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  cloudPersonId?: string;
  cloudRevision?: number;
  cloudHash?: string;
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
  updatedAt?: string;
  cloudRevision?: number;
  cloudHash?: string;
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
const NOTEBOOK_SYNC_MAX_ENTRIES_PER_REQUEST = 500;
const NOTEBOOK_RESTORE_MAX_PAGE_SIZE = 500;

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

function safeDate(value: unknown, fallback = japanDateInputValue()) {
  return typeof value === "string" && value.length >= 8 ? value.slice(0, 10) : fallback;
}

function safeIso(value: unknown) {
  const normalized = normalizedIso(value);
  return normalized ?? new Date().toISOString();
}

function normalizedIso(value: unknown) {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
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
  const fallbackUpdatedAt = normalizedIso(localCase.updatedAt)
    ?? normalizedIso(localCase.createdAt)
    ?? "1970-01-01T00:00:00.000Z";
  const fallbackDueDate = safeDate(localCase.createdAt, "1970-01-01");
  return asArray<LocalTask>(localCase.result?.tasks).slice(0, 40).map((task, index) => ({
    id: safeText(task.id) || `task-${index}`,
    title: safeText(task.title) || "確認すること",
    description: safeText(task.description),
    dueDate: safeDate(task.dueDate, fallbackDueDate),
    defaultDueOffsetDays: Number.isFinite(Number(task.defaultDueOffsetDays)) ? Number(task.defaultDueOffsetDays) : 0,
    priority: clampPriority(task.priority),
    category: safeText(task.category) || "notebook",
    requiresProfessional: Boolean(task.requiresProfessional),
    progress: normalizeTaskProgress(task.progress),
    assignee: safeText(task.assignee),
    note: safeText(task.note),
    updatedAt: normalizedIso(task.updatedAt) ?? fallbackUpdatedAt,
    cloudRevision: Number.isInteger(Number(task.cloudRevision)) ? Number(task.cloudRevision) : null,
    cloudHash: safeText(task.cloudHash) || null
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
  return newestIso([
    localCase.updatedAt,
    localCase.createdAt,
    profile.updatedAt
  ], fallback);
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

function profilePayload(localCase: LocalCase, fallback: string) {
  const localUpdatedAt = localCaseUpdatedAt(localCase, fallback);
  return {
    localCaseId: localCase.id,
    localCreatedAt: localCase.createdAt,
    localUpdatedAt,
    localAnswers: asRecord(localCase.answers),
    personProfile: asRecord(localCase.personProfile),
    localResultSummary: localCase.result?.summary ?? null,
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

type FamilyBillingContext = {
  plan: "free" | "plus";
  isFamilyOwner: boolean;
};

type NotebookFamilyOption = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member" | "viewer";
};

async function notebookFamiliesForUser(
  supabase: ServerSupabase,
  userId: string
): Promise<NotebookFamilyOption[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id,role")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;

  const membershipRows = asArray<AnyRecord>(memberships);
  const familyIds = membershipRows.map((row) => safeText(row.family_id)).filter(Boolean);
  if (familyIds.length === 0) return [];

  const { data: families, error: familiesError } = await supabase
    .from("families")
    .select("id,name")
    .in("id", familyIds);
  if (familiesError) throw familiesError;
  const nameById = new Map(asArray<AnyRecord>(families).map((row) => [safeText(row.id), safeText(row.name) || "家族の手帳"]));

  return membershipRows.map((row) => {
    const role = row.role === "owner" || row.role === "admin" || row.role === "member" ? row.role : "viewer";
    const id = safeText(row.family_id);
    return { id, name: nameById.get(id) ?? "家族の手帳", role };
  }).sort((a, b) => a.name.localeCompare(b.name, "ja"));
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
  let families: NotebookFamilyOption[];
  try {
    families = await notebookFamiliesForUser(supabase, user.id);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "家族データを確認できませんでした。", 500);
  }

  const requestedFamilyId = safeText(request.nextUrl.searchParams.get("familyId"));
  if (requestedFamilyId && !families.some((family) => family.id === requestedFamilyId)) {
    return NextResponse.json({ error: "family_access_denied", message: "この家族の手帳を開く権限がありません。" }, { status: 403 });
  }
  if (!requestedFamilyId && families.length > 1) {
    return NextResponse.json({
      error: "family_selection_required",
      message: "保存先の家族を選んでください。",
      authUserId: user.id,
      families
    }, { status: 409 });
  }

  const selectedFamily = requestedFamilyId
    ? families.find((family) => family.id === requestedFamilyId)
    : families[0];
  if (!selectedFamily) {
    return NextResponse.json({
      cases: [],
      diaryEntries: [],
      authUserId: user.id,
      familyId: null,
      families,
      memberRole: null,
      plan: "free",
      isFamilyOwner: true,
      canManageFamilyBilling: true,
      diaryEntriesOffset: 0,
      diaryEntriesTotal: 0,
      diaryEntriesHasMore: false
    });
  }

  // 手帳を何冊まで作れるかの判定に使うため、planも返す。
  // これが無いと、クライアントは上限を知らないまま2冊目を作らせてしまう。
  const familyId = selectedFamily.id;
  const billing = await billingContextForFamily(supabase, familyId, user.id);
  const { plan } = billing;
  let allowedNotebookPhotoUserIds: Set<string>;
  try {
    allowedNotebookPhotoUserIds = await notebookPhotoOwnerIdsForFamilies(supabase, [familyId]);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "写真の閲覧権限を確認できませんでした。", 500);
  }

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });

  if (peopleError) return jsonError(peopleError.message, 500);

  const personIds = asArray<AnyRecord>(people).map((person) => person.id).filter(Boolean);
  if (personIds.length === 0) {
    return NextResponse.json({
      cases: [],
      diaryEntries: [],
      authUserId: user.id,
      familyId,
      families,
      memberRole: selectedFamily.role,
      plan,
      isFamilyOwner: billing.isFamilyOwner,
      canManageFamilyBilling: billing.isFamilyOwner,
      diaryEntriesOffset: 0,
      diaryEntriesTotal: 0,
      diaryEntriesHasMore: false
    });
  }

  const requestedOffset = Number(request.nextUrl.searchParams.get("diaryOffset") ?? "0");
  const requestedLimit = Number(request.nextUrl.searchParams.get("diaryLimit") ?? String(NOTEBOOK_RESTORE_MAX_PAGE_SIZE));
  const diaryOffset = Number.isFinite(requestedOffset) && requestedOffset >= 0 ? Math.floor(requestedOffset) : 0;
  const diaryLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(Math.floor(requestedLimit), NOTEBOOK_RESTORE_MAX_PAGE_SIZE)
    : NOTEBOOK_RESTORE_MAX_PAGE_SIZE;
  const [{ data: tasks, error: tasksError }, {
    data: events,
    error: eventsError,
    count: diaryEntriesTotal
  }] = await Promise.all([
    supabase.from("tasks").select("*").in("person_id", personIds).order("due_date", { ascending: true }),
    supabase
      .from("timeline_events")
      .select("*", { count: "exact" })
      .in("person_id", personIds)
      .eq("event_type", "diary")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(diaryOffset, diaryOffset + diaryLimit - 1)
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
    // Older mobile builds stored these fields directly in people.profile.
    // The nested PWA shape remains canonical, but reading the flat shape here
    // prevents an existing mobile-only profile from disappearing on restore.
    const mobilePersonProfile: AnyRecord = {
      ...(safeText(profile.fullName) ? { fullName: safeText(profile.fullName) } : {}),
      ...(safeText(profile.displayName || person.display_name)
        ? { displayName: safeText(profile.displayName || person.display_name) }
        : {}),
      ...(safeText(profile.relationship || person.relationship_to_family)
        ? { relationship: safeText(profile.relationship || person.relationship_to_family) }
        : {}),
      ...(safeText(profile.birthDate) ? { birthDate: safeText(profile.birthDate) } : {}),
      ...(safeText(profile.careStatus || person.current_status)
        ? { careStatus: safeText(profile.careStatus || person.current_status) }
        : {}),
      ...(safeText(profile.keyContact) ? { keyContact: safeText(profile.keyContact) } : {}),
      ...(safeText(profile.hospitalOrFacility)
        ? { hospitalOrFacility: safeText(profile.hospitalOrFacility) }
        : {}),
      ...(safeText(profile.medicationNote) ? { medicationNote: safeText(profile.medicationNote) } : {}),
      ...(safeText(profile.documentLocationNote)
        ? { documentLocationNote: safeText(profile.documentLocationNote) }
        : {}),
      ...(safeText(profile.familyStructure)
        ? { familyStructureNote: safeText(profile.familyStructure) }
        : {}),
      ...(safeText(profile.updatedAt) ? { updatedAt: safeText(profile.updatedAt) } : {})
    };
    const parentPrefecture = safeText(rawPersonProfile.parentPrefecture) || safeText(person.prefecture);
    const parentCity = safeText(rawPersonProfile.parentCity) || safeText(person.city);
    const personProfile: AnyRecord = {
      ...mobilePersonProfile,
      ...rawPersonProfile,
      ...(parentPrefecture ? { parentPrefecture } : {}),
      ...(parentCity ? { parentCity } : {})
    };
    const answers = asRecord(profile.localAnswers);
    const selectedStatus = normalizeStatus(person.current_status || answers.selectedStatus);
    const profileTasks = asArray<LocalTask>(profile.localTasks).map((task, index) => ({
      status: selectedStatus,
      id: safeText(task.id) || `${localCaseId}-legacy-task-${index}`,
      title: safeText(task.title) || "確認すること",
      description: safeText(task.description),
      defaultDueOffsetDays: Number.isFinite(Number(task.defaultDueOffsetDays)) ? Number(task.defaultDueOffsetDays) : 0,
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
      ...(() => {
        const notebookMetadata = asRecord(task.notebook_metadata);
        return {
          assignee: safeText(notebookMetadata.assignee),
          note: safeText(notebookMetadata.note),
          requiresProfessional: Boolean(notebookMetadata.requiresProfessional),
          defaultDueOffsetDays: Number.isFinite(Number(notebookMetadata.defaultDueOffsetDays))
            ? Number(notebookMetadata.defaultDueOffsetDays)
            : 0
        };
      })(),
      status: selectedStatus,
      id: safeText(task.local_task_id) || safeText(task.id),
      title: task.title,
      description: task.description ?? "",
      priority: clampPriority(task.priority),
      category: task.category ?? "notebook",
      dueDate: safeDate(task.due_date),
      progress: normalizeTaskProgress(task.status),
      updatedAt: safeIso(task.updated_at),
      cloudRevision: Number.isInteger(Number(task.cloud_revision)) ? Number(task.cloud_revision) : 0,
      cloudHash: safeText(task.cloud_hash) || undefined,
      cloudSyncedUpdatedAt: safeIso(task.updated_at)
    }));
    // A legacy non-transactional sync could have written some tasks only to
    // profile.localTasks and others to public.tasks. Keep the union so a
    // partial old write never makes an existing task disappear. DB rows win
    // when both sources carry the same local identity.
    const mergedTasksById = new Map<string, LocalTask>();
    profileTasks.forEach((task) => mergedTasksById.set(safeText(task.id), task));
    dbTasks.forEach((task) => mergedTasksById.set(safeText(task.id), task));
    const mergedTasks = [...mergedTasksById.values()];
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
      cloudPersonId: String(person.id),
      cloudRevision: Number.isInteger(Number(person.cloud_revision)) ? Number(person.cloud_revision) : 0,
      cloudHash: safeText(person.cloud_hash) || undefined,
      cloudSyncedUpdatedAt: safeIso(profile.localUpdatedAt || person.profile_updated_at || person.updated_at || profile.localCreatedAt || person.created_at),
      result: {
        ...fallbackResult,
        summary: String(profile.localResultSummary || fallbackResult.summary),
        tasks: mergedTasks
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
      createdAt: safeIso(metadata.localCreatedAt || event.created_at),
      updatedAt: safeIso(metadata.localUpdatedAt || metadata.syncedAt || event.created_at),
      cloudRevision: Number.isInteger(Number(event.cloud_revision)) ? Number(event.cloud_revision) : 0,
      cloudHash: safeText(event.cloud_hash) || undefined,
      cloudSyncedUpdatedAt: safeIso(metadata.localUpdatedAt || metadata.syncedAt || event.created_at)
    };
  }));

  return NextResponse.json({
    cases,
    diaryEntries,
    authUserId: user.id,
    familyId,
    families,
    memberRole: selectedFamily.role,
    plan,
    isFamilyOwner: billing.isFamilyOwner,
    canManageFamilyBilling: billing.isFamilyOwner,
    diaryEntriesOffset: diaryOffset,
    diaryEntriesTotal: diaryEntriesTotal ?? diaryOffset + diaryEntries.length,
    diaryEntriesHasMore: diaryOffset + diaryEntries.length < (diaryEntriesTotal ?? 0)
  });
}

function optionalCloudRevision(value: unknown) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : null;
}

function diaryMood(value: unknown): "stable" | "changed" | "urgent" {
  return value === "changed" || value === "urgent" ? value : "stable";
}

function normalizedNotebookCase(localCase: LocalCase, now: string) {
  const localCaseId = safeText(localCase.id);
  const selectedStatus = normalizeStatus(localCase.selectedStatus || localCase.answers?.selectedStatus);
  const location = parentLocationForCase(localCase);
  return {
    localCaseId,
    personId: safeText(localCase.cloudPersonId) || null,
    cloudRevision: optionalCloudRevision(localCase.cloudRevision),
    cloudHash: safeText(localCase.cloudHash) || null,
    displayName: displayNameForCase(localCase),
    relationshipToFamily: relationshipForCase(localCase),
    prefecture: location.prefecture || null,
    city: location.city || null,
    currentStatus: selectedStatus,
    profile: profilePayload(localCase, now),
    localTasks: taskSnapshot(localCase).map((task, index) => ({
      localTaskId: safeText(task.id) || `${localCaseId}-task-${index}`,
      cloudRevision: optionalCloudRevision(task.cloudRevision),
      cloudHash: safeText(task.cloudHash) || null,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      category: task.category,
      status: task.progress,
      assignee: task.assignee,
      note: task.note,
      notebookMetadata: {
        assignee: task.assignee,
        note: task.note,
        requiresProfessional: task.requiresProfessional,
        defaultDueOffsetDays: task.defaultDueOffsetDays
      },
      localUpdatedAt: task.updatedAt
    }))
  };
}

function normalizedNotebookDiary(
  entry: LocalDiaryEntry,
  allowedNotebookPhotoUserIds: Set<string>,
  now: string
) {
  const localCaseId = safeText(entry.caseId);
  const localDiaryId = safeText(entry.id) || `${localCaseId}-${safeDate(entry.date, now.slice(0, 10))}`;
  const mood = diaryMood(entry.mood);
  return {
    localCaseId,
    localDiaryId,
    cloudRevision: optionalCloudRevision(entry.cloudRevision),
    cloudHash: safeText(entry.cloudHash) || null,
    date: safeDate(entry.date),
    title: mood === "urgent" ? "急ぎの記録" : mood === "changed" ? "変化の記録" : "日々の記録",
    body: safeText(entry.body) || "記録",
    mood,
    attachments: attachmentSnapshot(entry.attachments, allowedNotebookPhotoUserIds),
    metadata: {},
    createdAt: normalizedIso(entry.createdAt) ?? now,
    updatedAt: normalizedIso(entry.updatedAt) ?? normalizedIso(entry.createdAt) ?? now
  };
}

function notebookRpcErrorResponse(error: unknown) {
  const message = postgrestMessage(error);
  if (/notebook_diary_deleted/i.test(message)) {
    return NextResponse.json({
      error: "notebook_deleted_record",
      message: "削除済みの記録が端末に残っています。クラウドの控えを読み直してください。"
    }, { status: 409 });
  }
  if (/family_selection_required|notebook_sync_family_id_required|notebook_sync_choose_family_or_create/i.test(message)) {
    return NextResponse.json({ error: "family_selection_required", message: "保存先の家族を選んでください。" }, { status: 409 });
  }
  if (/family_access_denied|family_membership_required|viewer_read_only|viewer_cannot_mutate|profile_admin_required|profile_requires_owner_or_admin|new_person_requires_owner_or_admin/i.test(message)) {
    return NextResponse.json({ error: "family_access_denied", message: "この家族の手帳を変更する権限がありません。" }, { status: 403 });
  }
  if (/notebook_(case|profile|task|entry|diary|request|new_[a-z_]+)_?conflict|notebook_conflict|new_(case|task|diary)_has_cloud_identity/i.test(message)) {
    return NextResponse.json({
      error: "notebook_conflict",
      message: "別の端末で新しい更新があります。自動では上書きしていません。クラウドの控えを読み込み、内容を確認してください。"
    }, { status: 409 });
  }
  if (/client_upgrade_required|revision_required/i.test(message)) {
    return NextResponse.json({
      error: "client_upgrade_required",
      message: "安全な保存方式へ更新されました。画面を再読み込みしてクラウドの控えを確認してください。"
    }, { status: 409 });
  }
  if (/notebook_free_plan_person_limit/i.test(message)) {
    return NextResponse.json({ error: "notebook_limit", message: NOTEBOOK_LIMIT_MESSAGE }, { status: 409 });
  }
  return jsonError(message || "手帳をクラウドへ保存できませんでした。", 500);
}

export async function POST(request: NextRequest) {
  const authorized = await authorize(request);
  if ("error" in authorized) return authorized.error;

  const { supabase, user } = authorized;
  const body = asRecord(await request.json().catch(() => ({})));
  const localCasesById = new Map<string, LocalCase>();
  asArray<LocalCase>(body.cases).forEach((localCase) => {
    const id = safeText(localCase?.id);
    if (id) localCasesById.set(id, localCase);
  });
  const localCases = [...localCasesById.values()];
  const diaryEntriesById = new Map<string, LocalDiaryEntry>();
  asArray<LocalDiaryEntry>(body.diaryEntries).forEach((entry) => {
    const caseId = safeText(entry?.caseId);
    const id = safeText(entry?.id);
    if (caseId && id) diaryEntriesById.set(`${caseId}:${id}`, entry);
  });
  const diaryEntries = [...diaryEntriesById.values()];
  if (diaryEntries.length > NOTEBOOK_SYNC_MAX_ENTRIES_PER_REQUEST) {
    return jsonError(`1回に保存できる記録は${NOTEBOOK_SYNC_MAX_ENTRIES_PER_REQUEST}件までです。記録を分けて送ってください。`, 413);
  }

  const familyId = safeText(body.familyId) || null;
  const createFamily = body.createFamily === true;
  if (!familyId && !createFamily) {
    return NextResponse.json({ error: "family_selection_required", message: "保存先の家族を選んでください。" }, { status: 409 });
  }

  let allowedNotebookPhotoUserIds = new Set<string>([user.id]);
  if (familyId) {
    try {
      const families = await notebookFamiliesForUser(supabase, user.id);
      if (!families.some((family) => family.id === familyId)) {
        return NextResponse.json({ error: "family_access_denied", message: "この家族の手帳を変更する権限がありません。" }, { status: 403 });
      }
      allowedNotebookPhotoUserIds = await notebookPhotoOwnerIdsForFamilies(supabase, [familyId]);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "保存権限を確認できませんでした。", 500);
    }
  }

  const now = new Date().toISOString();
  const normalizedCases = localCases.map((localCase) => normalizedNotebookCase(localCase, now));
  const knownCaseIds = new Set(normalizedCases.map((localCase) => localCase.localCaseId));
  if (diaryEntries.some((entry) => !knownCaseIds.has(safeText(entry.caseId)))) {
    return jsonError("記録の対象者を確認できませんでした。", 400);
  }
  const normalizedDiaryEntries = diaryEntries.map((entry) => normalizedNotebookDiary(entry, allowedNotebookPhotoUserIds, now));
  const requestId = safeText(body.requestId);

  const { data, error } = await supabase.rpc("sync_notebook_v2", {
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
    p_family_id: familyId,
    p_create_family: createFamily,
    p_cases: normalizedCases,
    p_diary_entries: normalizedDiaryEntries,
    p_request_id: requestId || globalThis.crypto.randomUUID()
  });
  if (error) return notebookRpcErrorResponse(error);

  const result = asRecord(data);
  return NextResponse.json({ ok: true, ...result });
}
