import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const page = read("apps/web/app/admin/delete-requests/setup/page.tsx");
const setup = read("apps/web/components/DeleteOperatorMfaSetup.tsx");
const tokenControl = read("apps/web/components/AdminTokenControl.tsx");
const adminNav = read("apps/web/components/AdminNav.tsx");
const browserSupabase = read("apps/web/lib/browserSupabase.ts");
const styles = read("apps/web/app/globals.css");

assert.match(page, /DeleteOperatorMfaSetup/, "the setup route must render the dedicated client control");
assert.doesNotMatch(page, /AdminDeleteRequests/, "pre-role setup must never render deletion requests");
assert.match(page, /利用者から届いた完全削除申請/, "the page must distinguish customer requests from deleting the operator account");
assert.match(page, /QRコードや6桁の数字は、運営者にも送らない/, "the page must warn against sharing MFA material");
assert.match(adminNav, /deleteRequestSetupItem = \{ href: "\/admin\/delete-requests\/setup", label: "本人確認設定" \}/, "setup must have a non-operational navigation label");
assert.match(adminNav, /deletionSetup \? deleteRequestSetupItem\.href/, "the setup brand link must not lead an unprivileged user into deletion requests");

assert.match(setup, /completeBrowserSupabaseAuthFromUrl\(\)/, "the setup route must complete the same-origin magic-link callback");
assert.match(setup, /sendAdminMagicLink\(nextEmail, setupRedirectPath\)/, "setup login must use the existing-user-only admin magic link");
assert.match(setup, /const setupRedirectPath = "\/admin\/delete-requests\/setup"/, "the magic link must return to the setup route");
assert.match(setup, /client\.auth\.getUser\(\)/, "the live Supabase user must be revalidated before enrollment");
assert.match(setup, /user\.email_confirmed_at/, "unconfirmed email identities must not enroll MFA");
assert.ok(
  setup.indexOf("client.auth.getUser()") < setup.indexOf("client.auth.mfa.listFactors()"),
  "identity verification must precede factor discovery"
);

assert.match(setup, /function collectTotpFactors[\s\S]*?factor_type === "totp" && factor\.status === "verified"/, "verified TOTP must be derived from the complete factor list");
assert.match(setup, /function collectTotpFactors[\s\S]*?factor_type === "totp" && factor\.status === "unverified"/, "unfinished TOTP must be derived from the complete factor list");
assert.match(setup, /beginTotpEnrollmentUsingAal1Token\(\{[\s\S]*?accessToken: enrollmentAccessToken[\s\S]*?expectedUserId: enrollmentUserId/, "the dedicated route must bind enrollment to the exact validated identity token");
assert.match(setup, /getSession\(\)[\s\S]*?candidateAccessToken[\s\S]*?getAuthenticatorAssuranceLevel\(candidateAccessToken\)[\s\S]*?currentLevel === "aal2"[\s\S]*?setItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY, candidateAccessToken\)/, "an existing factor must bind current AAL2 verification to the exact token it publishes");
assert.match(setup, /verified\.length > 1[\s\S]*?setSetupState\("blocked"\)/, "multiple verified factors must block handoff");
assert.match(setup, /unverifiedFactors\.length > 0[\s\S]*?未完了/, "an abandoned factor must block a new enrollment until explicit cleanup");

const callbackFailureIndex = setup.indexOf("if (callbackFailed || (!result.handled && previousCallbackFailed))");
const callbackFailureEnd = setup.indexOf("if (result.handled && result.session)", callbackFailureIndex);
const callbackFailureBranch = setup.slice(callbackFailureIndex, callbackFailureEnd);
assert.ok(callbackFailureIndex >= 0 && callbackFailureEnd > callbackFailureIndex, "callback failure branch must exist");
assert.match(callbackFailureBranch, /removeItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY\)/, "failed callbacks must clear the old admin bearer");
assert.match(callbackFailureBranch, /return;/, "failed callbacks must stop before identity fallback");
const initializeStart = setup.indexOf("async function initialize()");
const callbackAwait = setup.indexOf("await withSetupTimeout(completeBrowserSupabaseAuthFromUrl())", initializeStart);
const initializeBeforeCallback = setup.slice(initializeStart, callbackAwait);
assert.match(initializeBeforeCallback, /removeItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY\)/, "mount must synchronously clear any old operator bearer before callback work");
assert.match(setup, /const setupOperationTimeoutMs = 12_000/, "setup auth operations must have a finite wait limit");
assert.match(setup, /withSetupTimeout\(completeBrowserSupabaseAuthFromUrl\(\)\)[\s\S]*?catch[\s\S]*?確認リンクの読み込みに時間がかかっています/, "callback timeout or rejection must leave checking state with a retryable error");
assert.match(setup, /withSetupTimeout\(loadIdentityAndFactors\(initialMessage\)\)[\s\S]*?catch[\s\S]*?本人確認の状態確認に時間がかかっています/, "identity loading must leave checking state after a finite timeout");

