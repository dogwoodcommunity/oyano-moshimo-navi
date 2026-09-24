import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Execute the real browser helper and Home identity/restore guards with fully
// synthetic Auth, storage and HTTP. No real email, provider or cloud calls.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function evaluate(source, sandbox) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(compiled, { ...sandbox, module, exports: module.exports });
  return module.exports;
}
const guestId = "00000000-0000-4000-8000-000000000011";
const familyId = "00000000-0000-4000-8000-000000000022";
const guest = (extra = {}) => ({ id: guestId, is_anonymous: true, ...extra });
const sessionFor = (user) => ({ user, access_token: `synthetic-access-${user.id}`, refresh_token: `synthetic-refresh-${user.id}` });
function browserScenario({ user = guest(), url = "https://example.test/home", updateError = null, exchangeUser, exchangeError, verifiedUser } = {}) {
  let session = user ? sessionFor(user) : null;
  const calls = [];
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: verifiedUser ?? session?.user }, error: null }),
    updateUser: async (...args) => {
      calls.push({ method: "updateUser", args });
      return { data: { user: session?.user }, error: updateError };
    },
    signInWithOtp: async (...args) => { calls.push({ method: "signInWithOtp", args }); return { error: null }; },
    signOut: async () => { calls.push({ method: "signOut" }); session = null; return { error: null }; },
    exchangeCodeForSession: async () => {
      calls.push({ method: "exchangeCodeForSession" });
      if (exchangeUser) session = sessionFor(exchangeUser);
      return { data: { session }, error: exchangeError ?? null };
    },
    setSession: async (input) => {
      calls.push({ method: "setSession" });
      if (input.access_token === `synthetic-access-${guestId}`) session = sessionFor(guest());
      return { data: { session }, error: null };
    }
  };
  const location = new URL(url);
  const context = {
    URL, URLSearchParams,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public" } },
    document: { title: "synthetic" },
    window: {
      location,
      localStorage: { removeItem: (key) => calls.push({ method: "removeItem", key }) },
      history: { replaceState: (_state, _title, path) => calls.push({ method: "replaceState", path }) }
    },
    require(name) {
      if (name === "@supabase/supabase-js") return { createClient: () => ({ auth }) };
      if (name === "@oyano/shared") return { authErrorMessage: () => "登録できませんでした" };
      if (name === "@/lib/authCaptcha") return evaluate(read("apps/web/lib/authCaptcha.ts"), context);
      throw new Error(`Unexpected dependency: ${name}`);
    }
  };
  return { api: evaluate(read("apps/web/lib/browserSupabase.ts"), context), calls, getSession: () => session };
}

for (const user of [guest(), guest({ email: "pending@example.test" })]) {
  const fixture = browserScenario({ user });
  const result = await fixture.api.linkGuestNotebookEmail("  new@example.test  ", guestId);
  assert.equal(result.ok, true, "email-present anonymous user still links the same guest");
  const update = fixture.calls.find((call) => call.method === "updateUser");
  assert.equal(update.args[0].email, "new@example.test");
  const redirect = new URL(update.args[1].emailRedirectTo);
  assert.equal(redirect.pathname, "/home");
  assert.equal(redirect.searchParams.get("guest_user"), guestId);
  assert.equal(redirect.searchParams.get("guest_link"), "1");
  assert.equal(fixture.calls.some((call) => call.method === "signInWithOtp" || call.method === "signOut"), false);
  assert.equal(fixture.getSession().user.id, guestId);
}

