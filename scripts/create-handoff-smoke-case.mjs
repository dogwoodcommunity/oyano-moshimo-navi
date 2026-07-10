const baseUrl = (process.argv[2] ?? process.env.WEB_BASE_URL ?? "https://oyano-moshimo-navi.vercel.app").replace(/\/$/, "");
const caseId = crypto.randomUUID();

const answers = {
  selectedStatus: "hospitalized",
  parentSituation: "実機handoff確認用のテストです。",
  familyStructure: "母、長男",
  hasHome: "unknown",
  knowsAssets: "unknown",
  concerns: ["期限がある手続き", "家族の役割分担"],
  homeClearance: "",
  contactName: "実機確認",
  contactEmail: `handoff-smoke+${caseId.slice(0, 8)}@example.com`,
  consentToContact: false,
  consentToSensitiveInfo: true,
  consentTextVersion: "sensitive-info-v1"
};

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/cases/${caseId}/diagnosis`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(answers)
});

if (!response.ok) {
  fail(`diagnosis submit returned ${response.status}: ${await response.text()}`);
}

const body = await response.json();
const token = body?.record?.handoffToken;

if (body?.persisted !== true || body?.record?.id !== caseId || !token) {
  fail(`unexpected response: ${JSON.stringify(body)}`);
}

const appUrl = `oyanomoshimo://handoff?${new URLSearchParams({ caseId, token }).toString()}`;
const resultUrl = `${baseUrl}/result/${caseId}`;

console.log(`OK   created handoff smoke case: ${caseId}`);
console.log(`WEB  ${resultUrl}`);
console.log(`APP  ${appUrl}`);
