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
const appRedirectTo = process.argv[3];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is required");
if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is required");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("usage: node scripts/create-mobile-auth-redirect.mjs email@example.com oyanomoshimo://...");
if (!appRedirectTo?.startsWith("oyanomoshimo://")) fail("redirect URL must start with oyanomoshimo://");

const linkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "magiclink",
    email
  })
});

const linkBody = await linkResponse.json().catch(() => ({}));
if (!linkResponse.ok) {
  fail(`generate_link returned ${linkResponse.status}: ${JSON.stringify(linkBody)}`);
}

const actionLink = linkBody.action_link ?? linkBody.properties?.action_link;
if (!actionLink) {
  fail(`missing action_link: ${JSON.stringify(linkBody)}`);
}

const verifyResponse = await fetch(actionLink, { redirect: "manual" });
const location = verifyResponse.headers.get("location");
if (!location) {
  fail(`verify did not return a redirect location: ${verifyResponse.status}`);
}

const redirectedUrl = new URL(location);
const appUrl = new URL(appRedirectTo);
for (const [key, value] of redirectedUrl.searchParams) {
  appUrl.searchParams.set(key, value);
}

if (redirectedUrl.hash) {
  const hashParams = new URLSearchParams(redirectedUrl.hash.slice(1));
  for (const [key, value] of hashParams) {
    appUrl.searchParams.set(key, value);
  }
}

console.log(`OK   generated mobile auth redirect for ${email}`);
console.log(`OPEN ${appUrl.toString()}`);