for (const user of [null, guest({ id: "other-user" }), { id: guestId, email: "confirmed@example.test", is_anonymous: false }]) {
  const fixture = browserScenario({ user });
  assert.equal((await fixture.api.linkGuestNotebookEmail("new@example.test", guestId)).ok, false);
  assert.equal(fixture.calls.length, 0, "unknown, changed or registered session cannot be linked as a guest");
}
{
  const fixture = browserScenario({ verifiedUser: guest({ id: "other-user" }) });
  assert.equal((await fixture.api.linkGuestNotebookEmail("new@example.test", guestId)).ok, false);
  assert.equal(fixture.calls.length, 0, "server user identity must also match the current guest");
}
{
  const fixture = browserScenario({ updateError: { code: "email_exists", message: "already registered" } });
  const result = await fixture.api.linkGuestNotebookEmail("existing@example.test", guestId);
  assert.equal(result.ok, false);
  assert.match(result.error, /別のアカウント/);
  assert.match(result.error, /切り替えや手帳の統合は行っていません/);
  assert.equal(fixture.getSession().user.id, guestId);
  assert.deepEqual(fixture.calls.map((call) => call.method), ["updateUser"]);
}
{
  const fixture = browserScenario({ user: null });
  assert.equal((await fixture.api.sendNotebookMagicLink("registered@example.test")).ok, true);
  assert.equal(fixture.calls[0].method, "signInWithOtp", "existing email sign-in flow stays unchanged");
}
{
  const fixture = browserScenario();
  assert.equal((await fixture.api.sendNotebookMagicLink("new@example.test")).ok, false);
  assert.equal(fixture.calls.length, 0, "stale non-guest UI cannot invoke OTP when an anonymous session now exists");
}
const guestCallback = `https://example.test/home?cloud=1&guest_link=1&guest_user=${guestId}`;
{
  const fixture = browserScenario({ url: `${guestCallback}&error_code=otp_expired` });
  const result = await fixture.api.completeBrowserSupabaseAuthFromUrl();
  assert.match(result.error, /期限が切れ/);
  assert.equal(result.session.user.id, guestId);
  assert.equal(fixture.calls.some((call) => call.method === "signOut" || call.method === "removeItem"), false,
    "expired guest email confirmation must preserve the original anonymous session");
  assert.equal(fixture.calls.find((call) => call.method === "replaceState").path, "/home?cloud=1");
}
{
  const fixture = browserScenario({ url: `${guestCallback}&code=synthetic-code`, exchangeError: { message: "expired" } });
  const result = await fixture.api.completeBrowserSupabaseAuthFromUrl();
  assert.equal(result.session.user.id, guestId);
  assert.equal(fixture.calls.some((call) => call.method === "signOut"), false);
}
{
  const fixture = browserScenario({ url: `${guestCallback}&code=synthetic-code`, exchangeUser: { id: "other-user", is_anonymous: false } });
  const result = await fixture.api.completeBrowserSupabaseAuthFromUrl();
  assert.match(result.error, /異なるアカウント/);
  assert.equal(result.session.user.id, guestId);
  assert.equal(fixture.getSession().user.id, guestId, "mismatched email callback cannot silently switch accounts");
  assert.equal(fixture.calls.some((call) => call.method === "setSession"), true);
}
{
  const fixture = browserScenario({ url: `${guestCallback}&code=synthetic-code`, exchangeUser: { id: guestId, email: "confirmed@example.test", is_anonymous: false } });
  const result = await fixture.api.completeBrowserSupabaseAuthFromUrl();
  assert.equal(result.error, undefined);
  assert.equal(result.session.user.id, guestId);
  assert.equal(result.session.user.is_anonymous, false);
}
{
  const fixture = browserScenario({ user: { id: "admin-user", is_anonymous: false }, url: "https://example.test/admin/mfa-setup?error_code=otp_expired" });
  const result = await fixture.api.completeBrowserSupabaseAuthFromUrl();
  assert.equal(result.session, null);
  assert.equal(fixture.getSession(), null, "normal/admin invalid callback still clears the previous session");
  assert.equal(fixture.calls.some((call) => call.method === "signOut"), true);
}

