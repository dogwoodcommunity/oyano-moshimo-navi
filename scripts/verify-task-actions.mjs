import { readFileSync } from "node:fs";

function parseEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

const args = process.argv.slice(2);
const email = args.find((arg) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(arg))?.trim().toLowerCase();
const apply = args.includes("--apply");

const env = {
  ...parseEnvFile("apps/web/.env.local"),
  ...process.env
};

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is required");
if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is required");
if (!email) fail("usage: node scripts/verify-task-actions.mjs email@example.com [--apply]");

async function api(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.body ? { "Content-Type": "application/json", Prefer: "return=representation" } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) fail(`${options.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function findUserByEmail() {
  for (let page = 1; page <= 10; page += 1) {
    const body = await api(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = Array.isArray(body?.users) ? body.users : [];
    const user = users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (users.length < 100) break;
  }
  return null;
}

function inFilter(values) {
  return values.length > 0 ? `in.(${values.join(",")})` : "in.()";
}

async function patchTask(taskId, patch) {
  const rows = await api(`/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title,status,assigned_member_id,completed_at,updated_at`, {
    method: "PATCH",
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString()
    })
  });
  return rows?.[0] ?? null;
}

const user = await findUserByEmail();
if (!user?.id) fail(`auth user not found: ${email}`);

const userId = user.id;
const members = await api(`/rest/v1/family_members?user_id=eq.${encodeURIComponent(userId)}&select=id,family_id,role,relationship,created_at&order=created_at.asc`);
const familyIds = [...new Set((members ?? []).map((member) => member.family_id).filter(Boolean))];
if (familyIds.length === 0) fail("family member not found for user");

const people = await api(`/rest/v1/people?family_id=${inFilter(familyIds)}&select=id,display_name,current_status,family_id,created_at&order=created_at.desc`);
const personIds = [...new Set((people ?? []).map((person) => person.id).filter(Boolean))];
if (personIds.length === 0) fail("people not found for user families");

const tasks = await api(`/rest/v1/tasks?person_id=${inFilter(personIds)}&select=id,person_id,title,status,due_date,assigned_member_id,completed_at,updated_at&order=updated_at.desc`);
const target = (tasks ?? []).find((task) => task.status !== "done" && task.status !== "skipped") ?? tasks?.[0];
if (!target) fail("task not found");

const selfMember = members.find((member) => member.user_id === userId) ?? members[0];
if (!selfMember?.id) fail("self family member not found");

console.log(`OK   user: ${email}`);
console.log(`TASK ${target.id} ${target.title}`);
console.log(`ORIGINAL status=${target.status} assigned=${target.assigned_member_id ?? "null"}`);

if (!apply) {
  console.log("DRY_RUN no changes made. Add --apply to test doing -> assign self -> done -> restore.");
  process.exit(0);
}

const original = {
  status: target.status,
  assigned_member_id: target.assigned_member_id,
  completed_at: target.completed_at
};

try {
  const doing = await patchTask(target.id, {
    status: "doing",
    completed_at: null
  });
  console.log(`STEP doing status=${doing.status}`);

  const assigned = await patchTask(target.id, {
    assigned_member_id: selfMember.id
  });
  console.log(`STEP assign_self assigned=${assigned.assigned_member_id === selfMember.id ? "yes" : "no"}`);

  const done = await patchTask(target.id, {
    status: "done",
    completed_at: new Date().toISOString()
  });
  console.log(`STEP done status=${done.status} completed_at=${done.completed_at ? "set" : "null"}`);
} finally {
  const restored = await patchTask(target.id, original);
  console.log(`RESTORED status=${restored.status} assigned=${restored.assigned_member_id ?? "null"}`);
}
