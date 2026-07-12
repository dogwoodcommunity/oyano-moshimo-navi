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

const email = process.argv[2]?.trim().toLowerCase();
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
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("usage: node scripts/report-test-duplicates.mjs email@example.com");
}

async function api(path) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) fail(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
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

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

const user = await findUserByEmail();
if (!user?.id) fail(`auth user not found: ${email}`);

const members = await api(`/rest/v1/family_members?user_id=eq.${encodeURIComponent(user.id)}&select=id,family_id,role,relationship,created_at`);
const familyIds = [...new Set((members ?? []).map((member) => member.family_id).filter(Boolean))];
if (familyIds.length === 0) fail("family member not found for user");

const people = await api(`/rest/v1/people?family_id=${inFilter(familyIds)}&select=id,family_id,display_name,current_status,created_at&order=created_at.desc`);
const personIds = [...new Set((people ?? []).map((person) => person.id).filter(Boolean))];
const tasks = personIds.length
  ? await api(`/rest/v1/tasks?person_id=${inFilter(personIds)}&select=id,person_id,title,status,due_date,assigned_member_id,created_at,updated_at&order=created_at.desc`)
  : [];
const cases = personIds.length
  ? await api(`/rest/v1/cases?person_id=${inFilter(personIds)}&select=id,person_id,selected_status,status,created_at&order=created_at.desc`)
  : [];

const tasksByPerson = groupBy(tasks ?? [], (task) => task.person_id);
const casesByPerson = groupBy(cases ?? [], (item) => item.person_id);
const peopleGroups = [...groupBy(people ?? [], (person) => `${person.family_id}:${person.display_name}:${person.current_status}`).entries()]
  .filter(([, rows]) => rows.length > 1);

console.log(`OK   user: ${email}`);
console.log(`FAMILIES ${familyIds.length}`);
console.log(`PEOPLE ${people?.length ?? 0}`);
console.log(`TASKS ${tasks?.length ?? 0}`);
console.log(`DUPLICATE_PERSON_GROUPS ${peopleGroups.length}`);

for (const [key, rows] of peopleGroups) {
  console.log(`\nGROUP ${key} count=${rows.length}`);
  rows.forEach((person, index) => {
    const marker = index === 0 ? "KEEP_NEWEST?" : "DUPLICATE?";
    const personTasks = tasksByPerson.get(person.id) ?? [];
    const personCases = casesByPerson.get(person.id) ?? [];
    console.log(`${marker} person=${person.id} created=${person.created_at} tasks=${personTasks.length} cases=${personCases.length}`);
    for (const task of personTasks.slice(0, 4)) {
      console.log(`  TASK ${task.status} due=${task.due_date ?? "-"} assigned=${task.assigned_member_id ? "yes" : "no"} ${task.title}`);
    }
  });
}
