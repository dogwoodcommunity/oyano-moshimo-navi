import { NextResponse } from "next/server";
import type { DiagnosisResult, ParentStatus } from "@oyano/shared";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminCaseDetail = {
  id: string;
  selectedStatus: ParentStatus;
  status: string;
  answers: unknown;
  contactName?: string;
  contactEmail?: string;
  consentToSensitiveInfo?: boolean;
  sensitiveInfoConsentVersion?: string;
  sensitiveInfoConsentedAt?: string;
  consentLogs: Array<{
    id: string;
    consentType: string;
    consentText: string;
    createdAt: string;
  }>;
  createdAt: string;
  result?: Partial<DiagnosisResult>;
  supportPacks: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
};

type CaseDetailRow = {
  id: string;
  selected_status: ParentStatus | null;
  status: string;
  answers: unknown;
  contact_name: string | null;
  contact_email: string | null;
  consent_to_sensitive_info: boolean | null;
  sensitive_info_consent_version: string | null;
  sensitive_info_consented_at: string | null;
  created_at: string;
  consent_logs?: Array<{
    id: string;
    consent_type: string;
    consent_text: string;
    created_at: string;
  }> | null;
  case_results?: Array<{
    diagnosis_type: string | null;
    summary: string | null;
    first_steps: string[] | null;
    tasks: unknown;
    provider_categories: string[] | null;
  }> | null;
  support_packs?: Array<{
    id: string;
    status: string;
    created_at: string;
  }> | null;
};

export async function GET(request: Request, { params }: { params: { caseId: string } }) {
  const unauthorized = verifyAdminRequest(request);
  if (unauthorized) return unauthorized;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ caseDetail: null, source: "not_configured" });
  }

  const { data, error } = await supabase
    .from("cases")
    .select(`
      id,
      selected_status,
      status,
      answers,
      contact_name,
      contact_email,
      consent_to_sensitive_info,
      sensitive_info_consent_version,
      sensitive_info_consented_at,
      created_at,
      consent_logs(id, consent_type, consent_text, created_at),
      case_results(diagnosis_type, summary, first_steps, tasks, provider_categories),
      support_packs(id, status, created_at)
    `)
    .eq("id", params.caseId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data as CaseDetailRow;
  const resultRow = row.case_results?.[0];
  const caseDetail: AdminCaseDetail = {
    id: row.id,
    selectedStatus: row.selected_status ?? "preparing",
    status: row.status,
    answers: row.answers,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    consentToSensitiveInfo: row.consent_to_sensitive_info ?? undefined,
    sensitiveInfoConsentVersion: row.sensitive_info_consent_version ?? undefined,
    sensitiveInfoConsentedAt: row.sensitive_info_consented_at ?? undefined,
    consentLogs: (row.consent_logs ?? []).map((item) => ({
      id: item.id,
      consentType: item.consent_type,
      consentText: item.consent_text,
      createdAt: item.created_at
    })),
    createdAt: row.created_at,
    result: resultRow ? {
      diagnosisType: resultRow.diagnosis_type ?? undefined,
      summary: resultRow.summary ?? undefined,
      firstSteps: resultRow.first_steps ?? undefined,
      tasks: Array.isArray(resultRow.tasks) ? resultRow.tasks as DiagnosisResult["tasks"] : undefined,
      providerCategories: resultRow.provider_categories ?? undefined
    } : undefined,
    supportPacks: (row.support_packs ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.created_at
    }))
  };

  return NextResponse.json({ caseDetail, source: "supabase" });
}
