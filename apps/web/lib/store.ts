"use client";

import { trackFunnel } from "@/lib/funnel";
import { japanDateInputValue } from "@/lib/date";
import { ANONYMOUS_CASE_TOKEN_PATTERN } from "@/lib/caseOwnership";
import {
  buildDiagnosisResult,
  canCreateNotebook,
  createHandoffToken,
  NOTEBOOK_LIMIT_MESSAGE,
  SENSITIVE_INFO_CONSENT_VERSION,
  statusLabel,
  type FamilyPlan,
  type DiagnosisAnswers,
  type DiagnosisResult,
  type ParentStatus
} from "@oyano/shared";

export type TaskProgress = "todo" | "doing" | "done" | "skipped";

export type EditableTask = DiagnosisResult["tasks"][number] & {
  id?: string;
  progress?: TaskProgress;
  assignee?: string;
  note?: string;
  updatedAt?: string;
  cloudRevision?: number;
  cloudHash?: string;
  cloudSyncedUpdatedAt?: string;
};

export type LocalDiagnosisResult = Omit<DiagnosisResult, "tasks"> & {
  tasks: EditableTask[];
};

export type CaseRecord = {
  id: string;
  selectedStatus: ParentStatus;
  answers: Partial<DiagnosisAnswers>;
  personProfile?: PersonProfile;
  contactName?: string;
  contactEmail?: string;
  status: "draft" | "submitted" | "result_ready" | "converted";
  createdAt: string;
  result?: LocalDiagnosisResult;
  handoffToken?: string;
  supportPackStatus?: "none" | "requested" | "paid" | "reviewing" | "report_ready";
  updatedAt?: string;
  cloudPersonId?: string;
  cloudRevision?: number;
  cloudHash?: string;
  cloudSyncedUpdatedAt?: string;
};

export type PersonProfile = {
  fullName?: string;
  displayName?: string;
  relationship?: string;
  birthDate?: string;
  parentPrefecture?: string;
  parentCity?: string;
  userPrefecture?: string;
  careStatus?: string;
  keyContact?: string;
  hospitalOrFacility?: string;
  medicationNote?: string;
  documentLocationNote?: string;
  familyStructureNote?: string;
  emergencyContact?: string;
  carePreference?: string;
  importantPeopleNote?: string;
  updatedAt?: string;
};