const home = read("apps/web/app/home/page.tsx");
const ast = ts.createSourceFile("home.tsx", home, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
visit(ast);
function functionSource(name) {
  const matches = nodes.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, `one real Home function: ${name}`);
  return matches[0].getText(ast);
}
const effects = nodes.filter((node) => ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect");
const initialEffect = effects.find((node) => node.arguments[0]?.getText(ast).includes("Always identify the exact auth user/family"));
const autosyncEffect = effects.find((node) => node.arguments[0]?.getText(ast).includes("const signature = notebookPayloadSignature(payload);"));
assert.ok(initialEffect);
assert.ok(autosyncEffect);
const recoveryVariable = nodes.find((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "cloudCanRecoverByEmail");
const recovery = evaluate(`export function canRecover(cloudUserEmail: string | null, cloudIsGuest: boolean) { return ${recoveryVariable.initializer.getText(ast)}; }`, {});
assert.equal(recovery.canRecover("pending@example.test", true), false, "pending guest email never establishes recovery");
assert.equal(recovery.canRecover(null, true), false);
assert.equal(recovery.canRecover("confirmed@example.test", false), true);
assert.match(home, /setCloudIsGuest\(session\?\.user\.is_anonymous === true\)/);
assert.match(home, /ブラウザのデータ削除・ログイン情報の消失・機種変更のあとに復元できません/);
assert.match(home, /メール登録だけで家族に共有されることはありません/);

function homeScenario({ binding = { authUserId: guestId, familyId }, anonymous = true, sessionUserId = guestId, noEligibleCases = false } = {}) {
  const calls = [];
  const context = {
    URLSearchParams, Date, Map,
    cloudUserId: guestId, cloudUserEmail: null, cloudIsGuest: anonymous, cloudFamilyId: familyId,
    cloudIdentityStatus: "checking", loaded: true, reconciliationBusy: false,
    cloudAuthGenerationRef: { current: 1 }, cloudRestoringRef: { current: false },
    cloudIdentityOnlyRef: { current: false }, firstCloudLoadDoneRef: { current: false },
    skipInitialCloudRestoreRef: { current: false }, lastSyncedPayloadRef: { current: "" },
    autoSyncTimerRef: { current: null }, NOTEBOOK_CLOUD_SYNC_BATCH_SIZE: 500, NOTEBOOK_CLOUD_RESTORE_LIMIT: 20000,
    cases: [{ id: "local-case" }], diaryEntries: {},
    listLocalCases: () => [{ id: "local-case" }],
    getBrowserSupabase: () => ({ auth: { getSession: async () => ({ data: { session: sessionFor({ id: sessionUserId }) } }) } }),
    readNotebookCloudBinding: () => binding,
    notebookCloudBindingMatches: (value, userId, selectedFamilyId) => Boolean(value && value.authUserId === userId && value.familyId === selectedFamilyId),
    notebookSyncPayload: () => ({ cases: noEligibleCases ? [] : [{ id: "local-case" }], diaryEntries: [] }),
    notebookPayloadSignature: () => "synthetic-signature",
    canAdoptNotebookCloudIdentity: () => true, // Guest must not use the permissive legacy adoption branch.
    replaceLocalNotebook: (data) => { calls.push("merge"); return { ...data, persisted: true, conflicts: [] }; },
    overwriteLocalNotebook: (data) => { calls.push("overwrite"); return { ...data, persisted: true, conflicts: [] }; },
    bindNotebookToCurrentIdentity: () => { calls.push("bind"); return true; },
    reloadNotebookState: () => calls.push("reload"),
    writePlan() {}, applyFamilyBillingState() {},
    setSeparateNotebookConflict() {}, setCloudFamilies() {}, setCloudFamilyId() {}, setCloudMemberRole() {},
    setCloudAutoStatus: (value) => calls.push(`auto:${value}`),
    setCloudStatus: (value) => calls.push(`status:${value}`),
    setCloudIdentityStatus: (value) => calls.push(`identity:${value}`),
    setCloudMessage: (value) => calls.push(`message:${value}`), setLastCloudSyncedAt() {},
    fetch: async (_url, options) => {
      assert.equal(options.method, undefined, "restore must read cloud before any write");
      calls.push("GET");
      return { ok: true, json: async () => ({ familyId, memberRole: "owner", cases: [{ id: "local-case" }], diaryEntries: [], diaryEntriesTotal: 0 }) };
    },
    window: { setTimeout: () => { calls.push("timer"); return 1; }, clearTimeout() {} }
  };
  const exports = evaluate([
    functionSource("getAccessToken"), functionSource("restoreNotebookFromCloud"),
    `export const initialRestoreEffect = ${initialEffect.arguments[0].getText(ast)};`,
    `export const autoSyncEffect = ${autosyncEffect.arguments[0].getText(ast)};`,
    "export { restoreNotebookFromCloud, getAccessToken };"
  ].join("\n"), context);
  return { api: exports, calls, context };
}
{
  const fixture = homeScenario();
  await fixture.api.restoreNotebookFromCloud({ silent: true });
  assert.ok(fixture.calls.indexOf("GET") < fixture.calls.indexOf("merge"));
  assert.ok(fixture.calls.includes("bind"), "exact-bound guest can restore with no email");
}
{
  const fixture = homeScenario({ noEligibleCases: true });
  await fixture.api.restoreNotebookFromCloud({ silent: true });
  assert.ok(fixture.calls.includes("merge"), "unconsented local guest notebooks still require a merge, never replacement");
  assert.equal(fixture.calls.includes("overwrite"), false, "empty guest upload scope must not erase unrelated local notebooks");
}
for (const { anonymous, scope, expectedCases, expectedEntries } of [
  { anonymous: true, expectedCases: ["consented"], expectedEntries: ["a"] },
  { anonymous: false, expectedCases: ["consented", "local-only"], expectedEntries: ["a", "b"] },
  { anonymous: false, scope: ["consented"], expectedCases: ["consented"], expectedEntries: ["a"] },
  { anonymous: false, scope: [], expectedCases: [], expectedEntries: [] }
]) {
  const context = {
    cloudIsGuest: anonymous,
    readNotebookCloudBinding: () => ({ authUserId: guestId, familyId, ...(scope ? { caseIds: scope } : {}) }),
    cases: [{ id: "consented", cloudPersonId: "person-consented" }, { id: "local-only" }, { id: "deleting", cloudPersonId: "person-deleting" }],
    blockedCloudCaseSyncIdsRef: { current: new Set(["deleting"]) },
    isPersonNotebookCloudSyncBlocked: () => false,
    diaryEntriesAllowedForCloudSync: (entries) => entries,
    diaryEntriesForNotebookSync: (entries) => entries,
    blockedCloudDiarySyncKeysRef: { current: new Set() },
    allDiaryEntriesForSync: () => [{ id: "a", caseId: "consented" }, { id: "b", caseId: "local-only" }, { id: "c", caseId: "deleting" }]
  };
  const api = evaluate(`${functionSource("notebookSyncPayload")}\n export { notebookSyncPayload };`, context);
  const payload = api.notebookSyncPayload();
  assert.deepEqual([...payload.cases.map((record) => record.id)], expectedCases);
  assert.deepEqual([...payload.diaryEntries.map((entry) => entry.id)], expectedEntries);
}
{
  const boundVariable = nodes.find((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "cloudIsBound");
  const scopeVariable = nodes.find((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "activeCaseInCloudScope");
  const api = evaluate(`export function isBound(cloudUserId, cloudIdentityStatus, cloudIsGuest, activeCase, cloudScopeCaseIds) { const ${scopeVariable.getText(ast)}; return ${boundVariable.initializer.getText(ast)}; }`, {});
  assert.equal(api.isBound(guestId, "ready", true, { id: "local-only" }), false,
    "active unsynced guest notebook cannot be advertised as cloud-saved");
  assert.equal(api.isBound(guestId, "ready", true, { id: "consented", cloudPersonId: "person-consented" }), true);
  assert.equal(api.isBound(guestId, "ready", false, { id: "registered" }), true);
  assert.equal(api.isBound(guestId, "ready", false, { id: "unconsented" }, ["consented"]), false,
    "email conversion cannot make another local notebook appear cloud-saved");
}
{
  const values = new Map();
  const store = evaluate(read("apps/web/lib/store.ts"), {
    window: { localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    } },
    require(name) {
      if (name === "@/lib/funnel") return { trackFunnel() {} };
      if (name === "@/lib/date") return { japanDateInputValue: () => "2026-09-19" };
      if (name === "@/lib/caseOwnership") return { ANONYMOUS_CASE_TOKEN_PATTERN: /^anon_[a-f0-9]{64}$/i };
      if (name === "@oyano/shared") return {};
      throw new Error(`Unexpected store dependency: ${name}`);
    }
  });
  const original = { version: 1, authUserId: guestId, familyId, caseIds: ["consented"] };
  assert.equal(store.writeNotebookCloudBinding(original), true);
  assert.deepEqual([...store.readNotebookCloudBinding().caseIds], ["consented"]);
  assert.equal(store.writeNotebookCloudBinding({ version: 1, authUserId: guestId, familyId, email: "confirmed@example.test" }), true);
  assert.deepEqual([...store.readNotebookCloudBinding().caseIds], ["consented"],
    "Home rebind after email conversion preserves the original consent scope");
  assert.equal(store.writeNotebookCloudBinding({ ...original, caseIds: ["consented", "newly-consented"] }), true);
  assert.deepEqual([...store.readNotebookCloudBinding().caseIds], ["consented", "newly-consented"]);
  assert.equal(store.writeNotebookCloudBinding({ version: 1, authUserId: guestId, familyId }), true);
  assert.deepEqual([...store.readNotebookCloudBinding().caseIds], ["consented", "newly-consented"]);
  assert.equal(store.writeNotebookCloudBinding({ ...original, caseIds: [] }), true);
  assert.equal(store.writeNotebookCloudBinding({ version: 1, authUserId: guestId, familyId, email: "confirmed@example.test" }), true);
  assert.deepEqual([...store.readNotebookCloudBinding().caseIds], [], "empty scope is retained, never converted to unrestricted");
  const storageKey = [...values.keys()].find((key) => values.get(key)?.includes(guestId));
  values.set(storageKey, JSON.stringify({ ...original, caseIds: "malformed" }));
  assert.deepEqual([...store.readNotebookCloudBinding().caseIds], [], "malformed scope reads as no consent");
  assert.equal(store.writeNotebookCloudBinding({ version: 1, authUserId: "another-user", familyId: "another-family" }), true);
  assert.equal(store.readNotebookCloudBinding().caseIds, undefined, "unrelated registered binding does not inherit another user's scope");
}
for (const binding of [null, { authUserId: guestId, familyId: "other-family" }]) {
  for (const identityOnly of [false, true]) {
    const fixture = homeScenario({ binding });
    await fixture.api.restoreNotebookFromCloud({ silent: true, identityOnly });
    assert.ok(fixture.calls.includes("identity:blocked"));
    assert.equal(fixture.calls.some((call) => ["bind", "merge", "overwrite", "reload"].includes(call)), false,
      "unknown guest ownership cannot adopt/restore even when legacy adoption or reset would allow it");
  }
}
{
  const fixture = homeScenario({ binding: { authUserId: "other-user", familyId } });
  await fixture.api.restoreNotebookFromCloud({ silent: true });
  assert.ok(fixture.calls.includes("identity:different-account"));
  assert.equal(fixture.calls.includes("bind"), false);
}
{
  const fixture = homeScenario({ sessionUserId: "other-user" });
  assert.equal(await fixture.api.getAccessToken(), null, "stale React identity cannot use another session's token");
  await fixture.api.restoreNotebookFromCloud({ silent: true });
  assert.equal(fixture.calls.includes("GET"), false);
}
{
  const fixture = homeScenario();
  fixture.api.initialRestoreEffect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(fixture.calls.includes("GET"), "initial guest restore no longer requires email");
}
{
  // Build the actual effect with a mutable sandbox so ready-state autosync can
  // be checked independently of the restore implementation.
  const scheduled = [];
  evaluate(`(${autosyncEffect.arguments[0].getText(ast)})();`, {
    loaded: true, cloudUserId: guestId, cloudIdentityStatus: "ready", cloudUserEmail: null,
    firstCloudLoadDoneRef: { current: true }, cloudRestoringRef: { current: false },
    autoSyncTimerRef: { current: null }, lastSyncedPayloadRef: { current: "old" },
    notebookSyncPayload: () => ({}), notebookPayloadSignature: () => "new", setCloudAutoStatus() {},
    window: { setTimeout: (_callback, delay) => { scheduled.push(delay); return 1; }, clearTimeout() {} }
  });
  assert.deepEqual(scheduled, [1200], "bound guest autosync runs with no email");
}
console.log("guest Home identity checks: ok (synthetic Auth/HTTP only)");