const subjectSwitchStart = setup.indexOf("if (nextUserId !== activeUserId.current)");
const subjectSwitchEnd = setup.indexOf("} else if (", subjectSwitchStart);
const subjectSwitch = setup.slice(subjectSwitchStart, subjectSwitchEnd);
assert.match(subjectSwitch, /removeItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY\)[\s\S]*?clearSensitiveState\(\)[\s\S]*?loadIdentityWithTimeout\(\)/, "a changed auth subject must synchronously drop the bearer, clear secrets, and reload identity");
const authListenerStart = setup.indexOf("const authListener = client?.auth.onAuthStateChange");
const authListenerEnd = setup.indexOf("return () => {", authListenerStart);
const authListener = setup.slice(authListenerStart, authListenerEnd);
assert.doesNotMatch(
  authListener,
  /localStorage\.setItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY/,
  "auth events must not copy an unvalidated AAL1 token into the shared admin bearer"
);
assert.match(authListener, /mfaVerificationInFlight\.current[\s\S]*?MFA_CHALLENGE_VERIFIED[\s\S]*?TOKEN_REFRESHED/, "MFA challenge events must defer to the strict post-challenge checks");
assert.match(authListener, /mfaAuthEventTokenDuringVerification\.current = session\.access_token/, "a concurrent challenge token must be captured for post-verification comparison");
assert.match(authListener, /TOKEN_REFRESHED[\s\S]*?enrollmentPendingRef\.current/, "a routine refresh may preserve an unfinished one-time enrollment secret");
assert.match(authListener, /本人確認の状態が変わったため[\s\S]*?loadIdentityWithTimeout\(\)/, "same-subject auth changes must clear and reload stale AAL/factor state");