export type DiaryAttachment = {
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

export type DiaryEntry = {
  id: string;
  caseId: string;
  date: string;
  mood: "stable" | "changed" | "urgent";
  body: string;
  attachments: DiaryAttachment[];
  createdAt: string;
  updatedAt?: string;
  cloudRevision?: number;
  cloudHash?: string;
  cloudSyncedUpdatedAt?: string;
};

export type NotebookCloudBinding = {
  version: 1;
  authUserId: string;
  familyId: string | null;
  email?: string;
};

export type NotebookExport = {
  version: 1;
  exportedAt: string;
  cases: CaseRecord[];
  diaryEntries: DiaryEntry[];
};

const STORAGE_KEY = "oyano_cases_v03";
const PLAN_STORAGE_KEY = "oyano_plan_v01";
const FAMILY_BILLING_MANAGER_STORAGE_KEY = "oyano_family_billing_manager_v01";
const DIARY_STORAGE_NAME = "oyano_diary_entries_v01";
const NOTEBOOK_CLOUD_BINDING_STORAGE_KEY = "oyano_notebook_cloud_binding_v01";
const NOTEBOOK_RECONCILIATION_ARCHIVE_KEY = "oyano_notebook_reconciliation_archive_v01";
const PERSON_NOTEBOOK_DELETION_STORAGE_KEY = "oyano_person_notebook_deletions_v01";
const DIARY_ENTRY_DELETION_STORAGE_KEY = "oyano_diary_entry_deletions_v01";
let memoryCases: CaseRecord[] = [];
let memoryDiaryEntries: DiaryEntry[] = [];
let lastNotebookStorageWarning: string | null = null;

export type PersonNotebookDeletionTombstone = {
  version: 1;
  familyId: string;
  personId: string;
  localCaseId: string;
  cloudRevision: number;
  cloudHash: string;
  status: "pending" | "deleted";
  preparedAt: string;
  deletedAt?: string;
};

export type DiaryEntryDeletionTombstone = {
  version: 1;
  familyId: string;
  personId: string;
  localCaseId: string;
  localDiaryId: string;
  cloudRevision: number | null;
  cloudHash: string | null;
  status: "pending" | "deleted";
  preparedAt: string;
  deletedAt?: string;
};

function storageWarningMessage() {
  return "端末内の保存容量が足りず、今回の変更を端末に残せていない可能性があります。写真を減らすか、クラウド保存を設定してからもう一度保存してください。";
}

export function consumeNotebookStorageWarning(): string | null {
  const message = lastNotebookStorageWarning;
  lastNotebookStorageWarning = null;
  return message;
}

export function createLocalId(prefix = "local"): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getReadableLocalStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function getLocalStorage(): Storage | null {
  const storage = getReadableLocalStorage();
  if (!storage) return null;
  try {
    const probeKey = "__oyano_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function readCases(): CaseRecord[] {
  const storage = getReadableLocalStorage();
  if (!storage) return memoryCases;

  try {
    const archive = reconciliationArchiveFromStorage(storage);
    if (archive?.status === "installing") return archive.source.cases;
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as CaseRecord[] : [];
  } catch {
    return memoryCases;
  }
}

function writeCases(cases: CaseRecord[]): boolean {
  if (reconciliationInstallInProgress()) {
    lastNotebookStorageWarning = "手帳をまとめる途中で端末保存が止まりました。控えは残っています。保存先からもう一度確認してください。";
    return false;
  }
  memoryCases = [...cases];
  const storage = getLocalStorage();
  if (!storage) {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(cases));
    lastNotebookStorageWarning = null;
    return true;
  } catch {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
}

export function listLocalCases(): CaseRecord[] {
  const deletedIds = new Set(readPersonNotebookDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => item.localCaseId));
  return readCases()
    .filter((item) => !deletedIds.has(item.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLocalCase(caseId: string): CaseRecord | undefined {
  if (personDeletionTombstone(caseId)?.status === "deleted") return undefined;
  return readCases().find((item) => item.id === caseId);
}

function readDiaryEntries(): DiaryEntry[] {
  const storage = getReadableLocalStorage();
  if (!storage) return memoryDiaryEntries;

  try {
    const archive = reconciliationArchiveFromStorage(storage);
    if (archive?.status === "installing") return archive.source.diaryEntries;
    const raw = storage.getItem(DIARY_STORAGE_NAME);
    return raw ? JSON.parse(raw) as DiaryEntry[] : [];
  } catch {
    return memoryDiaryEntries;
  }
}

function attachmentForNotebookStorage(attachment: DiaryAttachment): DiaryAttachment {
  if (!attachment.storageBucket || !attachment.storagePath || !attachment.previewUrl) {
    return attachment;
  }

  const { previewUrl: _previewUrl, ...storedAttachment } = attachment;
  return storedAttachment;
}

function diaryEntryForNotebookStorage(entry: DiaryEntry): DiaryEntry {
  if (entry.attachments.length === 0) return entry;

  return {
    ...entry,
    attachments: entry.attachments.map(attachmentForNotebookStorage)
  };
}

function writeDiaryEntries(entries: DiaryEntry[]): boolean {
  if (reconciliationInstallInProgress()) {
    lastNotebookStorageWarning = "手帳をまとめる途中で端末保存が止まりました。控えは残っています。保存先からもう一度確認してください。";
    return false;
  }
  memoryDiaryEntries = [...entries];
  const storage = getLocalStorage();
  if (!storage) {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }

  try {
    storage.setItem(DIARY_STORAGE_NAME, JSON.stringify(entries.map(diaryEntryForNotebookStorage)));
    lastNotebookStorageWarning = null;
    return true;
  } catch {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
}

function readDiaryEntryDeletionTombstones(): DiaryEntryDeletionTombstone[] {
  const storage = getReadableLocalStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(DIARY_ENTRY_DELETION_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DiaryEntryDeletionTombstone => {
      if (!item || typeof item !== "object") return false;
      const row = item as Partial<DiaryEntryDeletionTombstone>;
      const hasCloudIdentity = Number.isInteger(row.cloudRevision)
        && Number(row.cloudRevision) >= 1
        && typeof row.cloudHash === "string"
        && /^[0-9a-f]{64}$/i.test(row.cloudHash);
      const hasNoCloudIdentity = row.cloudRevision === null && row.cloudHash === null;
      return row.version === 1
        && typeof row.familyId === "string" && Boolean(row.familyId)
        && typeof row.personId === "string" && Boolean(row.personId)
        && typeof row.localCaseId === "string" && Boolean(row.localCaseId)
        && typeof row.localDiaryId === "string" && Boolean(row.localDiaryId)
        && (hasCloudIdentity || hasNoCloudIdentity)
        && (row.status === "pending" || row.status === "deleted")
        && typeof row.preparedAt === "string";
    });
  } catch {
    return [];
  }
}

function writeDiaryEntryDeletionTombstones(tombstones: DiaryEntryDeletionTombstone[]) {
  const storage = getLocalStorage();
  if (!storage) {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
  try {
    storage.setItem(DIARY_ENTRY_DELETION_STORAGE_KEY, JSON.stringify(tombstones));
    lastNotebookStorageWarning = null;
    return true;
  } catch {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
}

function diaryEntryDeletionTombstone(localCaseId: string, localDiaryId: string) {
  return readDiaryEntryDeletionTombstones().find((item) => (
    item.localCaseId === localCaseId && item.localDiaryId === localDiaryId
  ));
}

export function isDiaryEntryCloudSyncBlocked(localCaseId: string, localDiaryId: string) {
  return Boolean(diaryEntryDeletionTombstone(localCaseId, localDiaryId));
}

export function prepareDiaryEntryLocalDeletion(input: {
  familyId: string;
  personId: string;
  localCaseId: string;
  localDiaryId: string;
  cloudRevision: number | null;
  cloudHash: string | null;
}) {
  const current = readDiaryEntryDeletionTombstones();
  const existing = diaryEntryDeletionTombstone(input.localCaseId, input.localDiaryId);
  if (existing) {
    return existing.familyId === input.familyId
      && existing.personId === input.personId
      && existing.cloudRevision === input.cloudRevision
      && existing.cloudHash === input.cloudHash;
  }
  return writeDiaryEntryDeletionTombstones([{
    version: 1,
    ...input,
    status: "pending",
    preparedAt: new Date().toISOString()
  }, ...current]);
}

export function clearPendingDiaryEntryLocalDeletion(input: {
  familyId: string;
  personId: string;
  localCaseId: string;
  localDiaryId: string;
}) {
  const current = readDiaryEntryDeletionTombstones();
  const existing = diaryEntryDeletionTombstone(input.localCaseId, input.localDiaryId);
  if (!existing) return true;
  if (existing.status !== "pending"
      || existing.familyId !== input.familyId
      || existing.personId !== input.personId) return false;
  return writeDiaryEntryDeletionTombstones(current.filter((item) => (
    item.localCaseId !== input.localCaseId || item.localDiaryId !== input.localDiaryId
  )));
}

export function completeDiaryEntryLocalDeletion(input: {
  familyId: string;
  personId: string;
  localCaseId: string;
  localDiaryId: string;
  cloudRevision: number | null;
  cloudHash: string | null;
}): DiaryEntryDeleteResult {
  const current = readDiaryEntryDeletionTombstones();
  const existing = diaryEntryDeletionTombstone(input.localCaseId, input.localDiaryId);
  if (!existing
      || existing.familyId !== input.familyId
      || existing.personId !== input.personId
      || existing.cloudRevision !== input.cloudRevision
      || existing.cloudHash !== input.cloudHash) {
    return { deleted: false, persisted: false };
  }
  const tombstones = current.map((item) => (
    item.localCaseId === input.localCaseId && item.localDiaryId === input.localDiaryId
      ? { ...item, status: "deleted" as const, deletedAt: item.deletedAt ?? new Date().toISOString() }
      : item
  ));
  if (!writeDiaryEntryDeletionTombstones(tombstones)) return { deleted: false, persisted: false };

  const entries = readDiaryEntries();
  const entry = entries.find((item) => item.caseId === input.localCaseId && item.id === input.localDiaryId);
  const persisted = writeDiaryEntries(entries.filter((item) => (
    item.caseId !== input.localCaseId || item.id !== input.localDiaryId
  )));
  return { entry, deleted: true, persisted };
}

export function retryCompletedDiaryEntryLocalDeletions() {
  const deletedKeys = new Set(readDiaryEntryDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => `${item.localCaseId}:${item.localDiaryId}`));
  if (deletedKeys.size === 0) return true;
  return writeDiaryEntries(readDiaryEntries().filter((item) => !deletedKeys.has(`${item.caseId}:${item.id}`)));
}

function readPersonNotebookDeletionTombstones(): PersonNotebookDeletionTombstone[] {
  const storage = getReadableLocalStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PERSON_NOTEBOOK_DELETION_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PersonNotebookDeletionTombstone => {
      if (!item || typeof item !== "object") return false;
      const row = item as Partial<PersonNotebookDeletionTombstone>;
      return row.version === 1
        && typeof row.familyId === "string" && Boolean(row.familyId)
        && typeof row.personId === "string" && Boolean(row.personId)
        && typeof row.localCaseId === "string" && Boolean(row.localCaseId)
        && Number.isInteger(row.cloudRevision) && Number(row.cloudRevision) >= 1
        && typeof row.cloudHash === "string" && /^[0-9a-f]{64}$/i.test(row.cloudHash)
        && (row.status === "pending" || row.status === "deleted")
        && typeof row.preparedAt === "string";
    });
  } catch {
    return [];
  }
}

function writePersonNotebookDeletionTombstones(tombstones: PersonNotebookDeletionTombstone[]) {
  const storage = getLocalStorage();
  if (!storage) {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
  try {
    storage.setItem(PERSON_NOTEBOOK_DELETION_STORAGE_KEY, JSON.stringify(tombstones));
    lastNotebookStorageWarning = null;
    return true;
  } catch {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
}

function personDeletionTombstone(localCaseId: string) {
  return readPersonNotebookDeletionTombstones().find((item) => item.localCaseId === localCaseId);
}

export function isPersonNotebookCloudSyncBlocked(localCaseId: string) {
  return Boolean(personDeletionTombstone(localCaseId));
}

export function preparePersonNotebookLocalDeletion(input: {
  familyId: string;
  personId: string;
  localCaseId: string;
  cloudRevision: number;
  cloudHash: string;
}) {
  const current = readPersonNotebookDeletionTombstones();
  const existing = current.find((item) => item.localCaseId === input.localCaseId);
  if (existing) {
    return existing.familyId === input.familyId
      && existing.personId === input.personId
      && existing.cloudRevision === input.cloudRevision
      && existing.cloudHash === input.cloudHash;
  }
  return writePersonNotebookDeletionTombstones([{
    version: 1,
    ...input,
    status: "pending",
    preparedAt: new Date().toISOString()
  }, ...current]);
}

export function clearPendingPersonNotebookLocalDeletion(input: {
  familyId: string;
  personId: string;
  localCaseId: string;
}) {
  const current = readPersonNotebookDeletionTombstones();
  const existing = current.find((item) => item.localCaseId === input.localCaseId);
  if (!existing) return true;
  if (existing.status !== "pending"
      || existing.familyId !== input.familyId
      || existing.personId !== input.personId) return false;
  return writePersonNotebookDeletionTombstones(
    current.filter((item) => item.localCaseId !== input.localCaseId)
  );
}

export function completePersonNotebookLocalDeletion(input: {
  familyId: string;
  personId: string;
  localCaseId: string;
  cloudRevision: number;
  cloudHash: string;
}) {
  const current = readPersonNotebookDeletionTombstones();
  const existing = current.find((item) => item.localCaseId === input.localCaseId);
  if (!existing
      || existing.familyId !== input.familyId
      || existing.personId !== input.personId
      || existing.cloudRevision !== input.cloudRevision
      || existing.cloudHash !== input.cloudHash) {
    return { persisted: false, deleted: false };
  }
  const tombstones = current.map((item) => item.localCaseId === input.localCaseId
    ? { ...item, status: "deleted" as const, deletedAt: item.deletedAt ?? new Date().toISOString() }
    : item);
  // Persist the server-confirmed tombstone first. If either legacy storage key
  // cannot be compacted, future restores and auto-sync still cannot resurrect
  // or expose this notebook; the cleanup is retried on the next page load.
  if (!writePersonNotebookDeletionTombstones(tombstones)) return { persisted: false, deleted: false };
  if (!removeReconciliationArchiveForDeletedCases(new Set([input.localCaseId]))) return { persisted: false, deleted: true };
  const casesPersisted = writeCases(readCases().filter((item) => item.id !== input.localCaseId));
  const diaryPersisted = writeDiaryEntries(readDiaryEntries().filter((item) => item.caseId !== input.localCaseId));
  return { persisted: casesPersisted && diaryPersisted, deleted: true };
}

export function retryCompletedPersonNotebookLocalDeletions() {
  const deletedIds = new Set(readPersonNotebookDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => item.localCaseId));
  if (deletedIds.size === 0) return true;
  if (!removeReconciliationArchiveForDeletedCases(deletedIds)) return false;
  const casesPersisted = writeCases(readCases().filter((item) => !deletedIds.has(item.id)));
  const diaryPersisted = writeDiaryEntries(readDiaryEntries().filter((item) => !deletedIds.has(item.caseId)));
  return casesPersisted && diaryPersisted;
}

export function readNotebookCloudBinding(): NotebookCloudBinding | null {
  const storage = getReadableLocalStorage();
  if (!storage) return null;

  try {
    const archive = reconciliationArchiveFromStorage(storage);
    if (archive?.status === "installing") return archive.originalBinding;
    const parsed = JSON.parse(storage.getItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY) ?? "null") as Partial<NotebookCloudBinding> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.authUserId !== "string" || !parsed.authUserId) return null;
    return {
      version: 1,
      authUserId: parsed.authUserId,
      familyId: typeof parsed.familyId === "string" && parsed.familyId ? parsed.familyId : null,
      ...(typeof parsed.email === "string" && parsed.email ? { email: parsed.email } : {})
    };
  } catch {
    return null;
  }
}

export function writeNotebookCloudBinding(binding: NotebookCloudBinding): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  if (reconciliationArchiveFromStorage(storage)?.status === "installing") return false;
  try {
    storage.setItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY, JSON.stringify(binding));
    return true;
  } catch {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
}

export function notebookCloudBindingMatches(
  binding: NotebookCloudBinding | null,
  authUserId: string | null,
  familyId: string | null
) {
  return Boolean(
    binding
    && authUserId
    && binding.authUserId === authUserId
    && binding.familyId === familyId
  );
}

export function clearNotebookCloudBinding() {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY);
  } catch {
    // A blocked storage API is already handled by the identity guard in the UI.
  }
}

