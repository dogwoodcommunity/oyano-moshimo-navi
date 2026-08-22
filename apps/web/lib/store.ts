"use client";

import { trackFunnel } from "@/lib/funnel";
import {
  buildDiagnosisResult,
  canCreateNotebook,
  createHandoffToken,
  NOTEBOOK_LIMIT_MESSAGE,
  SENSITIVE_INFO_CONSENT_VERSION,
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
};

export type PersonProfile = {
  fullName?: string;
  displayName?: string;
  relationship?: string;
  birthDate?: string;
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
const DIARY_STORAGE_KEY = "oyano_diary_entries_v01";
let memoryCases: CaseRecord[] = [];
let memoryDiaryEntries: DiaryEntry[] = [];

export function createLocalId(prefix = "local"): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const probeKey = "__oyano_storage_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCases(): CaseRecord[] {
  const storage = getLocalStorage();
  if (!storage) return memoryCases;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as CaseRecord[] : [];
  } catch {
    return memoryCases;
  }
}

function writeCases(cases: CaseRecord[]) {
  memoryCases = [...cases];
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch {
    // Private browsing or embedded browsers can reject storage writes.
  }
}

export function listLocalCases(): CaseRecord[] {
  return readCases().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLocalCase(caseId: string): CaseRecord | undefined {
  return readCases().find((item) => item.id === caseId);
}

function readDiaryEntries(): DiaryEntry[] {
  const storage = getLocalStorage();
  if (!storage) return memoryDiaryEntries;

  try {
    const raw = storage.getItem(DIARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) as DiaryEntry[] : [];
  } catch {
    return memoryDiaryEntries;
  }
}

function writeDiaryEntries(entries: DiaryEntry[]) {
  memoryDiaryEntries = [...entries];
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(DIARY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Keep the in-memory copy for the current app session.
  }
}

export function listDiaryEntries(caseId: string): DiaryEntry[] {
  return readDiaryEntries()
    .filter((item) => item.caseId === caseId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function exportNotebookData(): NotebookExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    cases: listLocalCases(),
    diaryEntries: readDiaryEntries()
  };
}

export function replaceLocalNotebook(input: { cases: CaseRecord[]; diaryEntries: DiaryEntry[] }) {
  writeCases(input.cases);
  writeDiaryEntries(input.diaryEntries);
}

export function resetLocalNotebookData() {
  memoryCases = [];
  memoryDiaryEntries = [];

  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(DIARY_STORAGE_KEY);
    storage.removeItem(PLAN_STORAGE_KEY);
  } catch {
    // If storage removal is blocked, the in-memory state above still gives
    // the current session a fresh start.
  }
}

export function addDiaryEntry(input: Omit<DiaryEntry, "id" | "createdAt">): DiaryEntry {
  const entry: DiaryEntry = {
    ...input,
    id: createLocalId("diary"),
    createdAt: new Date().toISOString()
  };
  writeDiaryEntries([entry, ...readDiaryEntries()]);
  trackFunnel("record_written");
  return entry;
}

export function updateDiaryEntry(entryId: string, patch: Partial<Omit<DiaryEntry, "id" | "caseId" | "createdAt">>): DiaryEntry | undefined {
  const entries = readDiaryEntries();
  const existing = entries.find((item) => item.id === entryId);
  if (!existing) return undefined;

  const updated: DiaryEntry = {
    ...existing,
    ...patch,
    date: normalizedTaskText(patch.date, existing.date) ?? existing.date,
    body: normalizedTaskText(patch.body, existing.body) ?? existing.body,
    mood: patch.mood === "urgent" || patch.mood === "changed" || patch.mood === "stable" ? patch.mood : existing.mood,
    attachments: Array.isArray(patch.attachments) ? patch.attachments : existing.attachments,
    updatedAt: new Date().toISOString()
  };

  writeDiaryEntries([updated, ...entries.filter((item) => item.id !== entryId)]);
  return updated;
}

export function updateCaseProfile(caseId: string, patch: Partial<PersonProfile>): CaseRecord | undefined {
  const cases = readCases();
  const existing = cases.find((item) => item.id === caseId);
  if (!existing) return undefined;

  const record: CaseRecord = {
    ...existing,
    personProfile: {
      ...(existing.personProfile ?? {}),
      ...patch,
      updatedAt: new Date().toISOString()
    }
  };

  writeCases([record, ...cases.filter((item) => item.id !== caseId)]);
  return record;
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
  return new Date().toISOString().slice(0, 10);
}

export function diaryAdvice(entry: Pick<DiaryEntry, "body" | "mood">): string[] {
  const text = entry.body;
  const advice = new Set<string>();

  if (entry.mood === "urgent") {
    advice.add("急な変化がある時は、まず医療・介護の窓口と家族の連絡順を確認してください。");
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

  return Array.from(advice).slice(0, 3);
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as T;
  } catch {
    return null;
  }
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

export async function createCase(selectedStatus: ParentStatus): Promise<CaseRecord> {
  if (!notebookQuota().canCreate) {
    throw new NotebookLimitError();
  }

  const record: CaseRecord = {
    id: createLocalId("case"),
    selectedStatus,
    answers: { selectedStatus },
    status: "draft",
    createdAt: new Date().toISOString(),
    supportPackStatus: "none"
  };

  writeCases([record, ...readCases()]);
  trackFunnel("person_created");
  return record;
}

export async function submitDiagnosis(caseId: string, answers: DiagnosisAnswers): Promise<CaseRecord> {
  const apiResult = await postJson<{ record: CaseRecord }>(`/api/cases/${caseId}/diagnosis`, answers);
  if (apiResult?.record) {
    const cases = readCases();
    writeCases([apiResult.record, ...cases.filter((item) => item.id !== caseId)]);
    return apiResult.record;
  }

  const result = buildDiagnosisResult(answers);
  const handoffToken = createHandoffToken(caseId);
  const cases = readCases();
  const existing = cases.find((item) => item.id === caseId);
  const record: CaseRecord = {
    ...(existing ?? {
      id: caseId,
      selectedStatus: answers.selectedStatus,
      createdAt: new Date().toISOString(),
      supportPackStatus: "none" as const
    }),
    selectedStatus: answers.selectedStatus,
    answers,
    contactName: answers.contactName,
    contactEmail: answers.contactEmail,
    status: "result_ready",
    result,
    handoffToken
  };

  const next = [record, ...cases.filter((item) => item.id !== caseId)];
  writeCases(next);

  return record;
}

export function createLocalDemoCase(): CaseRecord {
  const id = createLocalId("case");
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
    createdAt: new Date().toISOString(),
    result: buildDiagnosisResult(answers),
    handoffToken: createHandoffToken(id),
    supportPackStatus: "requested"
  };

  writeCases([record, ...readCases()]);
  return record;
}
