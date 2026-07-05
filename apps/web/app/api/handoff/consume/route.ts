import { NextResponse } from "next/server";
import type { ParentStatus } from "@oyano/shared";
import { getServerSupabase } from "@/lib/serverSupabase";

type CaseRow = {
  id: string;
  selected_status: ParentStatus | null;
  contact_name: string | null;
  answers: {
    familyStructure?: string;
  } | null;
};

type CaseResultRow = {
  id: string;
  case_id: string;
  app_handoff_token: string | null;
  tasks: Array<{
    title: string;
    description?: string;
    priority?: number;
    category?: string;
    dueDate?: string;
  }> | null;
};

export async function POST(request: Request) {
  const body = await request.json() as {
    caseId?: string;
    token?: string;
    displayName?: string;
  };

  if (!body.caseId || !body.token) {
    return NextResponse.json({ error: "caseId and token are required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 501 });
  }

  const { data: caseResult, error: resultError } = await supabase
    .from("case_results")
    .select("id, case_id, app_handoff_token, tasks")
    .eq("case_id", body.caseId)
    .eq("app_handoff_token", body.token)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (resultError || !caseResult) {
    return NextResponse.json({ error: "Invalid handoff token" }, { status: 404 });
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, selected_status, contact_name, answers")
    .eq("id", body.caseId)
    .single();

  if (caseError || !caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const caze = caseRow as CaseRow;
  const result = caseResult as CaseResultRow;
  const familyName = caze.answers?.familyStructure ? `${caze.answers.familyStructure}の家族` : "親のもしもナビ家族";

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      name: familyName,
      plan: "free"
    })
    .select("id")
    .single();

  if (familyError || !family) {
    return NextResponse.json({ error: familyError?.message ?? "Failed to create family" }, { status: 500 });
  }

  const { data: person, error: personError } = await supabase
    .from("people")
    .insert({
      family_id: family.id,
      display_name: body.displayName || caze.contact_name || "親",
      relationship_to_family: "parent",
      current_status: caze.selected_status ?? "preparing"
    })
    .select("id")
    .single();

  if (personError || !person) {
    return NextResponse.json({ error: personError?.message ?? "Failed to create person" }, { status: 500 });
  }

  const taskRows = (result.tasks ?? []).map((task) => ({
    person_id: person.id,
    title: task.title,
    description: task.description ?? null,
    priority: task.priority ?? 3,
    category: task.category ?? null,
    due_date: task.dueDate ?? null,
    status: "todo"
  }));

  if (taskRows.length > 0) {
    const { error: tasksError } = await supabase.from("tasks").insert(taskRows);
    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }
  }

  await supabase
    .from("cases")
    .update({
      family_id: family.id,
      person_id: person.id,
      status: "converted"
    })
    .eq("id", body.caseId);

  return NextResponse.json({
    familyId: family.id,
    personId: person.id,
    tasksCreated: taskRows.length
  });
}