export function listDiaryEntries(caseId: string): DiaryEntry[] {
  if (personDeletionTombstone(caseId)?.status === "deleted") return [];
  const deletedDiaryIds = new Set(readDiaryEntryDeletionTombstones()
    .filter((item) => item.localCaseId === caseId && item.status === "deleted")
    .map((item) => item.localDiaryId));
  return readDiaryEntries()
    .filter((item) => item.caseId === caseId && !deletedDiaryIds.has(item.id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function exportNotebookData(): NotebookExport {
  const cases = listLocalCases();
  const visibleCaseIds = new Set(cases.map((item) => item.id));
  const deletedDiaryKeys = new Set(readDiaryEntryDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => `${item.localCaseId}:${item.localDiaryId}`));
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    cases,
    diaryEntries: readDiaryEntries().filter((entry) => (
      visibleCaseIds.has(entry.caseId) && !deletedDiaryKeys.has(`${entry.caseId}:${entry.id}`)
    ))
  };
}

export type NotebookReconciliationArchive = {
  version: 1;
  status: "prepared" | "installing" | "complete";
  source: NotebookExport;
  originalBinding: NotebookCloudBinding | null;
  destination: NotebookCloudBinding;
  targetCaseId?: string;
};

function removeReconciliationArchiveForDeletedCases(deletedIds: Set<string>) {
  const storage = getReadableLocalStorage();
  if (!storage) return false;
  const archive = reconciliationArchiveFromStorage(storage);
  if (!archive || !(archive.targetCaseId && deletedIds.has(archive.targetCaseId))
      && !archive.source.cases.some((item) => deletedIds.has(item.id))) return true;
  try {
    if (archive.status === "installing") {
      // A target deletion may arrive after its binding key was written but
      // before the commit marker. Roll back ALL keys before removing the
      // journal; a quota/removal error keeps original reads and binding active.
      storage.setItem(STORAGE_KEY, JSON.stringify(archive.source.cases.filter((item) => !deletedIds.has(item.id))));
      storage.setItem(DIARY_STORAGE_NAME, JSON.stringify(archive.source.diaryEntries.filter((item) => !deletedIds.has(item.caseId))));
      if (archive.originalBinding) storage.setItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY, JSON.stringify(archive.originalBinding));
      else storage.removeItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY);
    }
    storage.removeItem(NOTEBOOK_RECONCILIATION_ARCHIVE_KEY);
    return true;
  } catch { return false; }
}

function reconciliationInstallInProgress() {
  const storage = getReadableLocalStorage();
  return Boolean(storage && reconciliationArchiveFromStorage(storage)?.status === "installing");
}

function reconciliationArchiveFromStorage(storage: Storage): NotebookReconciliationArchive | null {
  try {
    const value = JSON.parse(storage.getItem(NOTEBOOK_RECONCILIATION_ARCHIVE_KEY) ?? "null") as NotebookReconciliationArchive | null;
    return value?.version === 1 && ["prepared", "installing", "complete"].includes(value.status)
      && Array.isArray(value.source?.cases) && Array.isArray(value.source?.diaryEntries)
      && Boolean(value.destination?.authUserId) ? value : null;
  } catch {
    return null;
  }
}

export function readNotebookReconciliationArchive() {
  const storage = getReadableLocalStorage();
  const archive = storage ? reconciliationArchiveFromStorage(storage) : null;
  if (!archive) return null;
  const relatedCases = new Set(archive.source.cases.map((item) => item.id));
  if (archive.targetCaseId) relatedCases.add(archive.targetCaseId);
  // A failed storage cleanup must not make a deleted notebook downloadable.
  if (readPersonNotebookDeletionTombstones().some((item) => relatedCases.has(item.localCaseId))) return null;
  if (readDiaryEntryDeletionTombstones().some((item) => relatedCases.has(item.localCaseId))) return null;
  return archive;
}

