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
const email = process.argv[2];
const redirectTo = process.argv[3];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is required");
if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is required");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("usage: node scripts/create-mobile-magic-link.mjs email@example.com oyanomoshimo://...");
if (!redirectTo?.startsWith("oyanomoshimo://")) fail("redirect URL must start with oyanomoshimo://");

const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "magiclink",
    email,
    redirect_to: redirectTo
  })
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  fail(`generate_link returned ${response.status}: ${JSON.stringify(body)}`);
}

const actionLink = body.action_link ?? body.properties?.action_link;
if (!actionLink) {
  fail(`missing action_link: ${JSON.stringify(body)}`);
}

console.log(`OK   generated Magic Link for ${email}`);
console.log(`OPEN ${actionLink}`);
