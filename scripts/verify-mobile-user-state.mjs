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

const env = {
  ...parseEnvFile("apps/web/.env.local"),
  ...process.env
};

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2]?.trim().toLowerCase();

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is required");
if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is required");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("usage: node scripts/verify-mobile-user-state.mjs email@example.com");
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

const user = await findUserByEmail();
if (!user?.id) fail(`auth user not found: ${email}`);

const userId = user.id;
const encodedUserId = encodeURIComponent(userId);

const [tokens, preferences, members] = await Promise.all([
  api(`/rest/v1/push_tokens?user_id=eq.${encodedUserId}&select=id,expo_push_token,platform,device_name,is_active,updated_at&order=updated_at.desc`),
  api(`/rest/v1/notification_preferences?user_id=eq.${encodedUserId}&select=reminders_enabled,daily_digest_enabled,urgent_enabled,updated_at&order=updated_at.desc&limit=1`),
  api(`/rest/v1/family_members?user_id=eq.${encodedUserId}&select=id,family_id,role,relationship,created_at`)
]);

const familyIds = [...new Set((members ?? []).map((member) => member.family_id).filter(Boolean))];
const people = familyIds.length > 0
  ? await api(`/rest/v1/people?family_id=${inFilter(familyIds)}&select=id,display_name,current_status,family_id,created_at&order=created_at.desc`)
  : [];
const personIds = [...new Set((people ?? []).map((person) => person.id).filter(Boolean))];
const tasks = personIds.length > 0
  ? await api(`/rest/v1/tasks?person_id=${inFilter(personIds)}&select=id,person_id,title,status,due_date,assigned_member_id,updated_at&order=updated_at.desc`)
  : [];

const activePushTokens = (tokens ?? []).filter((token) => token.is_active);
const incompleteTasks = (tasks ?? []).filter((task) => task.status !== "done" && task.status !== "skipped");
const unassignedTasks = incompleteTasks.filter((task) => !task.assigned_member_id);
const doneTasks = (tasks ?? []).filter((task) => task.status === "done");

console.log(`OK   user: ${email}`);
console.log(`USER ${userId}`);
console.log(`PUSH total=${tokens?.length ?? 0} active=${activePushTokens.length}`);
for (const token of activePushTokens.slice(0, 3)) {
  console.log(`PUSH_TOKEN platform=${token.platform ?? "-"} device=${token.device_name ?? "-"} updated=${token.updated_at}`);
}
console.log(`PREF reminders=${preferences?.[0]?.reminders_enabled ?? "-"} monthly=${preferences?.[0]?.daily_digest_enabled ?? "-"} urgent=${preferences?.[0]?.urgent_enabled ?? "-"}`);
console.log(`FAMILY_MEMBERS ${members?.length ?? 0}`);
console.log(`PEOPLE ${people?.length ?? 0}`);
console.log(`TASKS total=${tasks?.length ?? 0} incomplete=${incompleteTasks.length} unassigned=${unassignedTasks.length} done=${doneTasks.length}`);
for (const task of (tasks ?? []).slice(0, 8)) {
  console.log(`TASK ${task.status.padEnd(5)} due=${task.due_date ?? "-"} assigned=${task.assigned_member_id ? "yes" : "no"} ${task.title}`);
}