function reconciliationSourceUnchanged(source: NotebookExport) {
  const current = exportNotebookData();
  return JSON.stringify(current.cases) === JSON.stringify(source.cases)
    && JSON.stringify(current.diaryEntries) === JSON.stringify(source.diaryEntries);
}

// Persist the entire original (including profile/tasks) before any cloud POST.
// An interrupted multi-key install reads from this archive, never a half-written
// mixture. The final single-key status change is the local commit point.
export function archiveNotebookForReconciliation(source: NotebookExport, destination: NotebookCloudBinding) {
  const storage = getLocalStorage();
  if (!storage || !reconciliationSourceUnchanged(source)) return false;
  const previous = reconciliationArchiveFromStorage(storage);
  if (previous && (previous.source.cases[0]?.id !== source.cases[0]?.id
      || previous.destination.authUserId !== destination.authUserId
      || previous.destination.familyId !== destination.familyId)) return false;
  const originalBinding = readNotebookCloudBinding();
  if (originalBinding && (originalBinding.authUserId !== destination.authUserId
      || (originalBinding.familyId && originalBinding.familyId !== destination.familyId))) return false;
  try {
    if (previous?.status === "installing") {
      storage.setItem(STORAGE_KEY, JSON.stringify(previous.source.cases));
      storage.setItem(DIARY_STORAGE_NAME, JSON.stringify(previous.source.diaryEntries));
      if (previous.originalBinding) storage.setItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY, JSON.stringify(previous.originalBinding));
      else storage.removeItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY);
    }
    const archive: NotebookReconciliationArchive = { version: 1, status: "prepared", source, originalBinding, destination };
    storage.setItem(NOTEBOOK_RECONCILIATION_ARCHIVE_KEY, JSON.stringify(archive));
    return true;
  } catch {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
}

export function installReconciledNotebook(input: {
  source: NotebookExport;
  destination: NotebookCloudBinding;
  notebook: { cases: CaseRecord[]; diaryEntries: DiaryEntry[] };
}) {
  const storage = getLocalStorage();
  const archive = storage && reconciliationArchiveFromStorage(storage);
  if (!storage || !archive || !reconciliationSourceUnchanged(input.source)
      || archive.destination.authUserId !== input.destination.authUserId
      || archive.destination.familyId !== input.destination.familyId
      || JSON.stringify(archive.source.cases) !== JSON.stringify(input.source.cases)
      || JSON.stringify(archive.source.diaryEntries) !== JSON.stringify(input.source.diaryEntries)
      || input.notebook.cases.length !== 1
      || input.notebook.diaryEntries.some((entry) => entry.caseId !== input.notebook.cases[0].id)
      || input.notebook.cases.some((item) => isPersonNotebookCloudSyncBlocked(item.id))
      || input.notebook.diaryEntries.some((item) => isDiaryEntryCloudSyncBlocked(item.caseId, item.id))) return false;
  try {
    const installing = { ...archive, targetCaseId: input.notebook.cases[0].id, status: "installing" };
    storage.setItem(NOTEBOOK_RECONCILIATION_ARCHIVE_KEY, JSON.stringify(installing));
    storage.setItem(STORAGE_KEY, JSON.stringify(input.notebook.cases));
    storage.setItem(DIARY_STORAGE_NAME, JSON.stringify(input.notebook.diaryEntries.map(diaryEntryForNotebookStorage)));
    storage.setItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY, JSON.stringify(input.destination));
    storage.setItem(NOTEBOOK_RECONCILIATION_ARCHIVE_KEY, JSON.stringify({ ...installing, status: "complete" }));
    memoryCases = [...input.notebook.cases];
    memoryDiaryEntries = [...input.notebook.diaryEntries];
    return true;
  } catch {
    lastNotebookStorageWarning = storageWarningMessage();
    return false;
  }
}

function diaryEntryTimestamp(entry: DiaryEntry) {
  const timestamp = Date.parse(entry.updatedAt || entry.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function caseRecordTimestamp(caseRecord: CaseRecord) {
  const timestamp = Date.parse(caseRecord.updatedAt || caseRecord.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export type NotebookMergeConflict = {
  kind: "profile" | "task" | "diary";
  id: string;
  caseId: string;
};

type CloudTrackedRecord = {
  cloudRevision?: number;
  cloudSyncedUpdatedAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

function cloudRevision(value: CloudTrackedRecord) {
  return Number.isInteger(value.cloudRevision) && Number(value.cloudRevision) >= 0
    ? Number(value.cloudRevision)
    : null;
}

function hasUnsyncedCloudChange(value: CloudTrackedRecord) {
  if (cloudRevision(value) === null || !value.cloudSyncedUpdatedAt) return false;
  return (value.updatedAt || value.createdAt || "") !== value.cloudSyncedUpdatedAt;
}

function chooseCloudTrackedRecord<T extends CloudTrackedRecord>(
  remote: T,
  local: T,
  onConflict: () => void,
  timestamp: (value: T) => number
): T {
  const remoteRevision = cloudRevision(remote);
  const localRevision = cloudRevision(local);

  if (remoteRevision !== null && localRevision !== null) {
    if (remoteRevision > localRevision) {
      if (hasUnsyncedCloudChange(local)) {
        onConflict();
        return local;
      }
      return remote;
    }
    if (localRevision > remoteRevision) {
      onConflict();
      return local;
    }
  } else if (remoteRevision !== localRevision) {
    // A legacy/unbound local record must never silently replace a revisioned
    // cloud record. Keep it visible and require an explicit resolution.
    onConflict();
    return local;
  }

  return timestamp(local) > timestamp(remote) ? local : remote;
}

function editableTaskTimestamp(task: EditableTask) {
  const timestamp = Date.parse(task.updatedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function canonicalNotebookValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalNotebookValue);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !key.startsWith("cloud") && key !== "previewUrl" && key !== "createdAt" && key !== "updatedAt")
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, nested]) => {
      output[key] = canonicalNotebookValue(nested);
    });
  return output;
}

function notebookValuesMatch(left: unknown, right: unknown) {
  return JSON.stringify(canonicalNotebookValue(left)) === JSON.stringify(canonicalNotebookValue(right));
}

function caseProfileSnapshot(caseRecord: CaseRecord) {
  return {
    selectedStatus: caseRecord.selectedStatus,
    answers: caseRecord.answers,
    personProfile: caseRecord.personProfile,
    summary: caseRecord.result?.summary
  };
}

export function canAdoptNotebookCloudIdentity(input: {
  remoteCases: CaseRecord[];
  localCases: CaseRecord[];
}) {
  if (input.localCases.length === 0 || input.remoteCases.length === 0) return false;
  const remoteById = new Map(input.remoteCases.map((item) => [item.id, item]));
  const overlapping = input.localCases.filter((item) => remoteById.has(item.id));
  return overlapping.length > 0 && overlapping.every((localCase) => {
    const remoteCase = remoteById.get(localCase.id);
    return Boolean(remoteCase && notebookValuesMatch(caseProfileSnapshot(remoteCase), caseProfileSnapshot(localCase)));
  });
}

function adoptMatchingCloudMetadata(
  remoteCases: CaseRecord[],
  localCases: CaseRecord[],
  remoteEntries: DiaryEntry[],
  localEntries: DiaryEntry[]
) {
  const remoteCaseById = new Map(remoteCases.map((item) => [item.id, item]));
  const nextLocalCases = localCases.map((localCase) => {
    const remoteCase = remoteCaseById.get(localCase.id);
    if (!remoteCase) return localCase;
    const remoteTasks = new Map((remoteCase.result?.tasks ?? []).map((task) => [task.id, task]));
    const tasks = localCase.result?.tasks.map((task) => {
      const remoteTask = remoteTasks.get(task.id);
      if (!remoteTask || !notebookValuesMatch(remoteTask, task)) return task;
      return {
        ...task,
        cloudRevision: remoteTask.cloudRevision,
        cloudHash: remoteTask.cloudHash,
        cloudSyncedUpdatedAt: task.updatedAt
      };
    });
    const profileMatches = notebookValuesMatch(caseProfileSnapshot(remoteCase), caseProfileSnapshot(localCase));
    return {
      ...localCase,
      ...(profileMatches ? {
        cloudPersonId: remoteCase.cloudPersonId,
        cloudRevision: remoteCase.cloudRevision,
        cloudHash: remoteCase.cloudHash,
        cloudSyncedUpdatedAt: localCase.updatedAt ?? localCase.createdAt
      } : {}),
      ...(tasks && localCase.result ? { result: { ...localCase.result, tasks } } : {})
    };
  });
  const remoteEntryById = new Map(remoteEntries.map((entry) => [`${entry.caseId}:${entry.id}`, entry]));
  const nextLocalEntries = localEntries.map((entry) => {
    const remoteEntry = remoteEntryById.get(`${entry.caseId}:${entry.id}`);
    if (!remoteEntry || !notebookValuesMatch(remoteEntry, entry)) return entry;
    return {
      ...entry,
      cloudRevision: remoteEntry.cloudRevision,
      cloudHash: remoteEntry.cloudHash,
      cloudSyncedUpdatedAt: entry.updatedAt ?? entry.createdAt
    };
  });
  return { localCases: nextLocalCases, localEntries: nextLocalEntries };
}

function mergeTasks(
  caseId: string,
  remoteTasks: EditableTask[],
  localTasks: EditableTask[],
  conflicts: NotebookMergeConflict[]
) {
  const merged = new Map<string, EditableTask>();
  remoteTasks.forEach((task, index) => merged.set(task.id || `remote-${index}`, task));
  localTasks.forEach((task, index) => {
    const id = task.id || `local-${index}`;
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, task);
      return;
    }
    merged.set(id, chooseCloudTrackedRecord(existing, task, () => {
      conflicts.push({ kind: "task", id, caseId });
    }, editableTaskTimestamp));
  });
  return [...merged.values()];
}

