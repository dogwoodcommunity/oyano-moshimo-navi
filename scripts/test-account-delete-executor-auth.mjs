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
const adminAuthPolicy = read("docs/ADMIN_AUTH_POLICY.md");
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
assert.match(
  genericVerifier,
  /appAdmin\.status === "not_admin"[\s\S]*?status: 403/,
  "a valid authenticated non-admin must be forbidden rather than reported as unauthenticated"
);
assert.match(
  genericVerifier,
  /appAdmin\.status === "unavailable"[\s\S]*?status: 503/,
  "an unavailable role check must fail closed without misreporting credentials"
);
assert.match(
  genericVerifier,
  /Admin authorization is required[\s\S]*?status: 401/,
  "missing or invalid credentials must remain unauthorized"
);
assert.ok(
  genericVerifier.indexOf("verifyStaticAdminToken(request)")
    < genericVerifier.indexOf('appAdmin.status === "not_admin"'),
  "a valid emergency token must remain usable even when an unrelated Bearer is not app_admin"
);
assert.match(
  adminAuthPolicy,
  /認証情報なし・無効な認証情報を401、本人確認済みだが `app_admins` にいないユーザーを403、role照合不能を503/,
  "the documented generic Admin response semantics must distinguish unauthenticated, forbidden, and unavailable checks"
);

