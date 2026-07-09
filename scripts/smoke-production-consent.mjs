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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const caseId = crypto.randomUUID();
const email = `smoke+${caseId.slice(0, 8)}@example.com`;

const answers = {
  selectedStatus: "hospitalized",
  parentSituation: "本番同意ログ確認用のスモークテストです。",
  familyStructure: "母、長男",
  hasHome: "unknown",
  knowsAssets: "unknown",
  concerns: ["期限がある手続き", "家族の役割分担"],
  homeClearance: "",
  contactName: "本番確認",
  contactEmail: email,
  consentToContact: false,
  consentToSensitiveInfo: true,
  consentTextVersion: "sensitive-info-v1"
};

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

const diagnosisResponse = await fetch(`${baseUrl}/api/cases/${caseId}/diagnosis`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(answers)
});

if (!diagnosisResponse.ok) {
  const body = await diagnosisResponse.text();
  fail(`diagnosis submit returned ${diagnosisResponse.status}: ${body}`);
}

const diagnosisBody = await diagnosisResponse.json();
if (!diagnosisBody?.record?.id || diagnosisBody.record.id !== caseId) {
  fail("diagnosis response did not return the expected case id");
}

console.log(`OK   diagnosis submitted: ${caseId}`);

if (!supabaseUrl || !serviceRoleKey) {
  console.log("SKIP Supabase REST verification: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(0);
}

const restHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`
};

const caseUrl = new URL(`${supabaseUrl}/rest/v1/cases`);
caseUrl.searchParams.set("id", `eq.${caseId}`);
caseUrl.searchParams.set("select", "id,consent_to_sensitive_info,sensitive_info_consent_version,sensitive_info_consented_at");

const caseResponse = await fetch(caseUrl, { headers: restHeaders });
if (!caseResponse.ok) {
  const body = await caseResponse.text();
  if (body.includes("consent_to_sensitive_info")) {
    fail(
      `cases REST check returned ${caseResponse.status}: consent columns are missing. Run supabase/production_pending_hardening.sql or supabase/sensitive_info_consent_hardening.sql in Supabase SQL Editor.`
    );
  }
  fail(`cases REST check returned ${caseResponse.status}: ${body}`);
}

const caseRows = await caseResponse.json();
const caseRow = caseRows?.[0];
if (!caseRow?.consent_to_sensitive_info) {
  fail("cases.consent_to_sensitive_info was not true");
}
if (caseRow.sensitive_info_consent_version !== "sensitive-info-v1") {
  fail("cases.sensitive_info_consent_version was not sensitive-info-v1");
}
if (!caseRow.sensitive_info_consented_at) {
  fail("cases.sensitive_info_consented_at was empty");
}

console.log("OK   cases consent fields saved");

const consentUrl = new URL(`${supabaseUrl}/rest/v1/consent_logs`);
consentUrl.searchParams.set("case_id", `eq.${caseId}`);
consentUrl.searchParams.set("consent_type", "eq.sensitive_info");
consentUrl.searchParams.set("select", "id,consent_type,consent_text,created_at");

const consentResponse = await fetch(consentUrl, { headers: restHeaders });
if (!consentResponse.ok) {
  fail(`consent_logs REST check returned ${consentResponse.status}: ${await consentResponse.text()}`);
}

const consentRows = await consentResponse.json();
if (!consentRows?.[0]?.consent_text?.includes("sensitive-info-v1")) {
  fail("consent_logs sensitive_info row was not found");
}

console.log("OK   consent_logs sensitive_info row saved");
