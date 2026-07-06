const baseUrl = (process.argv[2] ?? process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const adminToken = process.env.ADMIN_ACCESS_TOKEN ?? "";

const checks = [
  { path: "/", label: "root redirect" },
  { path: "/home", label: "home" },
  { path: "/start", label: "start" },
  { path: "/guides", label: "guides" },
  { path: "/guides/hospitalized", label: "guide detail" },
  { path: "/checklists", label: "checklists" },
  { path: "/safety", label: "safety" },
  { path: "/plans", label: "plans" },
  { path: "/diagnosis", label: "diagnosis" },
  { path: "/result/smoke-case", label: "result fallback" },
  { path: "/result/smoke-case/share", label: "result share fallback" },
  { path: "/invite/smoke-token", label: "invite fallback" },
  { path: "/support-pack", label: "support pack" },
  { path: "/sitemap.xml", label: "sitemap" },
  { path: "/robots.txt", label: "robots" },
  { path: "/legal/privacy", label: "privacy" },
  { path: "/admin", label: "admin overview" },
  { path: "/admin/cases", label: "admin cases" },
  { path: "/admin/support-packs", label: "admin support packs" },
  { path: "/admin/delete-requests", label: "admin delete requests" },
  { path: "/api/health", label: "health api" },
  { path: "/api/account/delete-request", label: "account delete api requires auth", method: "POST", expectStatus: 401 },
  { path: "/api/admin/env-check", label: "admin env api", admin: true }
];

let failed = false;

for (const check of checks) {
  const headers = check.admin && adminToken ? { "x-admin-token": adminToken } : {};
  const response = await fetch(`${baseUrl}${check.path}`, { headers, method: check.method ?? "GET" });
  const ok = check.expectStatus ? response.status === check.expectStatus : response.status >= 200 && response.status < 400;

  if (!ok && check.admin && response.status === 401) {
    console.log(`SKIP ${check.label}: ${response.status} (set ADMIN_ACCESS_TOKEN to verify)`);
    continue;
  }

  if (!ok) {
    failed = true;
    const expected = check.expectStatus ? ` expected ${check.expectStatus}` : "";
    console.error(`FAIL ${check.label}: ${response.status}${expected} ${check.path}`);
    continue;
  }

  console.log(`OK   ${check.label}: ${response.status} ${check.path}`);
}

if (failed) {
  process.exit(1);
}
