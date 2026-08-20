"use client";

import {
  buildDiagnosisResult,
  createHandoffToken,
  SENSITIVE_INFO_CONSENT_VERSION,
  type DiagnosisAnswers,
  type DiagnosisResult,
  type ParentStatus
} from "@oyano/shared";

export type CaseRecord = {
  id: string;
  selectedStatus: ParentStatus;
  answers: Partial<DiagnosisAnswers>;
  personProfile?: PersonProfile;
  contactName?: string;
  contactEmail?: string;
  status: "draft" | "submitted" | "result_ready" | "converted";
  createdAt: string;
  result?: DiagnosisResult;
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
};

const STORAGE_KEY = "oyano_cases_v03";
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

export function addDiaryEntry(input: Omit<DiaryEntry, "id" | "createdAt">): DiaryEntry {
  const entry: DiaryEntry = {
    ...input,
    id: createLocalId("diary"),
    createdAt: new Date().toISOString()
  };
  writeDiaryEntries([entry, ...readDiaryEntries()]);
  return entry;
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

export async function createCase(selectedStatus: ParentStatus): Promise<CaseRecord> {
  const record: CaseRecord = {
    id: createLocalId("case"),
    selectedStatus,
    answers: { selectedStatus },
    status: "draft",
    createdAt: new Date().toISOString(),
    supportPackStatus: "none"
  };

  writeCases([record, ...readCases()]);
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