function mergeCaseRecords(
  remoteCases: CaseRecord[],
  localCases: CaseRecord[],
  conflicts: NotebookMergeConflict[]
) {
  const merged = new Map<string, CaseRecord>();

  remoteCases.forEach((caseRecord) => merged.set(caseRecord.id, caseRecord));
  localCases.forEach((caseRecord) => {
    const existing = merged.get(caseRecord.id);
    if (!existing) {
      merged.set(caseRecord.id, caseRecord);
      return;
    }

    const selected = chooseCloudTrackedRecord(existing, caseRecord, () => {
      conflicts.push({ kind: "profile", id: caseRecord.id, caseId: caseRecord.id });
    }, caseRecordTimestamp);
    const tasks = mergeTasks(
      caseRecord.id,
      existing.result?.tasks ?? [],
      caseRecord.result?.tasks ?? [],
      conflicts
    );
    merged.set(caseRecord.id, {
      ...selected,
      ...(selected.result ? { result: { ...selected.result, tasks } } : {})
    });
  });

  return Array.from(merged.values())
    .sort((a, b) => caseRecordTimestamp(b) - caseRecordTimestamp(a) || b.createdAt.localeCompare(a.createdAt));
}

function mergeDiaryEntries(
  remoteEntries: DiaryEntry[],
  localEntries: DiaryEntry[],
  conflicts: NotebookMergeConflict[]
) {
  const merged = new Map<string, DiaryEntry>();

  remoteEntries.forEach((entry) => merged.set(entry.id, entry));
  localEntries.forEach((entry) => {
    const existing = merged.get(entry.id);
    if (!existing) {
      merged.set(entry.id, entry);
      return;
    }
    merged.set(entry.id, chooseCloudTrackedRecord(existing, entry, () => {
      conflicts.push({ kind: "diary", id: entry.id, caseId: entry.caseId });
    }, diaryEntryTimestamp));
  });

  return Array.from(merged.values())
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function replaceLocalNotebook(input: { cases: CaseRecord[]; diaryEntries: DiaryEntry[] }) {
  const deletedIds = new Set(readPersonNotebookDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => item.localCaseId));
  const incomingCases = input.cases.filter((item) => !deletedIds.has(item.id));
  const deletedDiaryKeys = new Set(readDiaryEntryDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => `${item.localCaseId}:${item.localDiaryId}`));
  const incomingDiaryEntries = input.diaryEntries.filter((item) => (
    !deletedIds.has(item.caseId) && !deletedDiaryKeys.has(`${item.caseId}:${item.id}`)
  ));
  const localCases = readCases().filter((item) => !deletedIds.has(item.id));
  const localEntries = readDiaryEntries().filter((item) => (
    !deletedIds.has(item.caseId) && !deletedDiaryKeys.has(`${item.caseId}:${item.id}`)
  ));
  const conflicts: NotebookMergeConflict[] = [];
  const adopted = adoptMatchingCloudMetadata(incomingCases, localCases, incomingDiaryEntries, localEntries);
  const mergedCases = mergeCaseRecords(incomingCases, adopted.localCases, conflicts);
  const mergedDiaryEntries = mergeDiaryEntries(incomingDiaryEntries, adopted.localEntries, conflicts);

  const casesPersisted = writeCases(mergedCases);
  const diaryEntriesPersisted = writeDiaryEntries(mergedDiaryEntries);

  return {
    cases: mergedCases,
    diaryEntries: mergedDiaryEntries,
    conflicts,
    persisted: casesPersisted && diaryEntriesPersisted
  };
}

export function overwriteLocalNotebook(input: { cases: CaseRecord[]; diaryEntries: DiaryEntry[] }) {
  const deletedIds = new Set(readPersonNotebookDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => item.localCaseId));
  const cases = input.cases.filter((item) => !deletedIds.has(item.id));
  const deletedDiaryKeys = new Set(readDiaryEntryDeletionTombstones()
    .filter((item) => item.status === "deleted")
    .map((item) => `${item.localCaseId}:${item.localDiaryId}`));
  const diaryEntries = input.diaryEntries.filter((item) => (
    !deletedIds.has(item.caseId) && !deletedDiaryKeys.has(`${item.caseId}:${item.id}`)
  ));
  const casesPersisted = writeCases(cases);
  const diaryEntriesPersisted = writeDiaryEntries(diaryEntries);
  return {
    cases,
    diaryEntries,
    conflicts: [] as NotebookMergeConflict[],
    persisted: casesPersisted && diaryEntriesPersisted
  };
}

export type NotebookCloudRevisionResult = {
  caseRevisions?: Array<{
    localCaseId: string;
    personId?: string;
    cloudRevision: number;
    cloudHash?: string;
    profileApplied?: boolean;
  }>;
  taskRevisions?: Array<{ localCaseId: string; localTaskId: string; cloudRevision: number; cloudHash?: string }>;
  diaryRevisions?: Array<{ localCaseId: string; localDiaryId: string; cloudRevision: number; cloudHash?: string }>;
};

