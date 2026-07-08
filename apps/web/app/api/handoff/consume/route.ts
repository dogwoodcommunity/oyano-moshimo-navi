import { NextResponse } from "next/server";
import type { ParentStatus } from "@oyano/shared";
import { getServerSupabase } from "@/lib/serverSupabase";

type CaseRow = {
  id: string;
  selected_status: ParentStatus | null;
  contact_name: string | null;
  family_id: string | null;
  person_id: string | null;
  answers: {
    familyStructure?: string;
  } | null;
};

type CaseResultRow = {
  id: string;
  case_id: string;
  app_handoff_token: string | null;
  app_handoff_consumed_at: string | null;
  tasks: Array<{
    title: string;
    description?: string;
    priority?: number;
    category?: string;
    dueDate?: string;
  }> | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDOFF_TOKEN_PATTERN = /^handoff_(?:[a-f0-9]{48}|[a-f0-9]{12}_[a-f0-9]{48})$/i;

export async function POST(request: Request) {
  const body = await request.json() as {
    caseId?: string;
    token?: string;
    displayName?: string;
  };

  if (!body.caseId || !body.token) {
    return NextResponse.json({ error: "caseId and token are required" }, { status: 400 });
  }

  if (!UUID_PATTERN.test(body.caseId) || !HANDOFF_TOKEN_PATTERN.test(body.token)) {
    return NextResponse.json({ error: "Invalid handoff token" }, { status: 404 });
  }

  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) {
    return NextResponse.json({ error: "Authorization bearer token is required" }, { status: 401 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 501 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userResult.user) {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  const handoffCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: caseResult, error: resultError } = await supabase
    .from("case_results")
    .select("id, case_id, app_handoff_token, app_handoff_consumed_at, tasks")
    .eq("case_id", body.caseId)
    .eq("app_handoff_token", body.token)
    .is("app_handoff_consumed_at", null)
    .gt("created_at", handoffCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (resultError || !caseResult) {
    return NextResponse.json({ error: "Invalid handoff token" }, { status: 404 });
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, selected_status, contact_name, family_id, person_id, answers")
    .eq("id", body.caseId)
    .single();

  if (caseError || !caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const caze = caseRow as CaseRow;
  const result = caseResult as CaseResultRow;

  const { data: claimedHandoff, error: claimError } = await supabase
    .from("case_results")
    .update({ app_handoff_consumed_at: new Date().toISOString() })
    .eq("id", result.id)
    .is("app_handoff_consumed_at", null)
    .select("id")
    .single();

  if (claimError || !claimedHandoff) {
    return NextResponse.json({ error: "Handoff token already consumed" }, { status: 409 });
  }

  await supabase.from("profiles").upsert({
    id: userResult.user.id,
    email: userResult.user.email ?? null,
    display_name: body.displayName || userResult.user.email || null,
    updated_at: new Date().toISOString()
  });

  if (caze.family_id && caze.person_id) {
    await supabase.from("family_members").upsert({
      family_id: caze.family_id,
      user_id: userResult.user.id,
      role: "owner",
      relationship: "家族代表"
    }, { onConflict: "family_id,user_id" });

    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("person_id", caze.person_id);

    return NextResponse.json({
      familyId: caze.family_id,
      personId: caze.person_id,
      tasksCreated: count ?? 0
    });
  }

  const familyName = caze.answers?.familyStructure ? `${caze.answers.familyStructure}の家族` : "親のもしもナビ家族";

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      name: familyName,
      owner_user_id: userResult.user.id,
      plan: "free"
    })
    .select("id")
    .single();

  if (familyError || !family) {
    return NextResponse.json({ error: familyError?.message ?? "Failed to create family" }, { status: 500 });
  }

  const { error: memberError } = await supabase.from("family_members").insert({
    family_id: family.id,
    user_id: userResult.user.id,
    role: "owner",
    relationship: "家族代表"
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const { data: person, error: personError } = await supabase
    .from("people")
    .insert({
      family_id: family.id,
      display_name: body.displayName || caze.contact_name || "親",
      relationship_to_family: "親",
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
