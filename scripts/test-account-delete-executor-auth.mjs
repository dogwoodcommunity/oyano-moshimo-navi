import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

function routeFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(fullPath);
    return entry.name === "route.ts" ? [path.relative(repoRoot, fullPath)] : [];
  });
}

const adminAuth = read("apps/web/lib/adminAuth.ts");
const genericVerifier = adminAuth.slice(
  adminAuth.indexOf("export async function verifyAdminRequest"),
  adminAuth.indexOf("export type VerifiedJwtAal")
);
const scopedVerifier = adminAuth.slice(
  adminAuth.indexOf("export async function verifyAccountDeleteOperatorRequest")
);

assert.match(genericVerifier, /verifySupabaseAppAdmin/, "generic Admin auth must retain app_admin verification");
assert.match(genericVerifier, /verifyStaticAdminToken/, "generic Admin auth must retain its emergency-token fallback");
assert.doesNotMatch(genericVerifier, /account_delete_executors/, "delete-only authority must not widen generic Admin auth");

assert.match(scopedVerifier, /authorization.*Bearer\\s\+/s, "delete-operator auth must require a Bearer header");
assert.match(scopedVerifier, /auth\.getUser\(bearerToken\)/, "the exact Bearer JWT must be validated by Supabase Auth");
assert.ok(
  scopedVerifier.indexOf("auth.getUser(bearerToken)") < scopedVerifier.indexOf("verifiedJwtAal(bearerToken)"),
  "AAL may only be read after the exact JWT is verified"
);
assert.match(scopedVerifier, /from\("app_admins"\)/, "existing app_admins must retain delete access");
assert.match(scopedVerifier, /from\("account_delete_executors"\)/, "the dedicated allowlist must be checked");
assert.match(scopedVerifier, /\.eq\("active", true\)/, "inactive delete executors must be rejected");
assert.match(scopedVerifier, /\.not\("activated_at", "is", null\)/, "unactivated delete executors must be rejected");
assert.match(scopedVerifier, /\.is\("revoked_at", null\)/, "revoked delete executors must be rejected");
assert.match(scopedVerifier, /supabase_account_delete_executor/, "the dedicated operator method must be explicit");
assert.doesNotMatch(scopedVerifier, /verifyStaticAdminToken|ADMIN_ACCESS_TOKEN|x-admin-token/, "static tokens must never enter scoped auth");

const apiDirectory = path.join(repoRoot, "apps/web/app/api/admin");
const allAdminRoutes = routeFiles(apiDirectory).sort();
const scopedRoutes = allAdminRoutes.filter((routePath) => routePath.includes("/delete-requests/"));
const genericRoutes = allAdminRoutes.filter((routePath) => !routePath.includes("/delete-requests/"));

assert.deepEqual(scopedRoutes, [
  "apps/web/app/api/admin/delete-requests/auth-status/route.ts",
  "apps/web/app/api/admin/delete-requests/execute/route.ts",
  "apps/web/app/api/admin/delete-requests/route.ts"
], "the complete delete-request API surface must be enumerated by this regression");
for (const routePath of scopedRoutes) {
  const source = read(routePath);
  assert.match(source, /verifyAccountDeleteOperatorRequest/, `${routePath} must use scoped deletion auth`);
  assert.doesNotMatch(source, /\bverifyAdminRequest\b/, `${routePath} must not fall back to generic Admin auth`);
}
for (const routePath of genericRoutes) {
  const source = read(routePath);
  assert.match(source, /\bverifyAdminRequest\b/, `${routePath} must retain generic Admin auth`);
  assert.doesNotMatch(source, /verifyAccountDeleteOperatorRequest/, `${routePath} must reject delete-only authority`);
}