export function applyNotebookCloudRevisions(
  result: NotebookCloudRevisionResult,
  syncedSnapshot?: { cases: CaseRecord[]; diaryEntries: DiaryEntry[] }
) {
  const caseRevisionById = new Map((result.caseRevisions ?? []).map((item) => [item.localCaseId, item]));
  const taskRevisionById = new Map((result.taskRevisions ?? []).map((item) => [`${item.localCaseId}:${item.localTaskId}`, item]));
  const diaryRevisionById = new Map((result.diaryRevisions ?? []).map((item) => [`${item.localCaseId}:${item.localDiaryId}`, item]));
  const sentCaseById = new Map((syncedSnapshot?.cases ?? []).map((item) => [item.id, item]));
  const sentTaskById = new Map<string, EditableTask>();
  (syncedSnapshot?.cases ?? []).forEach((caseRecord) => {
    (caseRecord.result?.tasks ?? []).forEach((task) => {
      sentTaskById.set(`${caseRecord.id}:${task.id ?? ""}`, task);
    });
  });
  const sentDiaryById = new Map(
    (syncedSnapshot?.diaryEntries ?? []).map((entry) => [`${entry.caseId}:${entry.id}`, entry])
  );
  let hasConcurrentChanges = false;
  const rejectedProfileCaseIds: string[] = [];

  const nextCases = readCases().map((caseRecord) => {
    const revision = caseRevisionById.get(caseRecord.id);
    const sentCase = sentCaseById.get(caseRecord.id);
    if (syncedSnapshot && !sentCase) hasConcurrentChanges = true;
    const tasks = caseRecord.result?.tasks.map((task) => {
      const taskRevision = taskRevisionById.get(`${caseRecord.id}:${task.id ?? ""}`);
      const sentTask = sentTaskById.get(`${caseRecord.id}:${task.id ?? ""}`);
      if (syncedSnapshot && !sentTask) hasConcurrentChanges = true;
      if (!taskRevision) return task;
      const matchesSent = !sentTask || notebookValuesMatch(task, sentTask);
      if (!matchesSent) hasConcurrentChanges = true;
      return {
        ...task,
        cloudRevision: taskRevision.cloudRevision,
        cloudHash: taskRevision.cloudHash,
        cloudSyncedUpdatedAt: matchesSent
          ? task.updatedAt
          : sentTask?.updatedAt ?? task.cloudSyncedUpdatedAt
      };
    });
    const profileMatchesSent = !sentCase
      || notebookValuesMatch(caseProfileSnapshot(caseRecord), caseProfileSnapshot(sentCase));
    if (revision?.profileApplied === false) rejectedProfileCaseIds.push(caseRecord.id);
    else if (revision && !profileMatchesSent) hasConcurrentChanges = true;
    return {
      ...caseRecord,
      ...(revision ? { cloudPersonId: revision.personId ?? caseRecord.cloudPersonId } : {}),
      ...(revision && revision.profileApplied !== false ? {
        cloudRevision: revision.cloudRevision,
        cloudHash: revision.cloudHash,
        cloudSyncedUpdatedAt: profileMatchesSent
          ? caseRecord.updatedAt ?? caseRecord.createdAt
          : sentCase?.updatedAt ?? sentCase?.createdAt ?? caseRecord.cloudSyncedUpdatedAt
      } : {}),
      ...(tasks && caseRecord.result ? { result: { ...caseRecord.result, tasks } } : {})
    };
  });
  const nextDiaryEntries = readDiaryEntries().map((entry) => {
    const revision = diaryRevisionById.get(`${entry.caseId}:${entry.id}`);
    const sentEntry = sentDiaryById.get(`${entry.caseId}:${entry.id}`);
    if (syncedSnapshot && !sentEntry) hasConcurrentChanges = true;
    if (!revision) return entry;
    const matchesSent = !sentEntry || notebookValuesMatch(entry, sentEntry);
    if (!matchesSent) hasConcurrentChanges = true;
    return {
      ...entry,
      cloudRevision: revision.cloudRevision,
      cloudHash: revision.cloudHash,
      cloudSyncedUpdatedAt: matchesSent
        ? entry.updatedAt ?? entry.createdAt
        : sentEntry?.updatedAt ?? sentEntry?.createdAt ?? entry.cloudSyncedUpdatedAt
    };
  });

  const casesPersisted = writeCases(nextCases);
  const diaryEntriesPersisted = writeDiaryEntries(nextDiaryEntries);
  return {
    cases: nextCases,
    diaryEntries: nextDiaryEntries,
    persisted: casesPersisted && diaryEntriesPersisted,
    hasConcurrentChanges,
    rejectedProfileCaseIds
  };
}

export function resetLocalNotebookData() {
  memoryCases = [];
  memoryDiaryEntries = [];

  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(DIARY_STORAGE_NAME);
    storage.removeItem(PLAN_STORAGE_KEY);
    storage.removeItem(NOTEBOOK_CLOUD_BINDING_STORAGE_KEY);
    storage.removeItem(PERSON_NOTEBOOK_DELETION_STORAGE_KEY);
    storage.removeItem(DIARY_ENTRY_DELETION_STORAGE_KEY);
    storage.removeItem(NOTEBOOK_RECONCILIATION_ARCHIVE_KEY);
  } catch {
    // If storage removal is blocked, the in-memory state above still gives
    // the current session a fresh start.
  }
}

export type DiaryEntryWriteResult = {
  entry: DiaryEntry;
  persisted: boolean;
};

export function addDiaryEntryWithStatus(input: Omit<DiaryEntry, "id" | "createdAt">): DiaryEntryWriteResult {
  const now = new Date().toISOString();
  const entry: DiaryEntry = {
    ...input,
    id: createLocalId("diary"),
    createdAt: now,
    updatedAt: now
  };
  const existingEntries = readDiaryEntries();
  const persisted = writeDiaryEntries([entry, ...existingEntries]);
  if (!persisted) memoryDiaryEntries = existingEntries;
  if (persisted) trackFunnel("record_written");
  return { entry, persisted };
}

export function addDiaryEntry(input: Omit<DiaryEntry, "id" | "createdAt">): DiaryEntry {
  return addDiaryEntryWithStatus(input).entry;
}

export function updateDiaryEntry(entryId: string, patch: Partial<Omit<DiaryEntry, "id" | "caseId" | "createdAt">>): DiaryEntryWriteResult | undefined {
  const entries = readDiaryEntries();
  const existing = entries.find((item) => item.id === entryId);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const updated: DiaryEntry = {
    ...existing,
    ...patch,
    date: normalizedTaskText(patch.date, existing.date) ?? existing.date,
    body: normalizedTaskText(patch.body, existing.body) ?? existing.body,
    mood: patch.mood === "urgent" || patch.mood === "changed" || patch.mood === "stable" ? patch.mood : existing.mood,
    attachments: Array.isArray(patch.attachments) ? patch.attachments : existing.attachments,
    updatedAt: now
  };

  const persisted = writeDiaryEntries([updated, ...entries.filter((item) => item.id !== entryId)]);
  if (!persisted) memoryDiaryEntries = entries;
  return { entry: updated, persisted };
}

export type DiaryEntryDeleteResult = {
  entry?: DiaryEntry;
  deleted: boolean;
  persisted: boolean;
};

export function deleteDiaryEntryWithStatus(input: {
  caseId: string;
  entryId: string;
}): DiaryEntryDeleteResult {
  const entries = readDiaryEntries();
  const existing = entries.find((item) => item.caseId === input.caseId && item.id === input.entryId);
  if (!existing) return { deleted: false, persisted: true };

  const nextEntries = entries.filter((item) => item.caseId !== input.caseId || item.id !== input.entryId);
  const persisted = writeDiaryEntries(nextEntries);
  if (!persisted) memoryDiaryEntries = entries;
  return { entry: existing, deleted: persisted, persisted };
}