assert.doesNotMatch(setup, /mfa\.unenroll/, "the setup page must not use the mutable current session to delete MFA factors");
assert.match(setup, /beginTotpEnrollmentUsingAal1Token\(\{[\s\S]*?friendlyName: `\$\{operatorFactorLabel\} \$\{Date\.now\(\)\}`/, "each enrollment must use a unique factor name for safe retry");
assert.match(setup, /async function cancelEnrollment[\s\S]*?const cleanupContext = pendingEnrollmentContextRef\.current[\s\S]*?clearSensitiveState\(\)[\s\S]*?removeUnverifiedTotpFactorUsingAal1Token\(cleanupContext\)[\s\S]*?loadIdentityWithTimeout/, "cancel must remove secrets first and clean only the enrollment context created by this screen");
assert.match(setup, /この画面では自動削除せず、新しい登録を始めます/, "unfinished factors must be explained without hidden destructive cleanup");

const verificationStart = setup.indexOf("async function verifyFactor");
const verificationEnd = setup.indexOf("async function verifyEnrollment", verificationStart);
const verification = setup.slice(verificationStart, verificationEnd);
assert.match(verification, /auth\.mfa\.challengeAndVerify\(\{ factorId, code \}\)/, "the six-digit code must verify the selected factor");
assert.ok(
  verification.indexOf("clearSensitiveState();") < verification.indexOf("client.auth.mfa.listFactors()"),
  "a successful challenge must clear the QR and secret before fallible verification reads"
);
assert.match(verification, /sameVerifiedFactor[\s\S]*?verified\.length !== 1/, "completion must require the exact factor and exactly one live verified TOTP");
assert.match(verification, /assuranceData\.currentLevel !== "aal2"/, "only current AAL2 may complete setup");
assert.match(verification, /getAuthenticatorAssuranceLevel\(data\.access_token\)/, "post-challenge AAL verification must use the exact returned token");
assert.match(verification, /mfaAuthEventTokenDuringVerification\.current !== data\.access_token[\s\S]*?return;/, "a different concurrent auth token must stop completion");
assert.doesNotMatch(setup, /nextLevel/, "the possible next AAL must never count as completed MFA");
assert.match(setup, /!\/\^\\d\{6\}\$\/\.test\(code\)/, "verification input must require exactly six digits");
assert.match(setup, /replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/, "non-digits and excess characters must be removed");

const bearerWrite = verification.indexOf("window.localStorage.setItem(ADMIN_BEARER_TOKEN_STORAGE_KEY, data.access_token)");
const exactCountCheck = verification.indexOf("verified.length !== 1");
assert.ok(bearerWrite > exactCountCheck, "the AAL2 Bearer may be stored only after exact live factor validation");
assert.equal((setup.match(/localStorage\.setItem\(ADMIN_BEARER_TOKEN_STORAGE_KEY/g) ?? []).length, 2, "the shared bearer may be written only by the two explicit current-AAL2 validation paths");
assert.match(setup, /type=\{showSecret \? "text" : "password"\}/, "manual TOTP secret must be masked by default");
const copyStart = setup.indexOf("async function copyManualSecret");
const copyEnd = setup.indexOf("async function signOut", copyStart);
const copySecret = setup.slice(copyStart, copyEnd);
assert.match(copySecret, /const requestId = requestGeneration\.current[\s\S]*?const secret = pendingEnrollment\.secret[\s\S]*?navigator\.clipboard\.writeText\(secret\)/, "same-phone copy must capture the current request and secret explicitly");
assert.match(copySecret, /requestId !== requestGeneration\.current \|\| !enrollmentPendingRef\.current[\s\S]*?navigator\.clipboard\.writeText\("認証設定は取り消されました"\)/, "a stale clipboard write must be detected and overwritten best-effort");
assert.match(copySecret, /setShowSecret\(true\)[\s\S]*?"error", "secret"/, "copy failure must reveal the manual secret and focus that field");
assert.match(setup, /id="operator-mfa-secret"[\s\S]*?ref=\{manualSecretInputRef\}/, "the revealed manual secret must be a focus target");
assert.match(setup, /このスマホだけで設定する場合/, "same-phone setup must be explained");
assert.match(setup, /アカウント名[\s\S]*?親のもしもナビ 削除担当[\s\S]*?キーの種類[\s\S]*?時間ベース/, "manual setup must name the account and time-based key type");
assert.match(setup, /約30秒ごとに変わります/, "the changing six-digit code must be explained");
assert.match(setup, /<form[\s\S]*?type="email"[\s\S]*?required[\s\S]*?type="submit"/, "email entry must support browser validation and Enter submission");
assert.equal((setup.match(/onSubmit=/g) ?? []).length, 3, "email, existing-factor, and enrollment verification must all support Enter submission");
assert.match(setup, /ref=\{emailInputRef\}/, "email errors must return focus to the email input");
assert.match(setup, /ref=\{existingCodeInputRef\}/, "existing-factor errors must return focus to the code input");
assert.match(setup, /ref=\{enrollmentCodeInputRef\}/, "enrollment errors must return focus to the code input");
assert.match(setup, /role=\{messageTone === "error" \? "alert" : "status"\}/, "errors and status updates must be announced");
assert.match(styles, /\.admin-mfa-setup \.button:disabled[\s\S]*?cursor: not-allowed/, "disabled setup actions must look unavailable");
assert.match(styles, /\.admin-auth-card \.secondary:disabled[\s\S]*?cursor: not-allowed/, "disabled operational MFA actions must look unavailable");
assert.match(styles, /\.admin-mfa-setup :is\(button, a, input, summary\):focus-visible/, "interactive setup controls must have a visible keyboard focus");

const signOutStart = setup.indexOf("async function signOut");
const signOutEnd = setup.indexOf("const statusMessage", signOutStart);
const signOut = setup.slice(signOutStart, signOutEnd);
assert.match(signOut, /auth\.signOut\(\{ scope: "local" \}\)/, "setup logout must end only the local auth session");
assert.doesNotMatch(signOut, /listFactors|unenroll/, "logout must not silently delete an MFA factor created in another tab");

assert.match(setup, /<img[\s\S]*?src=\{pendingEnrollment\.qrCode\}[\s\S]*?alt="認証アプリ登録用QRコード"/, "the QR code must render as an image without embedding its URI in alt text");
assert.doesNotMatch(setup, /dangerouslySetInnerHTML/, "QR SVG must never be injected as HTML");
assert.doesNotMatch(setup, /console\.|JSON\.stringify|sessionStorage/, "MFA setup material must not enter logs or browser session storage");
assert.doesNotMatch(setup, /setItem\([^\n]*(?:secret|qrCode|verificationCode)/, "QR, secret, and OTP must not enter localStorage");

assert.doesNotMatch(setup, /account_delete_executors|app_admins|service_role|SUPABASE_SERVICE_ROLE_KEY|\.from\(["']|\.rpc\(["']|fetch\(/, "MFA setup must not query data tables, call privileged APIs, or grant roles");
assert.match(setup, /この設定だけでは削除権限は付きません/, "the UI must clearly separate MFA enrollment from role grant");
assert.match(setup, /まだ削除担当権限は付いていません/, "successful MFA must remain a role-pending state");

assert.match(tokenControl, /href="\/admin\/delete-requests\/setup"/, "the role-gated page must link denied and factorless users to setup");
assert.doesNotMatch(tokenControl, /mfa\.enroll/, "the operational deletion screen must remain enrollment-free");
assert.match(tokenControl, /className="admin-mfa-challenge-form"[\s\S]*?onSubmit=[\s\S]*?type="submit"/, "operational MFA verification must support the Enter key");
assert.match(tokenControl, /id="admin-mfa-code-help"[\s\S]*?約30秒ごとに変わります/, "operational MFA must explain rotating codes");
assert.match(tokenControl, /id="admin-mfa-error" role="alert"/, "operational MFA errors must be announced and linked to the field");
assert.match(browserSupabase, /callbackError \|\| callbackErrorCode \|\| callbackErrorDescription[\s\S]*?stripAuthParamsFromUrl\(url\)/, "error callbacks must be rejected and stripped");
assert.match(browserSupabase, /function clearBrowserSupabaseLocalSession[\s\S]*?localStorage\.removeItem\(storageKey\)/, "failed callbacks must synchronously remove the stored Supabase session");
assert.match(browserSupabase, /async function clearSessionAfterAuthCallbackFailure[\s\S]*?signOut\(\{ scope: "local" \}\)/, "failed callbacks must also stop the active local auth session");
assert.match(browserSupabase, /url\.searchParams\.delete\("error_description"\)/, "error descriptions must not remain in browser history");
assert.match(browserSupabase, /if \(!accessToken \|\| !refreshToken\)[\s\S]*?stripAuthParamsFromUrl\(url\)/, "partial implicit callbacks must be rejected and stripped");
const cleanupStart = browserSupabase.indexOf("export async function removeUnverifiedTotpFactorUsingAal1Token");
const cleanupEnd = browserSupabase.indexOf("/**", cleanupStart);
const cleanup = browserSupabase.slice(cleanupStart, cleanupEnd);
assert.match(cleanup, /getAuthenticatorAssuranceLevel\(input\.accessToken\)[\s\S]*?currentLevel !== "aal1"/, "factor cleanup must remain bound to the captured AAL1 token");
assert.match(cleanup, /getUser\(input\.accessToken\)[\s\S]*?user\.id !== input\.expectedUserId/, "factor cleanup must verify the exact expected Auth subject");
assert.match(cleanup, /candidate\.id === input\.factorId[\s\S]*?factor\.status !== "unverified"[\s\S]*?return "protected"/, "factor cleanup must stop if the captured factor became verified");
assert.match(cleanup, /Authorization: `Bearer \$\{input\.accessToken\}`/, "the DELETE request must use the captured AAL1 token rather than a mutable current session");

const enrollStart = browserSupabase.indexOf("export async function beginTotpEnrollmentUsingAal1Token");
const enrollEnd = browserSupabase.indexOf("export async function removeUnverifiedTotpFactorUsingAal1Token", enrollStart);
const enroll = browserSupabase.slice(enrollStart, enrollEnd);
assert.match(enroll, /getAuthenticatorAssuranceLevel\(input\.accessToken\)[\s\S]*?currentLevel !== "aal1"/, "factor enrollment must be authorized by the captured AAL1 token");
assert.match(enroll, /getUser\(input\.accessToken\)[\s\S]*?user\.id !== input\.expectedUserId/, "factor enrollment must verify the exact Auth subject");
assert.match(enroll, /factor_type: "totp"/, "the exact-token enrollment helper must create only TOTP");
assert.match(enroll, /Authorization: `Bearer \$\{input\.accessToken\}`/, "enrollment must not follow a mutable current-session subject switch");
assert.doesNotMatch(enroll, /console\.|localStorage|sessionStorage/, "enrollment QR and secret must stay out of logs and browser storage");

console.log("delete operator MFA setup tests passed");
