"use client";

import { buildDiagnosisResult, createHandoffToken, type DiagnosisAnswers, type DiagnosisResult, type ParentStatus } from "@oyano/shared";

export type CaseRecord = {
  id: string;
  selectedStatus: ParentStatus;
  answers: Partial<DiagnosisAnswers>;
  contactName?: string;
  contactEmail?: string;
  status: "draft" | "submitted" | "result_ready" | "converted";
  createdAt: string;
  result?: DiagnosisResult;
  handoffToken?: string;
  supportPackStatus?: "none" | "requested" | "paid" | "reviewing" | "report_ready";
};

const STORAGE_KEY = "oyano_cases_v03";

function readCases(): CaseRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) as CaseRecord[] : [];
}

function writeCases(cases: CaseRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

export function listLocalCases(): CaseRecord[] {
  return readCases().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLocalCase(caseId: string): CaseRecord | undefined {
  return readCases().find((item) => item.id === caseId);
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
  const apiResult = await postJson<{ record: CaseRecord }>("/api/cases", { selectedStatus });

  const record: CaseRecord = apiResult?.record ?? {
    id: crypto.randomUUID(),
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

export async function requestSupportPack(caseId: string): Promise<void> {
  const cases = readCases();
  const record = cases.find((item) => item.id === caseId);
  if (!record) return;
  const nextRecord = { ...record, supportPackStatus: "requested" as const };
  writeCases([nextRecord, ...cases.filter((item) => item.id !== caseId)]);

  await postJson("/api/support-packs", { caseId });
}