export type CaseProfileWriteResult = {
  record?: CaseRecord;
  persisted: boolean;
};

export function updateCaseProfileWithStatus(caseId: string, patch: Partial<PersonProfile>): CaseProfileWriteResult {
  const cases = readCases();
  const existing = cases.find((item) => item.id === caseId);
  if (!existing) return { persisted: false };

  const now = new Date().toISOString();
  const record: CaseRecord = {
    ...existing,
    updatedAt: now,
    personProfile: {
      ...(existing.personProfile ?? {}),
      ...patch,
      updatedAt: now
    }
  };

  const persisted = writeCases([record, ...cases.filter((item) => item.id !== caseId)]);
  if (!persisted) memoryCases = cases;
  return { record, persisted };
}

export function updateCaseProfile(caseId: string, patch: Partial<PersonProfile>): CaseRecord | undefined {
  return updateCaseProfileWithStatus(caseId, patch).record;
}

function normalizeTaskProgress(value: unknown): TaskProgress {
  return value === "doing" || value === "done" || value === "skipped" ? value : "todo";
}

function normalizeTaskPriority(value: unknown): 1 | 2 | 3 {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 2;
  if (numeric <= 1) return 1;
  if (numeric >= 3) return 3;
  return 2;
}

function normalizedTaskText(value: unknown, fallback?: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export function updateCaseTask(caseId: string, taskIndex: number, patch: Partial<EditableTask>): CaseRecord | undefined {
  const cases = readCases();
  const existing = cases.find((item) => item.id === caseId);
  if (!existing?.result || taskIndex < 0 || taskIndex >= existing.result.tasks.length) return undefined;

  const now = new Date().toISOString();
  const tasks = existing.result.tasks.map((task, index) => {
    if (index !== taskIndex) return task;

    const nextTask: EditableTask = {
      ...task,
      ...patch,
      id: task.id ?? patch.id ?? createLocalId("task"),
      title: normalizedTaskText(patch.title, task.title) ?? "確認すること",
      description: normalizedTaskText(patch.description, task.description) ?? "",
      dueDate: normalizedTaskText(patch.dueDate, task.dueDate) ?? todayDate(),
      priority: normalizeTaskPriority(patch.priority ?? task.priority),
      progress: normalizeTaskProgress(patch.progress ?? task.progress),
      updatedAt: now
    };

    if (Object.prototype.hasOwnProperty.call(patch, "assignee")) {
      nextTask.assignee = normalizedTaskText(patch.assignee);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "note")) {
      nextTask.note = normalizedTaskText(patch.note);
    }

    return nextTask;
  });

  const record: CaseRecord = {
    ...existing,
    result: {
      ...existing.result,
      tasks
    }
  };

  writeCases([record, ...cases.filter((item) => item.id !== caseId)]);
  return record;
}

export function addCaseTask(caseId: string, task: Partial<EditableTask> & Pick<EditableTask, "title">): CaseRecord | undefined {
  const cases = readCases();
  const existing = cases.find((item) => item.id === caseId);
  if (!existing?.result) return undefined;

  const now = new Date().toISOString();
  const nextTask: EditableTask = {
    status: existing.selectedStatus,
    title: normalizedTaskText(task.title, "確認すること") ?? "確認すること",
    description: normalizedTaskText(task.description, "") ?? "",
    defaultDueOffsetDays: 0,
    dueDate: normalizedTaskText(task.dueDate, todayDate()) ?? todayDate(),
    priority: normalizeTaskPriority(task.priority),
    category: normalizedTaskText(task.category, "diary") ?? "diary",
    progress: normalizeTaskProgress(task.progress),
    assignee: normalizedTaskText(task.assignee),
    note: normalizedTaskText(task.note),
    id: task.id ?? createLocalId("task"),
    updatedAt: now
  };

  const record: CaseRecord = {
    ...existing,
    result: {
      ...existing.result,
      tasks: [nextTask, ...existing.result.tasks]
    }
  };

  writeCases([record, ...cases.filter((item) => item.id !== caseId)]);
  return record;
}

function todayDate() {
  return japanDateInputValue();
}

export function diaryAdvice(entry: Pick<DiaryEntry, "body" | "mood">): string[] {
  const text = entry.body;
  const advice = new Set<string>();

  if (entry.mood === "urgent") {
    advice.add("急な変化がある時は、まず医療・介護の窓口と家族の連絡順を確認してください。");
  } else if (entry.mood === "changed") {
    advice.add("変化があった日は、いつから・誰が見たか・次に誰へ伝えるかを一緒に残すと後で役立ちます。");
  }
  if (/入院|病院|退院|医師|看護|薬|服薬/.test(text)) {
    advice.add("病院名、担当窓口、退院見込み、薬の変更を記録しておくと次の相談が早くなります。");
  }
  if (/認知|忘れ|徘徊|怒|混乱|判断/.test(text)) {
    advice.add("判断力や記憶の変化は、日付・発言・困った場面を事実ベースで残しておくと相談時に役立ちます。");
  }
  if (/お金|通帳|保険|年金|支払|請求/.test(text)) {
    advice.add("暗証番号は保存せず、書類の存在と保管場所だけを家族で共有してください。");
  }
  if (/家|実家|片付|鍵|写真|荷物/.test(text)) {
    advice.add("実家や荷物の記録は、部屋ごとの写真と鍵・ライフラインの状態をセットで残すと整理しやすくなります。");
  }
  if (advice.size === 0) {
    advice.add("今日の記録は残せています。次は、家族に確認したいことが1つあるかだけ見ておくと十分です。");
  }
  advice.add("家族に送る時は「今日あったこと」「次に確認したいこと」を分けると、返事をもらいやすくなります。");

  return Array.from(advice).slice(0, 4);
}

export function diaryCompanionComment(entry: Pick<DiaryEntry, "body" | "mood">): string {
  const text = entry.body;

  if (entry.mood === "urgent") {
    return "急なことが起きた日は、全部を整理しきれなくても大丈夫です。まずは連絡した相手、言われた言葉、次に行く場所だけ残しておくと、あとで家族が同じ状況を見返せます。";
  }
  if (/入院|病院|退院|医師|看護|薬|服薬/.test(text)) {
    return "病院や薬の話は、あとから思い出すのが一番大変です。今日聞いた言葉をそのまま残せているだけで、次の相談の助けになります。";
  }
  if (/認知|忘れ|徘徊|怒|混乱|判断|発言/.test(text)) {
    return "様子や発言の変化は、家族だけで抱えると不安が大きくなります。決めつけず、今日見た事実として残せているのが大事です。";
  }
  if (/介護|ケアマネ|要介護|認定|施設|特養|訪問/.test(text)) {
    return "介護の手続きは言葉が多くて迷いやすいです。今日出てきた制度名や相談先を残しておくと、次に誰へ聞くかを一緒に整理できます。";
  }
  if (/家|実家|片付|鍵|写真|荷物|書類/.test(text)) {
    return "実家や書類のことは、写真と短いメモがあとで効きます。場所が分かる形で残しておくと、家族が同じ前提で動きやすくなります。";
  }
  if (entry.mood === "changed") {
    return "小さな変化でも、日付つきで残しておくと流れが見えます。次に同じことが起きた時、前回どうだったかを家族で確認できます。";
  }

  return "今日の記録を残せています。大きな変化がない日も、あとから見ると大切な流れになります。無理に詳しく書かなくても、一言ずつで十分です。";
}

