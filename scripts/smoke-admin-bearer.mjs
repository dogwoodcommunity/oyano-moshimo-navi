import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const body = readFileSync(path, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}

loadEnvFile(".env.local");
loadEnvFile("apps/web/.env.local");

const baseUrl = (process.argv[2] ?? process.env.WEB_BASE_URL ?? "https://oyano-moshimo-navi.vercel.app").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function requireEnv(key, value) {
  if (!value) {
    fail(`Missing ${key}`);
    process.exit();
  }
}

requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
requireEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);

const smokeId = randomUUID();
const email = `admin-smoke+${smokeId.slice(0, 8)}@example.com`;
const password = `${randomBytes(18).toString("base64url")}aA1!`;
let userId;
let familyId;

const serviceHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json"
};

async function requestJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}: ${text}`);
  }

  return body;
}

async function cleanup() {
  if (familyId) {
    await fetch(`${supabaseUrl}/rest/v1/families?id=eq.${familyId}`, {
      method: "DELETE",
      headers: serviceHeaders
    });
  }

  if (userId) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: serviceHeaders
    });
  }
}

try {
  const user = await requestJson(
    `${supabaseUrl}/auth/v1/admin/users`,
    {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          purpose: "admin-bearer-smoke"
        }
      })
    },
    "create auth user"
  );
  userId = user.id;
  console.log("OK   temporary auth user created");

  await requestJson(
    `${supabaseUrl}/rest/v1/profiles`,
    {
      method: "POST",
      headers: { ...serviceHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        id: userId,
        email,
        display_name: "Admin bearer smoke"
      })
    },
    "upsert profile"
  );
  console.log("OK   temporary profile upserted");

  const families = await requestJson(
    `${supabaseUrl}/rest/v1/families`,
    {
      method: "POST",
      headers: { ...serviceHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        name: "親のもしもナビ運営 smoke",
        owner_user_id: userId,
        plan: "plus"
      })
    },
    "create admin family"
  );
  familyId = families?.[0]?.id;
  if (!familyId) throw new Error("create admin family did not return id");
  console.log("OK   temporary admin family created");

  await requestJson(
    `${supabaseUrl}/rest/v1/family_members`,
    {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        family_id: familyId,
        user_id: userId,
        role: "admin",
        relationship: "app_admin"
      })
    },
    "create app_admin family member"
  );
  console.log("OK   app_admin family member created");

  const token = await requestJson(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    },
    "password grant"
  );
  if (!token?.access_token) throw new Error("password grant did not return access_token");
  console.log("OK   temporary access token issued");

  const adminResponse = await fetch(`${baseUrl}/api/admin/env-check`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });

  if (!adminResponse.ok) {
    throw new Error(`admin env-check returned ${adminResponse.status}: ${await adminResponse.text()}`);
  }

  const adminBody = await adminResponse.json();
  if (!Array.isArray(adminBody.env)) {
    throw new Error("admin env-check response did not include env array");
  }

  console.log("OK   admin env-check accepted app_admin Bearer token");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
  console.log("OK   temporary admin smoke data cleaned up");
}
