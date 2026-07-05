import type { DiagnosisResult, ParentStatus } from "@oyano/shared";
import { demoPerson, demoResult } from "./demoData";
import { getSupabase } from "./supabase";

export type MobilePerson = {
  id: string;
  displayName: string;
  relationship?: string;
  currentStatus: ParentStatus;
};

export type MobileTask = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done" | "skipped";
  dueDate?: string;
  priority: number;
  category?: string;
};

export type DashboardData = {
  person: MobilePerson;
  tasks: MobileTask[];
  registryItems: string[];
  firstSteps: string[];
  source: "supabase" | "demo";
};

type PersonRow = {
  id: string;
  display_name: string;
  relationship_to_family: string | null;
  current_status: ParentStatus;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: MobileTask["status"];
  due_date: string | null;
  priority: number | null;
  category: string | null;
};

function demoTasksFromResult(result: DiagnosisResult): MobileTask[] {
  return result.tasks.map((task, index) => ({
    id: `demo-task-${index}`,
    title: task.title,
    description: task.description,
    status: index % 3 === 0 ? "todo" : index % 3 === 1 ? "doing" : "done",
    dueDate: task.dueDate,
    priority: task.priority,
    category: task.category
  }));
}

export function demoDashboardData(): DashboardData {
  return {
    person: demoPerson,
    tasks: demoTasksFromResult(demoResult),
    registryItems: demoResult.registryItems,
    firstSteps: demoResult.firstSteps,
    source: "demo"
  };
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = getSupabase();
  if (!supabase) return demoDashboardData();

  const { data: people } = await supabase
    .from("people")
    .select("id, display_name, relationship_to_family, current_status")
    .order("created_at", { ascending: true })
    .limit(1);

  const personRow = (people?.[0] ?? null) as PersonRow | null;
  if (!personRow) return demoDashboardData();

  const tasks = await fetchTasks(personRow.id);
  return {
    person: {
      id: personRow.id,
      displayName: personRow.display_name,
      relationship: personRow.relationship_to_family ?? undefined,
      currentStatus: personRow.current_status
    },
    tasks,
    registryItems: demoResult.registryItems,
    firstSteps: tasks.slice(0, 3).map((task) => task.title),
    source: "supabase"
  };
}

export async function fetchPerson(personId: string): Promise<MobilePerson> {
  const supabase = getSupabase();
  if (!supabase) return demoPerson;

  const { data } = await supabase
    .from("people")
    .select("id, display_name, relationship_to_family, current_status")
    .eq("id", personId)
    .single();

  const row = data as PersonRow | null;
  if (!row) return demoPerson;

  return {
    id: row.id,
    displayName: row.display_name,
    relationship: row.relationship_to_family ?? undefined,
    currentStatus: row.current_status
  };
}

export async function fetchTasks(personId: string): Promise<MobileTask[]> {
  const supabase = getSupabase();
  if (!supabase) return demoTasksFromResult(demoResult);

  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, status, due_date, priority, category")
    .eq("person_id", personId)
    .order("due_date", { ascending: true });

  const rows = (data ?? []) as TaskRow[];
  if (rows.length === 0) return demoTasksFromResult(demoResult);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    dueDate: row.due_date ?? undefined,
    priority: row.priority ?? 3,
    category: row.category ?? undefined
  }));
}