assert.match(scopedVerifier, /authorization.*Bearer\\s\+/s, "delete-operator auth must require a Bearer header");
assert.match(scopedVerifier, /auth\.getUser\(bearerToken\)/, "the exact Bearer JWT must be validated by Supabase Auth");
assert.ok(
  scopedVerifier.indexOf("auth.getUser(bearerToken)") < scopedVerifier.indexOf("verifiedJwtAal(bearerToken)"),
  "AAL may only be read after the exact JWT is verified"
);
assert.match(
  scopedVerifier,
  /rpc\(\s*"verify_account_delete_operator_v2"/,
  "the current deployment must use the privacy-safe operator verifier"
);
assert.doesNotMatch(
  scopedVerifier,
  /from\("app_admins"\)|from\("account_delete_executors"\)/,
  "the Web verifier must not read raw authorization tables"
);
assert.match(
  scopedVerifier,
  /operator\?\.result === "authorized" && operator\.method === "supabase_app_admin"/,
  "existing app_admins must retain delete access only through an exact RPC result"
);
assert.match(
  scopedVerifier,
  /operator\?\.result === "authorized" && operator\.method === "supabase_account_delete_executor"/,
  "dedicated executors must be accepted only through an exact RPC result"
);
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
const executionGateSql = read("supabase/account_erasure_execution_gate.sql");
const erasurePipelineSql = read("supabase/account_deletion_pipeline.sql");
assert.match(deleteRoute, /"reviewing",\s*"needs_followup"/s, "PATCH must allow only operational non-completion statuses");
assert.doesNotMatch(deleteRoute.match(/const allowedStatuses[\s\S]*?\]\);/)?.[0] ?? "", /requested|completed/, "PATCH must not reopen or falsely complete a request");
assert.match(deleteRoute, /rpc\("update_account_delete_request_status_v2"/, "PATCH must use the current atomic authorization/audit RPC");
assert.doesNotMatch(deleteRoute, /rpc\("update_account_delete_request_status_v1"/, "the Web route must not leave the legacy AAL1 deployment write surface usable");
assert.doesNotMatch(deleteRoute, /\.from\("audit_logs"\)|\.update\(\{/, "PATCH must not split direct DML from its audit event");
assert.match(deleteRoute, /Cache-Control": "no-store"/, "delete-request PII responses must not be cached");
assert.match(deleteRoute, /operatorMethod: auth\.admin\.method/, "the scoped list must tell the UI which narrow role is active");
assert.match(
  deleteRoute,
  /includeRequestDetails = auth\.admin\.method === "supabase_app_admin"[\s\S]*?const requestColumns = includeRequestDetails[\s\S]*?contact_email[\s\S]*?: "id, user_id, status, due_at, handled_at, handled_by_method, created_at"/,
  "the deletion-only executor query must omit contact, reason, and handling-note PII"
);
assert.match(
  deleteRoute,
  /openStatuses[\s\S]*?"requested"[\s\S]*?"reviewing"[\s\S]*?"needs_followup"[\s\S]*?for \(let from = 0; ; from \+= openPageSize\)[\s\S]*?\.range\(from, from \+ openPageSize - 1\)/,
  "every unfinished deletion-request page must be loaded instead of being displaced by a fixed newest-100 cap"
);
assert.match(
  deleteRoute,
  /\.eq\("status", "completed"\)[\s\S]*?\.limit\(100\)/,
  "only completed deletion history may be limited to the newest 100 rows"
);
assert.match(
  deleteRoute,
  /\.\.\.\(includeRequestDetails \? \{[\s\S]*?contactEmail:[\s\S]*?reason:[\s\S]*?\} : \{\}\)/,
  "request contact details must only be serialized for app_admin"
);
assert.match(deleteRoute, /uuidPattern\.test\(body\.id\)/, "PATCH must reject malformed request ids before invoking PostgREST");
assert.match(deleteRoute, /note\.length > 2000/, "PATCH must reject oversized notes before invoking the RPC");
const patchHandler = deleteRoute.slice(deleteRoute.indexOf("export async function PATCH"));
assert.match(
  patchHandler,
  /auth\.admin\.aal !== "aal2"[\s\S]*?account_delete_status_aal2_required[\s\S]*?status: 403/,
  "status and handling-note writes must require AAL2"
);
assert.match(
  patchHandler,
  /auth\.admin\.method !== "supabase_app_admin"[\s\S]*?account_delete_status_app_admin_required[\s\S]*?status: 403/,
  "the deletion-only executor must not write request status or handling notes"
);

assert.match(
  executeRoute,
  /new Set\(\["preflight", "prepare", "approve", "grant-status", "execute"\]\)/,
  "the erasure API must expose the complete five-action workflow"
);
assert.match(
  executeRoute,
  /execution_control_already_granted[\s\S]*?別の削除依頼[\s\S]*?execution_control_already_granted/,
  "a one-shot control already bound to another request must produce a recoverable 409 explanation"
);
assert.match(
  executeRoute,
  /if \(action !== "preflight"\)[\s\S]*?auth\.admin\.aal !== "aal2"/,
  "only the read-only preflight may run at AAL1"
);
assert.match(
  executeRoute,
  /action !== "approve" && auth\.admin\.method !== "supabase_account_delete_executor"/,
  "durable preparation, grant checks, and execution must stay deletion-executor-only"
);
assert.match(
  executeRoute,
  /if \(action === "approve"\)[\s\S]*?auth\.admin\.method !== "supabase_app_admin"/,
  "approval must require a separately authenticated app_admin"
);
assert.match(
  executeRoute,
  /p_approver_user_id: auth\.admin\.userId/,
  "the approver identity must come from the verified Bearer JWT"
);
assert.match(
  executionGateSql,
  /p_operator_user_id = p_approver_user_id[\s\S]*?separate_approver_required/,
  "the database must reject self-approval"
);
assert.match(
  executionGateSql,
  /record_kind = 'activation_approved'[\s\S]*?operator_user_id = p_operator_user_id[\s\S]*?approver_user_id = p_approver_user_id/,
  "approval must be limited to the registered separate checker"
);
assert.match(
  executionGateSql,
  /create table if not exists account_delete_private\.account_erasure_execution_control[\s\S]*?enabled_until <= opened_at \+ interval '15 minutes'/,
  "the immutable deployment switch must be backed by a maximum-15-minute database control"
);
assert.match(
  executionGateSql,
  /account_erasure_execution_grants[\s\S]*?control_epoch uuid not null/,
  "every grant must be bound to the current database-control epoch"
);
assert.match(
  executionGateSql,
  /alter table account_delete_private\.account_erasure_execution_control enable row level security;[\s\S]*?force row level security;/,
  "the owner-only execution control must force RLS"
);
assert.match(
  executionGateSql,
  /v_control\.enabled_until <= v_now[\s\S]*?execution_control_disabled/,
  "a closed or expired database control must reject approval and execution"
);
assert.match(
  executionGateSql,
  /approval\.control_epoch = v_control\.epoch[\s\S]*?approval\.expires_at > clock_timestamp\(\)/,
  "execution must use an unexpired grant from the currently locked control epoch"
);
assert.match(
  executionGateSql,
  /set consumed_at = v_now,[\s\S]*?consumed_by_hash = v_operator_hash[\s\S]*?account_erasure_execution_control control[\s\S]*?set consumed_at = v_now/,
  "one successful database erasure must consume both its grant and one-shot control"
);
assert.match(
  executionGateSql,
  /revoke all on function public\.execute_account_erasure_database_v1\(uuid, uuid, uuid\)[\s\S]*?grant execute on function public\.execute_account_erasure_database_v2/,
  "old ON deployments must lose direct v1 authority before v2 is granted"
);
assert.doesNotMatch(
  erasurePipelineSql,
  /grant execute on function (?:inspect|prepare)_account_erasure_v1\(uuid, uuid, uuid\) to service_role/,
  "reapplying the base pipeline must not reopen privacy-unsafe v1 operator responses"
);

const preflightStart = executeRoute.indexOf('if (action === "preflight")');
const prepareStart = executeRoute.indexOf('if (action === "prepare") {', preflightStart + 1);
const destructiveStart = executeRoute.indexOf('const { data: databaseData');
assert.ok(preflightStart >= 0 && prepareStart > preflightStart && destructiveStart > prepareStart, "the route must keep inspection, preparation, and destructive execution as ordered branches");
const preflightPath = executeRoute.slice(preflightStart, prepareStart);
const preparePath = executeRoute.slice(prepareStart, destructiveStart);
const executePath = executeRoute.slice(destructiveStart);
assert.match(preflightPath, /rpc\("inspect_account_erasure_v2"/, "AAL1 preflight must use the privacy-safe read-only inspection RPC");
assert.doesNotMatch(preflightPath, /inspect_account_erasure_v1|prepare_account_erasure_v[12]|execute_account_erasure_database|deleteUser|removeAndVerifyStorage/, "preflight must not use legacy raw responses, reserve, delete, or alter the target account");
assert.match(preparePath, /rpc\("prepare_account_erasure_v2"/, "AAL2 preparation must use the privacy-safe durable job RPC");
assert.doesNotMatch(preparePath, /execute_account_erasure_database|deleteUser|removeAndVerifyStorage/, "preparation must return before any irreversible deletion");
assert.doesNotMatch(executePath, /prepare_account_erasure_v[12]/, "execution must never silently refresh the reviewed job");
assert.match(
  executeRoute,
  /\(action === "approve" \|\| action === "grant-status" \|\| action === "execute"\)[\s\S]*?uuidPattern\.test\(expectedJobId\)[\s\S]*?manifestPattern\.test\(expectedManifestHash\)/,
  "approval, grant checks, and execution must require the exact durable job and manifest"
);
assert.match(executeRoute, /rpc\("issue_account_erasure_execution_grant_v1"/, "approval must issue the short-lived database grant");
assert.match(executeRoute, /rpc\("inspect_account_erasure_execution_grant_v1"/, "the executor must be able to check the exact grant without deleting");
assert.match(executeRoute, /rpc\("execute_account_erasure_database_v2"/, "execution must use the exact-job, exact-manifest v2 gate");
assert.doesNotMatch(executeRoute, /rpc\("execute_account_erasure_database_v1"/, "the Web route must not bypass v2 with the legacy destructive RPC");
assert.match(executeRoute, /function clientRpcResult[\s\S]*?const safe:[\s\S]*?result: result\.result/, "all database results must pass through a client-safe allowlist");
assert.match(executeRoute, /firstBlockedCode[\s\S]*?safe\.code = code/, "blocker responses may expose only a normalized reason code");
assert.doesNotMatch(
  executeRoute,
  /return jsonError\([\s\S]{0,500}?\{ result \}\s*\)/,
  "failure responses must not return raw blocker details, family names, or storage paths"
);
assert.ok(
  (executeRoute.match(/result: clientRpcResult\(/g) ?? []).length >= 7,
  "every success, retry, grant, and failure result returned to the browser must be sanitized"
);
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
assert.match(deleteClient, /hasPendingAuthCallback\(\)[\s\S]*?loadDeleteRequests\(\)/, "delete-request PII must wait while an auth callback is being validated");
assert.match(deleteClient, /setErasureChecks\(\{\}\)/, "auth changes must invalidate prior preflight approval");
for (const setter of [
  "setErasureUserIds",
  "setErasurePreparePhrases",
  "setErasurePhrases",
  "setApprovalJobIds",
  "setApprovalManifestHashes",
  "setApprovalPhrases"
]) {
  assert.match(
    deleteClient,
    new RegExp(`${setter}\\(\\{\\}\\)`),
    `${setter} must be cleared when the authenticated operator changes`
  );
}
assert.match(
  deleteClient,
  /action: "preflight" \| "prepare" \| "approve" \| "grant-status" \| "execute"/,
  "the UI must model the same five actions as the server"
);
assert.match(deleteClient, /expectedJobId,\s*expectedManifestHash/, "the UI must send the exact durable evidence for review and execution");
assert.match(deleteClient, /operatorMethod === "supabase_account_delete_executor"[\s\S]*?2\. 削除対象を確定する/, "only the dedicated executor UI may offer durable preparation");
assert.match(deleteClient, /operatorMethod === "supabase_app_admin" && isLivePreparedJob[\s\S]*?3\. 別担当者が実行を許可/, "only the separate app_admin UI may offer approval");
assert.match(
  deleteClient,
  /operatorMethod === "supabase_app_admin" \? <th>contact<\/th>[\s\S]*?operatorMethod === "supabase_app_admin" \? <th>reason<\/th>/,
  "the deletion-only executor UI must not render contact or reason columns"
);
assert.match(
  deleteClient,
  /operatorMethod === "supabase_app_admin" \? \([\s\S]*?aria-label="処理メモ"[\s\S]*?updateStatus\(item\.id, "reviewing"\)/,
  "handling notes and status controls must remain hidden from the deletion-only executor UI"
);
assert.match(deleteClient, /loadRequestId\.current \+= 1/, "auth changes must invalidate in-flight PII responses");

assert.match(tokenControl, /authEndpoint = "\/api\/admin\/auth-status"/, "generic Admin auth endpoint must remain the default");
assert.match(tokenControl, /showEmergencyToken = true/, "generic Admin emergency access must remain the default");
assert.match(tokenControl, /showEmergencyToken \? \(/, "emergency-token UI must be suppressible");
assert.match(tokenControl, /mfa\.listFactors\(\)/, "dedicated auth must list enrolled factors before step-up");
assert.match(tokenControl, /factor\.status === "verified"/, "only verified TOTP factors may be offered");
assert.match(tokenControl, /mfa\.challengeAndVerify/, "an enrolled TOTP factor must support AAL2 step-up");
assert.match(tokenControl, /const requestId = \+\+verifyRequestId\.current;[\s\S]*?mfa\.challengeAndVerify[\s\S]*?requestId !== verifyRequestId\.current/, "logout or a newer auth check must invalidate an in-flight MFA response");
assert.match(tokenControl, /hasSupabaseAuthCallbackInLocation\(\)[\s\S]*?invalidateDisplayedAccess\("checking"\)[\s\S]*?completeBrowserSupabaseAuthFromUrl\(\)/, "a callback must hide old operator data and remove its bearer before async validation");
assert.match(tokenControl, /event === "SIGNED_OUT" \|\| !session\?\.access_token[\s\S]*?invalidateDisplayedAccess\("signed-out"\)/, "signed-out and empty auth events must invalidate shown PII");
assert.match(tokenControl, /mfaChallengePending\.current[\s\S]*?MFA_CHALLENGE_VERIFIED[\s\S]*?TOKEN_REFRESHED/, "the local MFA challenge must own its token publication path");
assert.match(tokenControl, /invalidateDisplayedAccess\("checking"\)[\s\S]*?setItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY, session\.access_token\)[\s\S]*?verifyStoredAccess\(\)/, "all external signed-in or refreshed sessions must clear stale UI and pass server authorization again");
assert.match(tokenControl, /addEventListener\("storage", handleBearerStorageChange\)/, "cross-tab bearer changes must invalidate stale deletion data");
assert.match(tokenControl, /<form[\s\S]*?className="admin-auth-form"[\s\S]*?onSubmit=[\s\S]*?void sendLink\(\)/, "the initial email flow must submit as a form for Enter and mobile keyboard completion");
assert.match(tokenControl, /id="admin-email"[\s\S]*?type="email"[\s\S]*?enterKeyHint="send"[\s\S]*?aria-describedby=\{emailError \? "admin-email-error" : undefined\}[\s\S]*?aria-invalid=\{Boolean\(emailError\) \|\| undefined\}[\s\S]*?ref=\{emailInputRef\}[\s\S]*?required/, "the email field must expose mobile completion, required email semantics, and its error relationship");
assert.match(tokenControl, /showEmailError[\s\S]*?emailInputRef\.current\?\.focus/, "email validation and send errors must return focus to the email field");
assert.match(tokenControl, /id=\{emailError \? "admin-email-error" : undefined\}[\s\S]*?role=\{emailError \? "alert" : undefined\}/, "email errors must be announced as an alert");
assert.match(tokenControl, /<button className="button" type="submit" disabled=\{sending\}>/, "the email action must be the form submit button");
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
  signOutControl.indexOf("verifyRequestId.current += 1") < signOutControl.indexOf("await client.auth.signOut"),
  "sign-out must invalidate in-flight auth-status responses before awaiting network work"
);
assert.match(signOutControl, /auth\.signOut\(\{ scope: "local" \}\)/, "operator logout must not revoke unrelated sessions");
assert.match(signOutControl, /signOutFailed[\s\S]*?ログアウト完了を確認できませんでした[\s\S]*?return;/, "a failed sign-out must never claim success");
assert.ok(
  signOutControl.indexOf("removeItem(ADMIN_BEARER_TOKEN_STORAGE_KEY)") < signOutControl.indexOf("await client.auth.signOut"),
  "operator PII access must be removed before waiting for sign-out"
);
assert.doesNotMatch(tokenControl, /mfa\.enroll|recovery/i, "this surface must not enroll factors or expose recovery material");

assert.match(deletePage, /authEndpoint="\/api\/admin\/delete-requests\/auth-status"/, "the deletion page must use dedicated auth status");
assert.match(deletePage, /redirectPath="\/admin\/delete-requests"/, "magic links must return to the deletion page");
assert.match(deletePage, /roleLabel="削除担当者"/, "the deletion page must identify its narrow role");
assert.match(deletePage, /showEmergencyToken=\{false\}/, "the deletion page must hide static-token access");
assert.match(deletePage, /enableMfaStepUp/, "the deletion page must allow enrolled-factor AAL2 step-up");
assert.match(browserSupabase, /redirectPath = "\/admin\/monitor-feedback"/, "generic magic-link behavior must remain the default");
assert.match(browserSupabase, /window\.location\.origin\}\$\{safeRedirectPath\}/, "the configured same-origin redirect must be used");
assert.match(adminNav, /deletionSetup[\s\S]*?\? \[deleteRequestSetupItem\][\s\S]*?: deletionOnly[\s\S]*?\? \[deleteRequestItem\][\s\S]*?: items/, "deletion and setup pages must each expose only their own navigation section");

console.log(`account delete executor auth tests passed (${scopedRoutes.length} scoped routes, ${genericRoutes.length} generic routes)`);
