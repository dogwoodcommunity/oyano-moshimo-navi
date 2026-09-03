import { NextResponse } from "next/server";
import {
  buildDiagnosisResult,
  createHandoffToken,
  SENSITIVE_INFO_CONSENT_TEXT,
  SENSITIVE_INFO_CONSENT_VERSION,
  type DiagnosisAnswers
} from "@oyano/shared";
import { ANONYMOUS_CASE_TOKEN_PATTERN } from "@/lib/caseOwnership";
import { checkPublicRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDOFF_TOKEN_PATTERN = /^handoff_[a-f0-9]{48}$/i;

export async function POST(request: Request, { params }: { params: { caseId: string } }) {
  const rateLimited = await checkPublicRateLimit(request, {
    keyPrefix: "cases:diagnosis",
    limit: 30,
    windowSeconds: 60
  });
  if (rateLimited) return rateLimited;

  if (!UUID_PATTERN.test(params.caseId)) {
    return NextResponse.json({ error: "Invalid case" }, { status: 404 });
  }

  const anonymousToken = request.headers.get("x-case-anonymous-token")?.trim() ?? "";
  if (!ANONYMOUS_CASE_TOKEN_PATTERN.test(anonymousToken)) {
    return NextResponse.json({ error: "Case ownership token is required" }, { status: 400 });
  }

  const answers = await request.json() as DiagnosisAnswers;

  if (!answers.selectedStatus) {
    return NextResponse.json({ error: "selectedStatus is required" }, { status: 400 });
  }

  if (!answers.consentToSensitiveInfo) {
    return NextResponse.json({ error: "sensitiveInfoConsent is required" }, { status: 400 });
  }

  const consentTextVersion = answers.consentTextVersion ?? SENSITIVE_INFO_CONSENT_VERSION;
  const result = buildDiagnosisResult(answers);
  const requestedHandoffToken = createHandoffToken(params.caseId);

  const supabase = getServerSupabase();
  if (!supabase) {
    const record = {
      id: params.caseId,
      selectedStatus: answers.selectedStatus,
      answers,
      contactName: answers.contactName,
      contactEmail: answers.contactEmail,
      status: "result_ready" as const,
      createdAt: new Date().toISOString(),
      result,
      handoffToken: requestedHandoffToken,
      supportPackStatus: "none" as const
    };
    return NextResponse.json({ record, persisted: false });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent");
  const { data, error } = await supabase.rpc("submit_anonymous_case_diagnosis", {
    p_case_id: params.caseId,
    p_anonymous_token: anonymousToken,
    p_selected_status: answers.selectedStatus,
    p_answers: answers,
    p_contact_name: answers.contactName ?? null,
    p_contact_email: answers.contactEmail ?? null,
    p_consent_to_contact: answers.consentToContact ?? false,
    p_consent_version: consentTextVersion,
    p_consent_text: `${consentTextVersion}: ${SENSITIVE_INFO_CONSENT_TEXT}`,
    p_ip_address: forwardedFor ?? null,
    p_user_agent: userAgent ?? null,
    p_diagnosis_type: result.diagnosisType,
    p_summary: result.summary,
    p_first_steps: result.firstSteps,
    p_tasks: result.tasks,
    p_provider_categories: result.providerCategories,
    p_handoff_token: requestedHandoffToken
  });

  if (error) {
    const message = error.message ?? "";
    if (/invalid_case_token/.test(message)) {
      return NextResponse.json({ error: "Invalid case ownership token" }, { status: 404 });
    }
    if (/case_already_converted|case_already_submitted|case_state_conflict/.test(message)) {
      return NextResponse.json({ error: "This case can no longer be submitted" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to persist diagnosis" }, { status: 500 });
  }

  const handoffToken = typeof data?.handoffToken === "string" ? data.handoffToken : "";
  if (!HANDOFF_TOKEN_PATTERN.test(handoffToken)) {
    return NextResponse.json({ error: "Diagnosis persistence returned an invalid handoff" }, { status: 500 });
  }

  const record = {
    id: params.caseId,
    selectedStatus: answers.selectedStatus,
    answers,
    contactName: answers.contactName,
    contactEmail: answers.contactEmail,
    status: "result_ready" as const,
    createdAt: typeof data?.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    result,
    handoffToken,
    supportPackStatus: "none" as const
  };

  return NextResponse.json({ record, persisted: true });
}