const deleteRoute = read("apps/web/app/api/admin/delete-requests/route.ts");
const executeRoute = read("apps/web/app/api/admin/delete-requests/execute/route.ts");
const authStatusRoute = read("apps/web/app/api/admin/delete-requests/auth-status/route.ts");
assert.match(deleteRoute, /"reviewing",\s*"needs_followup"/s, "PATCH must allow only operational non-completion statuses");
assert.doesNotMatch(deleteRoute.match(/const allowedStatuses[\s\S]*?\]\);/)?.[0] ?? "", /requested|completed/, "PATCH must not reopen or falsely complete a request");
assert.match(deleteRoute, /rpc\("update_account_delete_request_status_v1"/, "PATCH must use the atomic authorization/audit RPC");
assert.doesNotMatch(deleteRoute, /\.from\("audit_logs"\)|\.update\(\{/, "PATCH must not split direct DML from its audit event");
assert.match(deleteRoute, /Cache-Control": "no-store"/, "delete-request PII responses must not be cached");
assert.match(deleteRoute, /uuidPattern\.test\(body\.id\)/, "PATCH must reject malformed request ids before invoking PostgREST");
assert.match(deleteRoute, /note\.length > 2000/, "PATCH must reject oversized notes before invoking the RPC");

assert.match(executeRoute, /action === "execute"[\s\S]*?auth\.admin\.aal !== "aal2"/, "only actual execution must require AAL2");
assert.ok(
  executeRoute.indexOf('auth.admin.aal !== "aal2"') < executeRoute.indexOf('"prepare_account_erasure_v1"'),
  "AAL2 must be enforced before execution creates a durable prepared job"
);
assert.match(executeRoute, /action === "preflight"\s*\? "inspect_account_erasure_v1"/, "AAL1 must retain read-only preflight");
assert.match(executeRoute, /requiresAal2: auth\.admin\.aal !== "aal2"/, "preflight must tell the UI when step-up is required");
assert.doesNotMatch(executeRoute, /nextLevel/, "next possible AAL must never authorize destructive execution");
assert.match(authStatusRoute, /aal: auth\.admin\.aal/, "dedicated auth status must report the verified JWT AAL");
assert.match(authStatusRoute, /Cache-Control": "no-store"/, "operator identity responses must not be cached");

const adminClientAuth = read("apps/web/lib/adminClientAuth.ts");
const deleteClient = read("apps/web/components/AdminDeleteRequests.tsx");
const tokenControl = read("apps/web/components/AdminTokenControl.tsx");
const deletePage = read("apps/web/app/admin/delete-requests/page.tsx");
const browserSupabase = read("apps/web/lib/browserSupabase.ts");
const adminNav = read("apps/web/components/AdminNav.tsx");

assert.match(adminClientAuth, /export function adminBearerHeaders/, "a Bearer-only client helper must exist");
assert.match(deleteClient, /adminBearerHeaders\(\)/, "delete operations must send only the Bearer token");
assert.doesNotMatch(deleteClient, /\badminHeaders\(/, "delete operations must never fall back to the static token");
assert.match(deleteClient, /addEventListener\("admin-auth-changed"/, "delete requests must reload after auth changes");
assert.match(deleteClient, /setErasureChecks\(\{\}\)/, "auth changes must invalidate prior preflight approval");
assert.match(deleteClient, /loadRequestId\.current \+= 1/, "auth changes must invalidate in-flight PII responses");

assert.match(tokenControl, /authEndpoint = "\/api\/admin\/auth-status"/, "generic Admin auth endpoint must remain the default");
assert.match(tokenControl, /showEmergencyToken = true/, "generic Admin emergency access must remain the default");
assert.match(tokenControl, /showEmergencyToken \? \(/, "emergency-token UI must be suppressible");
assert.match(tokenControl, /mfa\.listFactors\(\)/, "dedicated auth must list enrolled factors before step-up");
assert.match(tokenControl, /factor\.status === "verified"/, "only verified TOTP factors may be offered");
assert.match(tokenControl, /mfa\.challengeAndVerify/, "an enrolled TOTP factor must support AAL2 step-up");
assert.match(tokenControl, /const requestId = \+\+verifyRequestId\.current;[\s\S]*?mfa\.challengeAndVerify[\s\S]*?requestId !== verifyRequestId\.current/, "logout or a newer auth check must invalidate an in-flight MFA response");
assert.match(tokenControl, /event === "TOKEN_REFRESHED" && session\?\.access_token/, "only an expected refresh event may replace the stored Bearer outside explicit MFA verification");
assert.match(tokenControl, /\^\\d\{6\}\$/, "TOTP input must require exactly six digits");
assert.match(tokenControl, /localStorage\.setItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY, data\.access_token\)/, "the AAL2 JWT must replace the client Bearer token");
const verifyStoredAccess = tokenControl.match(
  /const verifyStoredAccess = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/
)?.[0] ?? "";
assert.match(
  verifyStoredAccess,
  /const requestId = \+\+verifyRequestId\.current/,
  "every auth-status verification must claim a new request generation"
);
assert.ok(
  (verifyStoredAccess.match(/requestId !== verifyRequestId\.current/g) ?? []).length >= 3,
  "stale auth-status and factor responses must not commit authentication state"
);
const signOutControl = tokenControl.slice(
  tokenControl.indexOf("async function signOut"),
  tokenControl.indexOf("async function verifyMfaCode")
);
assert.ok(
  signOutControl.indexOf("verifyRequestId.current += 1") < signOutControl.indexOf("await getBrowserSupabase"),
  "sign-out must invalidate in-flight auth-status responses before awaiting network work"
);
assert.doesNotMatch(tokenControl, /mfa\.enroll|recovery/i, "this surface must not enroll factors or expose recovery material");

assert.match(deletePage, /authEndpoint="\/api\/admin\/delete-requests\/auth-status"/, "the deletion page must use dedicated auth status");
assert.match(deletePage, /redirectPath="\/admin\/delete-requests"/, "magic links must return to the deletion page");
assert.match(deletePage, /roleLabel="削除担当者"/, "the deletion page must identify its narrow role");
assert.match(deletePage, /showEmergencyToken=\{false\}/, "the deletion page must hide static-token access");
assert.match(deletePage, /enableMfaStepUp/, "the deletion page must allow enrolled-factor AAL2 step-up");
assert.match(browserSupabase, /redirectPath = "\/admin\/monitor-feedback"/, "generic magic-link behavior must remain the default");
assert.match(browserSupabase, /window\.location\.origin\}\$\{safeRedirectPath\}/, "the configured same-origin redirect must be used");
assert.match(adminNav, /deletionOnly \? \[deleteRequestItem\] : items/, "the deletion page must expose only its own navigation section");

console.log(`account delete executor auth tests passed (${scopedRoutes.length} scoped routes, ${genericRoutes.length} generic routes)`);
