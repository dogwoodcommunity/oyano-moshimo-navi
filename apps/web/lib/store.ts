"use client";

import { createClient } from "@supabase/supabase-js";
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

function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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

export async function createCase(selectedStatus: ParentStatus): Promise<CaseRecord> {
  const record: CaseRecord = {
    id: crypto.randomUUID(),
    selectedStatus,
    answers: { selectedStatus },
    status: "draft",
    createdAt: new Date().toISOString(),
    supportPackStatus: "none"
  };

  const client = browserSupabase();
  if (client) {
    await client.from("cases").insert({
      id: record.id,
      selected_status: selectedStatus,
      answers: record.answers,
      status: "draft",
      anonymous_token: `anon_${record.id}`
    });
  }

  writeCases([record, ...readCases()]);
  return record;
}

export async function submitDiagnosis(caseId: string, answers: DiagnosisAnswers): Promise<CaseRecord> {
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

  const client = browserSupabase();
  if (client) {
    await client.from("cases").upsert({
      id: record.id,
      selected_status: answers.selectedStatus,
      answers,
      contact_name: answers.contactName,
      contact_email: answers.contactEmail,
      consent_to_contact: answers.consentToContact ?? false,
      status: "result_ready"
    });
    await client.from("case_results").insert({
      case_id: record.id,
      diagnosis_type: result.diagnosisType,
      summary: result.summary,
      first_steps: result.firstSteps,
      tasks: result.tasks,
      provider_categories: result.providerCategories,
      app_handoff_token: handoffToken
    });
  }

  return record;
}

export async function requestSupportPack(caseId: string): Promise<void> {
  const cases = readCases();
  const record = cases.find((item) => item.id === caseId);
  if (!record) return;
  const nextRecord = { ...record, supportPackStatus: "requested" as const };
  writeCases([nextRecord, ...cases.filter((item) => item.id !== caseId)]);

  const client = browserSupabase();
  if (client) {
    await client.from("support_packs").insert({
      case_id: caseId,
      status: "requested",
      requested_scope: { source: "web_result", stripe_checkout_pending: true }
    });
  }
}
