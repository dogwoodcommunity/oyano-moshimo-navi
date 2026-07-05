import { NextResponse } from "next/server";
import { buildDiagnosisResult, createHandoffToken, type DiagnosisAnswers } from "@oyano/shared";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request, { params }: { params: { caseId: string } }) {
  const answers = await request.json() as DiagnosisAnswers;

  if (!answers.selectedStatus) {
    return NextResponse.json({ error: "selectedStatus is required" }, { status: 400 });
  }

  const result = buildDiagnosisResult(answers);
  const handoffToken = createHandoffToken(params.caseId);
  const record = {
    id: params.caseId,
    selectedStatus: answers.selectedStatus,
    answers,
    contactName: answers.contactName,
    contactEmail: answers.contactEmail,
    status: "result_ready" as const,
    createdAt: new Date().toISOString(),
    result,
    handoffToken,
    supportPackStatus: "none" as const
  };

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ record, persisted: false });
  }

  const { error: caseError } = await supabase.from("cases").upsert({
    id: params.caseId,
    selected_status: answers.selectedStatus,
    answers,
    contact_name: answers.contactName,
    contact_email: answers.contactEmail,
    consent_to_contact: answers.consentToContact ?? false,
    status: "result_ready"
  });

  if (caseError) {
    return NextResponse.json({ error: caseError.message }, { status: 500 });
  }

  const { error: resultError } = await supabase.from("case_results").insert({
    case_id: params.caseId,
    diagnosis_type: result.diagnosisType,
    summary: result.summary,
    first_steps: result.firstSteps,
    tasks: result.tasks,
    provider_categories: result.providerCategories,
    app_handoff_token: handoffToken
  });

  if (resultError) {
    return NextResponse.json({ error: resultError.message }, { status: 500 });
  }

  return NextResponse.json({ record, persisted: true });
}