/**
 * いまのプラン。サーバーから返ってきた値を控えてある。
 * 一度もクラウドに触っていない人は分からないので free として扱う。
 */
export function readPlan(): FamilyPlan {
  const storage = getLocalStorage();
  return storage?.getItem(PLAN_STORAGE_KEY) === "plus" ? "plus" : "free";
}

export function writePlan(plan: string | null | undefined) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(PLAN_STORAGE_KEY, plan === "plus" ? "plus" : "free");
  } catch {
    // 保存できなくても free 扱いで動く。
  }
}

/**
 * クラウドの家族手帳で、今のユーザーが課金・招待枠を管理できるか。
 * 招待された家族には二重課金CTAを出さないため、サーバー結果を控える。
 */
export function readCanManageFamilyBilling(): boolean {
  const storage = getLocalStorage();
  return storage?.getItem(FAMILY_BILLING_MANAGER_STORAGE_KEY) !== "false";
}

export function writeCanManageFamilyBilling(canManage: boolean | null | undefined) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(FAMILY_BILLING_MANAGER_STORAGE_KEY, canManage === false ? "false" : "true");
  } catch {
    // 保存できなくても、未確定時は作成者側として扱う。
  }
}

/** 2冊目の手帳を作れるか。作れない理由も返す。 */
export function notebookQuota(): { canCreate: boolean; message: string; count: number } {
  const count = readCases().length;
  return {
    canCreate: canCreateNotebook(readPlan(), count),
    message: NOTEBOOK_LIMIT_MESSAGE,
    count
  };
}

/** 無料の上限に当たったことを、呼び出し側が見分けられるようにする。 */
export class NotebookLimitError extends Error {
  constructor() {
    super(NOTEBOOK_LIMIT_MESSAGE);
    this.name = "NotebookLimitError";
  }
}

function textOrUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanInitialProfile(profile: Partial<PersonProfile>, selectedStatus: ParentStatus, now: string): PersonProfile {
  return {
    fullName: textOrUndefined(profile.fullName),
    displayName: textOrUndefined(profile.displayName) || textOrUndefined(profile.fullName),
    relationship: textOrUndefined(profile.relationship),
    birthDate: textOrUndefined(profile.birthDate),
    parentPrefecture: textOrUndefined(profile.parentPrefecture),
    parentCity: textOrUndefined(profile.parentCity),
    userPrefecture: textOrUndefined(profile.userPrefecture),
    careStatus: textOrUndefined(profile.careStatus) || statusLabel(selectedStatus),
    keyContact: textOrUndefined(profile.keyContact),
    hospitalOrFacility: textOrUndefined(profile.hospitalOrFacility),
    medicationNote: textOrUndefined(profile.medicationNote),
    documentLocationNote: textOrUndefined(profile.documentLocationNote),
    familyStructureNote: textOrUndefined(profile.familyStructureNote),
    emergencyContact: textOrUndefined(profile.emergencyContact),
    carePreference: textOrUndefined(profile.carePreference),
    importantPeopleNote: textOrUndefined(profile.importantPeopleNote),
    updatedAt: now
  };
}

function relationshipForDiagnosis(profile: PersonProfile): DiagnosisAnswers["targetRelationship"] | undefined {
  const value = `${profile.relationship ?? ""} ${profile.displayName ?? ""} ${profile.fullName ?? ""}`;
  if (value.includes("義母")) return "mother_in_law";
  if (value.includes("義父")) return "father_in_law";
  if (value.includes("祖父") || value.includes("祖母") || value.includes("祖")) return "grandparent";
  if (value.includes("母") || value.includes("ママ") || value.includes("おかあ") || value.includes("お母")) return "mother";
  if (value.includes("父") || value.includes("パパ") || value.includes("おとう") || value.includes("お父")) return "father";
  return profile.relationship || profile.displayName || profile.fullName ? "other" : undefined;
}

function initialAnswersForCase(selectedStatus: ParentStatus, profile: PersonProfile): DiagnosisAnswers {
  return {
    selectedStatus,
    targetRelationship: relationshipForDiagnosis(profile),
    targetName: profile.displayName || profile.fullName,
    parentSituation: profile.careStatus || statusLabel(selectedStatus),
    familyStructure: profile.familyStructureNote || "未入力",
    hasHome: "unknown",
    knowsAssets: "unknown",
    concerns: ["確認リスト", "日々の記録", "家族での共有"],
    homeClearance: "未入力"
  };
}

export async function createCase(selectedStatus: ParentStatus, initialProfile: Partial<PersonProfile> = {}): Promise<CaseRecord> {
  if (!notebookQuota().canCreate) {
    throw new NotebookLimitError();
  }

  const now = new Date().toISOString();
  const id = createLocalId("case");
  const personProfile = cleanInitialProfile(initialProfile, selectedStatus, now);
  const answers = initialAnswersForCase(selectedStatus, personProfile);
  const result = buildDiagnosisResult(answers);
  const record: CaseRecord = {
    id,
    selectedStatus,
    answers,
    personProfile,
    status: "result_ready",
    createdAt: now,
    updatedAt: now,
    result: {
      ...result,
      tasks: result.tasks.map((task) => ({
        ...task,
        id: createLocalId("task"),
        progress: "todo" as const
      }))
    },
    handoffToken: createHandoffToken(id),
    supportPackStatus: "none"
  };

  writeCases([record, ...readCases()]);
  trackFunnel("person_created");
  return record;
}

export async function submitDiagnosis(
  caseId: string,
  answers: DiagnosisAnswers,
  caseToken: string
): Promise<CaseRecord> {
  if (!ANONYMOUS_CASE_TOKEN_PATTERN.test(caseToken)) {
    throw new Error("A valid case ownership token is required");
  }

  const response = await fetch(`/api/cases/${caseId}/diagnosis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Case-Anonymous-Token": caseToken
    },
    body: JSON.stringify(answers)
  });
  if (!response.ok) {
    throw new Error(`Diagnosis submission failed with status ${response.status}`);
  }

  const apiResult = await response.json() as { record?: CaseRecord };
  if (!apiResult.record) {
    throw new Error("Diagnosis response did not include a record");
  }

  const cases = readCases();
  writeCases([apiResult.record, ...cases.filter((item) => item.id !== caseId)]);
  return apiResult.record;
}

export function createLocalDemoCase(): CaseRecord {
  const id = createLocalId("case");
  const now = new Date().toISOString();
  const answers: DiagnosisAnswers = {
    selectedStatus: "home_clearance",
    parentSituation: "実家が空き家になりそうで、家財整理と名義確認を家族で進めたい。",
    familyStructure: "母、長男、長女",
    hasHome: "yes",
    knowsAssets: "some",
    concerns: ["実家の片付け", "相続・名義変更", "相談先探し"],
    homeClearance: "鍵は長男が保管。電気・水道は契約状況を未確認。",
    contactName: "ローカル確認用",
    contactEmail: "demo@example.com",
    consentToContact: true,
    consentToSensitiveInfo: true,
    consentTextVersion: SENSITIVE_INFO_CONSENT_VERSION
  };
  const record: CaseRecord = {
    id,
    selectedStatus: answers.selectedStatus,
    answers,
    contactName: answers.contactName,
    contactEmail: answers.contactEmail,
    status: "result_ready",
    createdAt: now,
    updatedAt: now,
    result: buildDiagnosisResult(answers),
    handoffToken: createHandoffToken(id),
    supportPackStatus: "requested"
  };

  writeCases([record, ...readCases()]);
  return record;
}
