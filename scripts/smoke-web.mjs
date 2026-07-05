const baseUrl = (process.argv[2] ?? process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const adminToken = process.env.ADMIN_ACCESS_TOKEN ?? "";

const checks = [
  { path: "/", label: "home" },
  { path: "/start", label: "start" },
  { path: "/diagnosis", label: "diagnosis" },
  { path: "/support-pack", label: "support pack" },
  { path: "/legal/privacy", label: "privacy" },
  { path: "/api/health", label: "health api" },
  { path: "/api/admin/env-check", label: "admin env api", admin: true }
];

let failed = false;

for (const check of checks) {
  const headers = check.admin && adminToken ? { "x-admin-token": adminToken } : {};
  const response = await fetch(`${baseUrl}${check.path}`, { headers });
  const ok = response.status >= 200 && response.status < 400;

  if (!ok && check.admin && response.status === 401) {
    console.log(`SKIP ${check.label}: ${response.status} (set ADMIN_ACCESS_TOKEN to verify)`);
    continue;
  }

  if (!ok) {
    failed = true;
    console.error(`FAIL ${check.label}: ${response.status} ${check.path}`);
    continue;
  }

  console.log(`OK   ${check.label}: ${response.status} ${check.path}`);
}

if (failed) {
  process.exit(1);
}

