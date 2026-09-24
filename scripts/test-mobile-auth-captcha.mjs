import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Execute the real helpers/handlers. Every Auth/storage/link API is synthetic;
// this script cannot send mail or call an external provider.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function evaluate(source, context = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX
  } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, URL, URLSearchParams, Date, ...context });
  return module.exports;
}
const flow = evaluate(read("apps/mobile/lib/authFlow.ts"));
const state = "a".repeat(64);
const user = { id: "synthetic-user", email: "owner@example.test", email_confirmed_at: "2026-09-19", is_anonymous: false };
const session = { user, access_token: "new-access", refresh_token: "new-refresh" };
const pending = (extra = {}) => ({ version: 1, state, email: user.email, createdAt: Date.now(), redirectPath: "/(tabs)/dashboard", startingUserId: null, ...extra });
const callback = (nonce = state, hash = "access_token=synthetic-access&refresh_token=synthetic-refresh&type=magiclink") => `${flow.MOBILE_AUTH_CALLBACK}?state=${nonce}#${hash}`;
const handoff = `/handoff?caseId=00000000-0000-4000-8000-000000000011&token=handoff_${"b".repeat(48)}`;
const invite = `/invite?token=${"z".repeat(24)}`;
for (const target of [handoff, invite, "/(tabs)/dashboard"]) assert.equal(flow.sanitizeRedirectPath(target), target);
for (const target of ["https://evil.test", "//evil.test", "/admin", "/invite?token=short", "/handoff?caseId=bad&token=bad"]) {
  assert.equal(flow.sanitizeRedirectPath(target), "/(tabs)/dashboard");
}
assert.equal(flow.normalizeMobileEmail(" OWNER@Example.test "), user.email);
assert.equal(flow.normalizeMobileEmail("bad"), null);
assert.equal(flow.parsePendingMobileAuth(JSON.stringify(pending())).state, state);
for (const change of [
  { state: "short" }, { version: 0 }, { email: "OWNER@example.test" }, { createdAt: Date.now() - flow.MOBILE_AUTH_MAX_AGE_MS },
  { createdAt: Date.now() + 60000 }, { redirectPath: "https://evil.test" }, { startingUserId: 1 }
]) assert.equal(flow.parsePendingMobileAuth(JSON.stringify(pending(change))), null);
for (const raw of [null, "{invalid}", "null"]) assert.equal(flow.parsePendingMobileAuth(raw), null);
assert.equal(flow.mobileAuthBrowserUrl("https://web.example.test", state), `https://web.example.test/auth/mobile#state=${state}`);
for (const base of ["http://web.example.test", "https://user:password@web.example.test", "https://web.example.test/redirect", "https://web.example.test?query=x"]) {
  assert.throws(() => flow.mobileAuthBrowserUrl(base, state));
}
assert.equal(flow.parseMobileAuthCallback(callback()).state, state);
for (const raw of [
  callback().replace("oyanomoshimo:", "https:"), callback().replace("///auth", "//evil.test/auth"),
  callback().replace("/complete", "/wrong"), callback("short"), callback().replace(`?state=${state}`, `?state=${state}&state=${state}`),
  callback(state, "code=pkce"), callback(state, "access_token=a&refresh_token=b&type=recovery"),
  callback(state, "access_token=a&access_token=b&refresh_token=b&type=magiclink")
]) assert.equal(flow.parseMobileAuthCallback(raw), null);

function nativeScenario(options = {}) {
  let stored = options.pending === null ? null : JSON.stringify(options.pending ?? pending());
  let currentUser = options.currentUser ?? null;
  let throwSession = false;
  let randomness = 0;
  const calls = [];
  const native = { auth: {
    getSession: async () => {
      if (throwSession) throw Error("synthetic storage failure");
      return { data: { session: currentUser ? { user: currentUser } : null }, error: options.sessionError ?? null };
    },
    setSession: async (tokens) => { calls.push(["setSession", tokens]); currentUser = user; return { error: options.setError ?? null }; },
    signOut: async (input) => {
      calls.push(["signOut", input]);
      if (options.pauseSignOut) await options.pauseSignOut;
      if (options.signOutError) return { error: options.signOutError };
      currentUser = null;
      return { error: null };
    }
  } };
  const verifier = { auth: {
    getUser: async (token) => {
      calls.push(["getUser", token]);
      if (options.pauseVerification) await options.pauseVerification;
      return { data: { user: token === "new-access" ? options.confirmedUser ?? options.verifiedUser ?? user : options.verifiedUser ?? user }, error: options.verifyError ?? null };
    },
    refreshSession: async (tokens) => {
      calls.push(["refreshSession", tokens]);
      if (options.changeSession) currentUser = options.changeSession;
      if (options.changePending) stored = JSON.stringify(options.changePending);
      return { data: { session: options.refreshedSession ?? session }, error: options.refreshError ?? null };
    }
  } };
  const api = evaluate(read("apps/mobile/lib/auth.ts"), {
    process: { env: { EXPO_PUBLIC_WEB_BASE_URL: options.webBase ?? "https://web.example.test" } },
    require(name) {
      if (name === "./authFlow") return flow;
      if (name === "./notifications") return { withDevicePushRevoked: async (signOut) => ({ completed: true, result: await signOut() }) };
      if (name === "./supabase") return { getSupabase: () => options.unconfigured ? null : native, createMobileAuthVerifier: () => verifier };
      if (name === "expo-crypto") return { getRandomBytesAsync: async () => new Uint8Array(32).fill(++randomness) };
      if (name === "expo-web-browser") return { openAuthSessionAsync: (url, redirectUrl) => {
        calls.push(["openAuthSession", url, redirectUrl]);
        options.onBrowserOpen?.(url, redirectUrl);
        if (options.syncOpenFailure) throw Error("unavailable");
        if (options.openFailure) return Promise.reject(Error("offline"));
        return options.browserWait ?? (typeof options.browserResult === "function" ? options.browserResult(url, redirectUrl) : options.browserResult ?? { type: "dismiss" });
      } };
      if (name === "expo-secure-store") return {
        getItemAsync: async () => stored,
        setItemAsync: async (_key, value) => { if (options.storeFailure) throw Error("locked"); stored = value; calls.push(["store"]); },
        deleteItemAsync: async (key) => { if (options.removeFailure) throw Error("locked"); stored = null; calls.push(["remove", key]); }
      };
      throw Error(`Unexpected native dependency ${name}`);
    }
  });
  return { api, calls, stored: () => stored, setStored: (next) => { stored = next; }, setSessionFailure: (next) => { throwSession = next; }, currentUser: () => currentUser };
}

for (const redirectPath of [handoff, invite, "/(tabs)/dashboard"]) {
  const fixture = nativeScenario({ pending: pending({ redirectPath }) });
  const result = await fixture.api.handleAuthRedirectUrl(callback());
  assert.equal(result.handled, true);
  assert.equal(result.redirectPath, redirectPath);
  assert.equal(fixture.stored(), null);
  assert.deepEqual(fixture.calls.map(([method]) => method), ["getUser", "refreshSession", "getUser", "remove", "setSession"]);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, true, "duplicate completion can return to its already verified user");
  assert.equal(fixture.calls.filter(([method]) => method === "setSession").length, 1);
}
{
  const fixture = nativeScenario();
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, true);
  fixture.setSessionFailure(true);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, false, "duplicate callback storage failure is a retry result, not a rejected promise");
  fixture.setSessionFailure(false);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, true, "callback lock releases after storage failure");
}
for (const options of [
  { pending: null }, { pending: pending({ state: "b".repeat(64) }) },
  { pending: pending({ createdAt: Date.now() - flow.MOBILE_AUTH_MAX_AGE_MS }) },
  { verifiedUser: { ...user, email: "other@example.test" } }, { verifiedUser: { ...user, is_anonymous: true } },
  { verifiedUser: { ...user, email_confirmed_at: null } }, { verifyError: Error("invalid") },
  { confirmedUser: { ...user, id: "other-user" } }, { confirmedUser: { ...user, email: "other@example.test" } },
  { refreshedSession: { ...session, user: { ...user, id: "other-user" } } }, { refreshError: Error("expired") },
  { currentUser: { id: "other-user" } }, { sessionError: Error("storage") },
  { pending: pending({ startingUserId: "other-user" }), currentUser: { id: "other-user" } },
  { changeSession: { id: "other-user" } }, { changePending: pending({ state: "c".repeat(64) }) }
]) {
  const fixture = nativeScenario(options);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, false);
  assert.equal(fixture.calls.some(([method]) => method === "setSession"), false, "rejected callbacks preserve native identity");
}
{
  const fixture = nativeScenario({ pending: pending({ startingUserId: user.id }), currentUser: user });
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, true, "same native identity can reauthenticate");
}
{
  const fixture = nativeScenario();
  assert.equal((await fixture.api.handleAuthRedirectUrl(`${flow.MOBILE_AUTH_CALLBACK}?state=${state}&error_code=otp_expired`)).handled, false);
  assert.equal(fixture.stored(), null);
  assert.equal(fixture.calls.some(([method]) => method === "getUser"), false);
}
{
  let resolve;
  const pauseVerification = new Promise((done) => { resolve = done; });
  const fixture = nativeScenario({ pauseVerification });
  const first = fixture.api.handleAuthRedirectUrl(callback());
  const second = fixture.api.handleAuthRedirectUrl(callback());
  assert.equal(first, second, "duplicate event/React effect shares verification");
  resolve();
  assert.equal((await first).handled, true);
  assert.equal(fixture.calls.filter(([method]) => method === "setSession").length, 1);
}
{
  const fixture = nativeScenario();
  const result = await fixture.api.sendMagicLink(" OWNER@example.test ", handoff);
  assert.equal(result.browserOpened, true);
  assert.equal(result.sent, false, "opening a browser does not claim mail was sent");
  const firstState = JSON.parse(fixture.stored()).state;
  assert.equal(JSON.parse(fixture.stored()).email, user.email);
  assert.equal(JSON.parse(fixture.stored()).redirectPath, handoff);
  assert.deepEqual(fixture.calls.find(([method]) => method === "openAuthSession"), [
    "openAuthSession", `https://web.example.test/auth/mobile#state=${firstState}`, `${flow.MOBILE_AUTH_CALLBACK}?state=${firstState}`
  ]);
  await fixture.api.sendMagicLink(user.email, invite);
  assert.notEqual(JSON.parse(fixture.stored()).state, firstState);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback(firstState))).handled, false, "resend invalidates the earlier nonce");
}
for (const options of [{ syncOpenFailure: true }, { openFailure: true }, { storeFailure: true }, { webBase: "http://unsafe.test" }]) {
  const fixture = nativeScenario(options);
  const previousPending = fixture.stored();
  const result = await fixture.api.sendMagicLink(user.email);
  assert.equal(result.browserOpened, undefined);
  assert.equal(result.demo, false);
  assert.equal(fixture.stored(), options.syncOpenFailure || options.openFailure ? null : previousPending, "failure before a new attempt must preserve earlier pending state");
}
assert.equal((await nativeScenario({ unconfigured: true }).api.sendMagicLink(user.email)).demo, false, "missing setup must never enable demo entry");

{
  const fixture = nativeScenario({ browserResult: (_url, redirectUrl) => ({ type: "success", url: `${redirectUrl}#access_token=synthetic-access&refresh_token=synthetic-refresh&type=magiclink` }) });
  const result = await fixture.api.sendMagicLink(user.email, invite);
  assert.equal(result.redirectPath, invite, "iOS result-only completion returns to the requested screen");
  assert.equal(fixture.calls.filter(([method]) => method === "setSession").length, 1);
  const verifiedState = new URL(fixture.calls.find(([method]) => method === "openAuthSession")[2]).searchParams.get("state");
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback(verifiedState))).redirectPath, invite, "a late duplicate returns to the verified screen");
  assert.equal(fixture.calls.filter(([method]) => method === "setSession").length, 1);
}
{
  const fixture = nativeScenario({ browserResult: { type: "cancel" } });
  await fixture.api.sendMagicLink(user.email);
  const created = JSON.parse(fixture.stored());
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback(created.state))).handled, true, "email callback after closing browser still works");
}
{
  const fixture = nativeScenario({ browserResult: { type: "dismiss" } });
  await fixture.api.sendMagicLink(user.email);
  assert.ok(fixture.stored(), "Android dismiss must not discard a possible later redirect");
  const created = JSON.parse(fixture.stored());
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback(created.state))).handled, true);
}
{
  let opened;
  const browserOpened = new Promise((resolve) => { opened = resolve; });
  let finish;
  const browserWait = new Promise((resolve) => { finish = resolve; });
  const fixture = nativeScenario({ browserWait, onBrowserOpen: (_url, redirectUrl) => opened(redirectUrl) });
  const sending = fixture.api.sendMagicLink(user.email, handoff);
  const redirectUrl = await browserOpened;
  const url = `${redirectUrl}#access_token=synthetic-access&refresh_token=synthetic-refresh&type=magiclink`;
  const linking = fixture.api.handleAuthRedirectUrl(url);
  finish({ type: "success", url });
  assert.equal((await sending).redirectPath, handoff);
  assert.equal((await linking).handled, true);
  assert.equal(fixture.calls.filter(([method]) => method === "setSession").length, 1, "result and Linking share one session write");
}
{
  let opened;
  const browserOpened = new Promise((resolve) => { opened = resolve; });
  let fail;
  const browserWait = new Promise((_resolve, reject) => { fail = reject; });
  const fixture = nativeScenario({ browserWait, onBrowserOpen: (_url, redirectUrl) => opened(redirectUrl) });
  const sending = fixture.api.sendMagicLink(user.email);
  await browserOpened;
  const newer = pending({ state: "e".repeat(64) });
  fixture.setStored(JSON.stringify(newer));
  fail(Error("offline"));
  assert.equal((await sending).browserOpened, undefined);
  assert.equal(JSON.parse(fixture.stored()).state, newer.state, "old browser failure must not delete a newer attempt");
}
{
  let opened;
  const browserOpened = new Promise((resolve) => { opened = resolve; });
  let finish;
  const browserWait = new Promise((resolve) => { finish = resolve; });
  const fixture = nativeScenario({ browserWait, currentUser: user, onBrowserOpen: (_url, redirectUrl) => opened(redirectUrl) });
  const sending = fixture.api.sendMagicLink(user.email);
  const redirectUrl = await browserOpened;
  assert.equal((await fixture.api.signOutThisDevice()).ok, true);
  finish({ type: "success", url: `${redirectUrl}#access_token=synthetic-access&refresh_token=synthetic-refresh&type=magiclink` });
  assert.equal((await sending).redirectPath, undefined, "late login cannot reverse a logout");
  assert.equal(fixture.currentUser(), null);
}

{
  const fixture = nativeScenario({ currentUser: user });
  assert.equal((await fixture.api.signOutThisDevice()).ok, true);
  assert.equal(fixture.stored(), null);
  assert.equal(fixture.currentUser(), null);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls)), [
    ["remove", flow.MOBILE_AUTH_PENDING_KEY], ["signOut", { scope: "local" }]
  ], "logout removes only its pending nonce and revokes only this session");
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, false, "old email cannot log the device back in after logout");
}
for (const options of [{ signOutError: Error("offline") }, { removeFailure: true }, { unconfigured: true }]) {
  const fixture = nativeScenario({ currentUser: user, ...options });
  assert.equal((await fixture.api.signOutThisDevice()).ok, false);
  assert.equal(fixture.currentUser().id, user.id, "failed logout must not claim the account is signed out");
}
{
  let finish;
  const pauseSignOut = new Promise((resolve) => { finish = resolve; });
  const fixture = nativeScenario({ currentUser: user, pauseSignOut });
  const logout = fixture.api.signOutThisDevice();
  assert.equal((await fixture.api.sendMagicLink(user.email)).browserOpened, undefined);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, false);
  finish();
  assert.equal((await logout).ok, true, "login and callbacks cannot race local logout");
}
{
  let finish;
  const pauseVerification = new Promise((resolve) => { finish = resolve; });
  const fixture = nativeScenario({ pauseVerification });
  const restoration = fixture.api.handleAuthRedirectUrl(callback());
  assert.equal((await fixture.api.signOutThisDevice()).ok, false, "an in-flight callback must finish before logout can start");
  finish();
  await restoration;
  assert.equal((await fixture.api.signOutThisDevice()).ok, true);
}

// Drive the observer used by the real Context with synthetic Auth events.
function sessionScenario(options = {}) {
  const states = [];
  let listener;
  let finish;
  let unsubscribeCount = 0;
  const readSession = new Promise((resolve) => { finish = resolve; });
  const api = evaluate(read("apps/mobile/lib/session.ts"), {
    process: { env: { EXPO_PUBLIC_WEB_BASE_URL: options.webBase ?? "https://web.example.test" } },
    require(name) {
      if (name === "./authFlow") return flow;
      if (name === "./supabase") return { getSupabase: () => options.unconfigured ? null : { auth: {
        getSession: () => readSession,
        onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { unsubscribeCount++; } } } }; }
      } } };
      throw Error(`Unexpected session dependency ${name}`);
    }
  });
  const stop = api.observeMobileSession((next) => states.push(next));
  return { api, states, stop, finish, emit: (value) => listener("SYNTHETIC", value), unsubscribeCount: () => unsubscribeCount };
}
{
  const fixture = sessionScenario();
  fixture.finish({ data: { session }, error: null });
  await Promise.resolve();
  assert.equal(fixture.states.at(-1).status, "signed-in", "an existing saved native session can open protected screens");
  assert.equal(fixture.states.at(-1).userId, user.id);
  fixture.emit(null);
  assert.equal(fixture.states.at(-1).status, "signed-out");
  fixture.emit({ user: { ...user, is_anonymous: true } });
  assert.equal(fixture.states.at(-1).status, "signed-out", "Web guest identity is not native authentication");
  fixture.stop();
  const count = fixture.states.length;
  fixture.emit(session);
  assert.equal(fixture.states.length, count);
  assert.equal(fixture.unsubscribeCount(), 1);
}
{
  const fixture = sessionScenario();
  fixture.emit(null);
  fixture.finish({ data: { session }, error: null });
  await Promise.resolve();
  assert.equal(fixture.states.at(-1).status, "signed-out", "a stale initial read cannot undo logout");
  fixture.stop();
}
for (const options of [{ unconfigured: true }, { webBase: "http://invalid.test" }]) {
  assert.equal(sessionScenario(options).states.at(-1).status, "unconfigured");
}

// Render the actual Context/guard with tiny React stubs; no native surface is used.
{
  let state = { status: "loading", userId: null };
  let effect;
  let published;
  let observed;
  const jsx = (type, props, key) => ({ type, props, key });
  const api = evaluate(read("apps/mobile/components/MobileSessionProvider.tsx"), {
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return {
        createContext: () => ({ Provider: "Provider" }), useContext: () => state,
        useState: (value) => [value, (next) => { published = next; }], useEffect: (callback) => { effect = callback; }
      };
      if (name === "expo-router") return { Redirect: "Redirect" };
      if (name === "react-native") return { ActivityIndicator: "Spinner", View: "View", Text: "Text", StyleSheet: { create: (styles) => styles } };
      if (name === "@/lib/theme") return { colors: {} };
      if (name === "@/lib/session") return { observeMobileSession: (callback) => { observed = callback; return () => "unsubscribed"; } };
      throw Error(`Unexpected Context dependency ${name}`);
    }
  });
  api.MobileSessionProvider({ children: "app" });
  const stop = effect();
  observed({ status: "signed-in", userId: user.id });
  assert.equal(published.userId, user.id);
  assert.equal(stop(), "unsubscribed");
  for (const status of ["signed-out", "unconfigured", "error"]) {
    state = { status, userId: null };
    const output = api.ProtectedScreen({ children: "PRIVATE_CONTENT" });
    assert.equal(output.type, "Redirect");
    assert.equal(output.props.href, "/(auth)/welcome");
  }
  state = { status: "signed-in", userId: user.id };
  assert.equal(api.ProtectedScreen({ children: "PRIVATE_CONTENT" }).props.children, "PRIVATE_CONTENT");
  state = { status: "loading", userId: null };
  assert.doesNotMatch(JSON.stringify(api.ProtectedScreen({ children: "PRIVATE_CONTENT" })), /PRIVATE_CONTENT/);
}

// Misconfigured data helpers must not manufacture sample records or successful writes.
{
  const api = evaluate(read("apps/mobile/lib/mobileData.ts"), {
    process: { env: {} },
    require(name) {
      if (name === "./supabase") return { getSupabase: () => null };
      if (name === "@/lib/funnel") return { trackFunnel: () => { throw Error("unexpected tracking"); } };
      if (name === "./demoData" || name === "@oyano/shared") return {};
      throw Error(`Unexpected data dependency ${name}`);
    }
  });
  for (const name of ["fetchDashboardData", "fetchPerson", "fetchTasks", "fetchFamilyMembers", "fetchTimelineEntries"]) {
    await assert.rejects(() => api[name]("synthetic-person"), /接続設定/);
  }
  for (const operation of [
    () => api.createInitialFamilyPerson({ displayName: "synthetic", currentStatus: "preparing" }),
    () => api.createPersonForFamily({ displayName: "synthetic", currentStatus: "preparing", anchorPersonId: "synthetic-person" }),
    () => api.createFamilyInvite("synthetic-person", user.email),
    () => api.acceptFamilyInvite("synthetic-token", () => true),
    () => api.updatePersonStatus("synthetic-person", "preparing", "hospitalized"),
    () => api.updatePersonProfile("synthetic-person", { displayName: "synthetic" }),
    () => api.addTimelineEntry({ personId: "synthetic-person", body: "synthetic", mood: "stable" }),
    () => api.updateTaskStatus("synthetic-task", "done"),
    () => api.updateTaskAssignee("synthetic-task", "synthetic-member")
  ]) {
    const result = await operation();
    assert.match(result.error, /接続設定/);
    assert.ok(!result.person && !result.entry && !result.inviteUrl && !result.accepted);
  }
}
for (const file of ["apps/mobile/app/(tabs)/_layout.tsx", "apps/mobile/app/people/_layout.tsx", "apps/mobile/app/account/_layout.tsx", "apps/mobile/app/consult.tsx", "apps/mobile/app/notifications.tsx"]) {
  assert.match(read(file), /<ProtectedScreen>/, `${file} must guard private children before they mount`);
}
assert.doesNotMatch(read("apps/mobile/app/(auth)/welcome.tsx"), /continueDemo|activateDemoSession|consumeWebHandoff/);
assert.match(read("apps/mobile/app/(tabs)/settings.tsx"), /Alert\.alert[\s\S]*キャンセル[\s\S]*ログアウトする/);
assert.match(read("apps/mobile/app/(tabs)/settings.tsx"), /router\.dismissAll\(\)[\s\S]*router\.replace\("\/\(auth\)\/welcome"\)/);

function webScenario({ siteKey = "site-key", sendError = null, networkError = false, configured = true } = {}) {
  const calls = [];
  const env = configured ? { NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-synthetic", NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey } : {};
  const captcha = evaluate(read("apps/web/lib/authCaptcha.ts"), { process: { env } });
  const api = evaluate(read("apps/web/lib/mobileAuth.ts"), {
    process: { env },
    require(name) {
      if (name === "./authCaptcha") return captcha;
      if (name === "@oyano/shared") return { authErrorMessage: () => "送信できませんでした。" };
      if (name === "@supabase/supabase-js") return { createClient: (_url, _key, config) => {
        calls.push(["createClient", config]);
        return { auth: { signInWithOtp: async (input) => { calls.push(["signInWithOtp", input]); if (networkError) throw Error("offline"); return { error: sendError }; } } };
      } };
      throw Error(`Unexpected browser dependency ${name}`);
    }
  });
  return { api, calls };
}
{
  const fixture = webScenario();
  assert.equal(fixture.api.mobileAuthStateFromHash(`#state=${state}`), state);
  assert.equal(fixture.api.mobileAuthStateFromHash(`#state=${state}&state=${state}`), null);
  assert.equal(fixture.api.MOBILE_EMAIL_CALLBACK, flow.MOBILE_AUTH_CALLBACK);
  for (const captchaToken of [undefined, null, "", " "]) assert.equal((await fixture.api.sendMobileMagicLink(user.email, state, { captchaToken })).ok, false);
  assert.equal(fixture.calls.length, 0, "missing CAPTCHA cannot create client or send");
  assert.equal((await fixture.api.sendMobileMagicLink("OWNER@example.test ", state, { captchaToken: "one-use-token" })).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls[0][1].auth)), {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false, flowType: "implicit", storageKey: "oyano-mobile-email-only"
  });
  const input = fixture.calls[1][1];
  assert.equal(input.email, user.email);
  assert.equal(input.options.captchaToken, "one-use-token");
  assert.equal(input.options.emailRedirectTo, `${flow.MOBILE_AUTH_CALLBACK}?state=${state}`);
}
assert.equal((await webScenario({ siteKey: "" }).api.sendMobileMagicLink(user.email, state)).ok, true);
for (const options of [{ sendError: Error("rejected") }, { networkError: true }, { configured: false }]) {
  assert.equal((await webScenario(options).api.sendMobileMagicLink(user.email, state, { captchaToken: "valid" })).ok, false);
}
{
  const fixture = webScenario();
  assert.equal((await fixture.api.sendMobileMagicLink("bad", state, { captchaToken: "valid" })).ok, false);
  assert.equal((await fixture.api.sendMobileMagicLink(user.email, "bad", { captchaToken: "valid" })).ok, false);
  assert.equal(fixture.calls.length, 0);
}

// Test the real form handler: a challenge never auto-submits, and rapid clicks
// cannot consume two tokens or send two messages. Inputs survive a rejection.
function functionSource(file, name) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let match;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) match = node; ts.forEachChild(node, visit); }
  visit(source);
  assert.ok(match);
  return match.getText(source);
}
{
  const calls = [];
  let complete;
  const waiting = new Promise((done) => { complete = done; });
  const api = evaluate(`${functionSource("apps/web/app/auth/mobile/page.tsx", "send")}\nexport { send };`, {
    state, email: user.email, sending: { current: false },
    captcha: { consumeToken: () => { calls.push("consume"); return "synthetic"; } },
    setBusy: () => {}, setMessage: (message) => calls.push(message),
    sendMobileMagicLink: async () => { calls.push("send"); await waiting; return { ok: false, error: "再確認してください" }; }
  });
  const event = { preventDefault() {} };
  const first = api.send(event);
  await api.send(event);
  assert.equal(calls.filter((call) => call === "send").length, 1);
  complete(); await first;
  assert.equal(calls.filter((call) => call === "consume").length, 1);
  assert.ok(calls.includes("再確認してください"));
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

// Mount the actual screen component. Focus/blur leaves it mounted, just like a
// navigation stack; synthetic Auth, storage and network have no side effects.
function screenScenario(file, options = {}) {
  const refs = [];
  const states = [];
  let hookIndex = 0;
  let focusEffect;
  let cleanup;
  let tree;
  const navigations = [];
  const params = options.params ?? {};
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const react = {
    useRef(value) { const i = hookIndex++; return refs[i] ??= { current: value }; },
    useState(value) { const i = hookIndex++; if (!(i in states)) states[i] = value; return [states[i], (next) => { states[i] = next; }]; },
    useCallback(callback) { return callback; },
    useFocusEffect(callback) { focusEffect = callback; }
  };
  const router = { replace: (path) => navigations.push(path), push: (path) => navigations.push(path), canGoBack: () => false, back() {} };
  const api = evaluate(read(file), {
    process: { env: { EXPO_PUBLIC_WEB_BASE_URL: "https://web.example.test" } },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "expo-router") return { router, useLocalSearchParams: () => params, useFocusEffect: react.useFocusEffect };
      if (name === "expo-linking") return { useURL: () => options.url };
      if (name === "@expo/vector-icons") return { MaterialCommunityIcons: "Icon" };
      if (name === "react-native") return { ImageBackground: "ImageBackground", Linking: { openURL: async () => {} }, Pressable: "Pressable", ScrollView: "ScrollView", StyleSheet: { create: (value) => value }, Text: "Text", TextInput: "TextInput", View: "View", ActivityIndicator: "Spinner" };
      if (name === "@/lib/auth") return { sendMagicLink: options.sendMagicLink ?? (async () => ({ message: "ブラウザで確認" })), handleAuthRedirectUrl: options.handleAuthRedirectUrl };
      if (name === "@/components/MobileSessionProvider") return { useMobileSession: () => ({ status: "signed-out" }) };
      if (name === "@/components/MascotGuide") return { MascotGuide: "MascotGuide", MascotMark: "MascotMark" };
      if (name === "@/lib/theme") return { colors: { green: "green", greenDark: "dark", ink: "ink", muted: "muted", paper: "paper", line: "line", surface: "surface", surfaceSoft: "soft" }, radius: { card: 10, control: 8 }, shadow: {} };
      if (name === "@/lib/mobileData") return { acceptFamilyInvite: options.acceptFamilyInvite ?? (async () => ({ accepted: false })) };
      if (name === "@/lib/handoff") return { consumeWebHandoff: options.consumeWebHandoff ?? (async () => null) };
      if (name === "@/lib/supabase") return { getSupabase: () => options.supabase ?? null };
      if (name.endsWith(".png")) return "synthetic-image";
      throw Error(`Unexpected screen dependency ${name}`);
    }
  });
  function render() { hookIndex = 0; tree = api.default(); return tree; }
  function focus() { cleanup = focusEffect?.(); }
  function blur() { cleanup?.(); cleanup = null; }
  function descendants(node) {
    if (Array.isArray(node)) return node.flatMap(descendants);
    if (!node || typeof node !== "object") return [];
    return [node, ...descendants(node.props?.children)];
  }
  function visibleText(node) {
    if (Array.isArray(node)) return node.map(visibleText).join("");
    if (typeof node === "string") return node;
    return node?.props ? visibleText(node.props.children) : "";
  }
  function enabledPress(label) {
    const button = descendants(tree).find((node) => node.type === "Pressable" && visibleText(node).includes(label));
    assert.ok(button, `button ${label} exists in ${file}`);
    assert.notEqual(button.props.disabled, true, `button ${label} is enabled`);
    return button.props.onPress();
  }
  function input(value) {
    const field = descendants(tree).find((node) => node.type === "TextInput");
    assert.ok(field, `email input exists in ${file}`);
    field.props.onChangeText(value);
  }
  return { render, focus, blur, enabledPress, input, text: () => visibleText(tree), navigations, params, states };
}

for (const [file, params, button, target] of [
  ["apps/mobile/app/(auth)/welcome.tsx", {}, "安全確認をしてメールを送る", "/(tabs)/dashboard"],
  ["apps/mobile/app/invite.tsx", { token: "z".repeat(24) }, "安全確認をしてメールを送る", invite]
]) {
  const first = deferred();
  const second = deferred();
  let sends = 0;
  const screen = screenScenario(file, { params, sendMagicLink: () => (++sends === 1 ? first.promise : second.promise) });
  screen.render(); screen.focus();
  screen.render();
  const input = file.includes("welcome") ? "ここから新規会員登録" : null;
  if (input) screen.enabledPress(input);
  screen.render();
  screen.input(user.email);
  screen.render();
  const old = screen.enabledPress(button);
  screen.enabledPress(button);
  assert.equal(sends, 1, `${file} suppresses immediate duplicate taps`);
  screen.blur();
  screen.render(); screen.focus(); screen.render();
  const fresh = screen.enabledPress(button);
  first.resolve({ message: "本人確認ができました。", redirectPath: target });
  await old;
  assert.deepEqual(screen.navigations, [], `${file} cannot navigate from an older focus period`);
  second.resolve({ message: "本人確認ができました。", redirectPath: target });
  await fresh;
  assert.deepEqual(screen.navigations, [target], `${file} can retry after focus`);
}
for (const [file, params, newTarget, button] of [
  ["apps/mobile/app/(auth)/welcome.tsx", { caseId: "00000000-0000-4000-8000-000000000011", token: `handoff_${"b".repeat(48)}` }, handoff.replace("000000000011", "000000000012"), "安全確認をしてメールを送る"],
  ["apps/mobile/app/invite.tsx", { token: "z".repeat(24) }, `/invite?token=${"y".repeat(24)}`, "安全確認をしてメールを送る"]
]) {
  const old = deferred();
  let calls = 0;
  const screen = screenScenario(file, { params, sendMagicLink: () => (++calls === 1 ? old.promise : Promise.resolve({ message: "確認しました", redirectPath: newTarget })) });
  screen.render(); screen.focus(); screen.render();
  if (file.includes("welcome")) { screen.enabledPress("ここから新規会員登録"); screen.render(); }
  screen.input(user.email); screen.render();
  const oldRequest = screen.enabledPress(button);
  screen.blur();
  if (file.includes("welcome")) params.caseId = "00000000-0000-4000-8000-000000000012";
  else params.token = "y".repeat(24);
  screen.render(); screen.focus(); screen.render();
  old.resolve({ message: "old", redirectPath: "/(tabs)/dashboard" });
  await oldRequest;
  assert.deepEqual(screen.navigations, [], "old target cannot take over changed route");
  await screen.enabledPress(button);
  assert.deepEqual(screen.navigations, [newTarget]);
}
{
  const waiting = deferred();
  const screen = screenScenario("apps/mobile/app/(auth)/welcome.tsx", { sendMagicLink: () => waiting.promise });
  screen.render(); screen.focus(); screen.render();
  screen.enabledPress("ここから新規会員登録"); screen.render();
  screen.input(user.email); screen.render();
  const first = screen.enabledPress("安全確認をしてメールを送る");
  screen.enabledPress("登録済みの方はログイン"); screen.render();
  waiting.resolve({ message: "old form", redirectPath: "/(tabs)/dashboard" });
  await first;
  assert.deepEqual(screen.navigations, [], "changing registration/login mode invalidates the earlier form result");
}
{
  const reads = [];
  const listeners = [];
  const saves = [];
  const supabase = { auth: {
    getSession() { const read = deferred(); reads.push(read); return read.promise; },
    onAuthStateChange(callback) {
      const listener = { callback, unsubscribed: false };
      listeners.push(listener);
      return { data: { subscription: { unsubscribe() { listener.unsubscribed = true; } } } };
    }
  } };
  const screen = screenScenario("apps/mobile/app/handoff.tsx", {
    params: { caseId: "00000000-0000-4000-8000-000000000011", token: `handoff_${"b".repeat(48)}` }, supabase,
    consumeWebHandoff: () => { const save = deferred(); saves.push(save); return save.promise; }
  });
  screen.render(); screen.focus();
  screen.blur();
  assert.equal(listeners[0].unsubscribed, true);
  listeners[0].callback("SIGNED_IN", session);
  reads[0].resolve({ data: { session } });
  await tick();
  assert.equal(saves.length, 0, "hidden handoff ignores queued auth events and old session reads");
  screen.render(); screen.focus();
  listeners[1].callback("SIGNED_IN", session);
  assert.equal(saves.length, 1, "returning to handoff can save the current target");
  reads[1].resolve({ data: { session: null } });
  await tick(); screen.render();
  assert.match(screen.text(), /保存しています。/, "late signed-out read cannot erase a newer sign-in");
  screen.blur();
  screen.render(); screen.focus();
  listeners[2].callback("SIGNED_IN", session);
  assert.equal(saves.length, 2);
  saves[0].reject(Error("old request failed"));
  await tick(); screen.render();
  assert.match(screen.text(), /保存しています。/, "old failure cannot clear a new saving state");
  saves[1].reject(Error("offline"));
  await tick(); screen.render();
  assert.match(screen.text(), /再試行してください/, "communication error is a retryable state");
  const retry = screen.enabledPress("ログイン済みなので保存する");
  assert.equal(saves.length, 3);
  saves[2].resolve({ personId: "synthetic-person", tasksCreated: 2 });
  await retry; await tick();
  assert.equal(JSON.stringify(screen.navigations), JSON.stringify(["/people/synthetic-person/tasks"]));
}
{
  const waiting = deferred();
  const screen = screenScenario("apps/mobile/app/handoff.tsx", {
    params: { caseId: "00000000-0000-4000-8000-000000000011", token: `handoff_${"b".repeat(48)}` },
    supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
    sendMagicLink: () => waiting.promise,
    consumeWebHandoff: async () => ({ personId: "from-result", tasksCreated: 1 })
  });
  screen.render(); screen.focus(); screen.input(user.email); screen.render();
  const login = screen.enabledPress("安全確認をしてメールを送る");
  waiting.resolve({ message: "確認しました", redirectPath: handoff });
  await login; await tick();
  assert.equal(JSON.stringify(screen.navigations), JSON.stringify(["/people/from-result/tasks"]), "result-only handoff saves its current target once");
}
{
  const old = deferred();
  const current = deferred();
  let calls = 0;
  const params = { caseId: "00000000-0000-4000-8000-000000000011", token: `handoff_${"b".repeat(48)}` };
  const screen = screenScenario("apps/mobile/app/handoff.tsx", {
    params, consumeWebHandoff: () => (++calls === 1 ? old.promise : current.promise)
  });
  screen.render(); screen.focus(); screen.render();
  screen.enabledPress("ログイン済みなので保存する");
  screen.blur();
  params.caseId = "00000000-0000-4000-8000-000000000012";
  screen.render(); screen.focus(); screen.render();
  screen.enabledPress("ログイン済みなので保存する");
  old.resolve({ personId: "old-person", tasksCreated: 1 });
  await tick();
  assert.deepEqual(screen.navigations, [], "old handoff target cannot navigate after route change");
  current.resolve({ personId: "current-person", tasksCreated: 1 });
  await tick();
  assert.equal(JSON.stringify(screen.navigations), JSON.stringify(["/people/current-person/tasks"]));
}
{
  const waiting = deferred();
  let calls = 0;
  const screen = screenScenario("apps/mobile/app/auth/complete.tsx", {
    url: callback(), handleAuthRedirectUrl: () => (++calls === 1 ? waiting.promise : Promise.resolve({ handled: true, message: "verified", redirectPath: invite }))
  });
  screen.render(); screen.focus(); screen.blur();
  waiting.resolve({ handled: true, message: "verified", redirectPath: invite });
  await tick();
  assert.deepEqual(screen.navigations, [], "callback result cannot navigate after blur");
  screen.render(); screen.focus(); await tick();
  assert.deepEqual(screen.navigations, [invite], "callback can resume when actively focused again");
}
for (const move of ["blur", "target-change"]) {
  const waiting = deferred();
  let reads = 0;
  const postedTargets = [];
  const supabase = { auth: {
    getSession: () => (++reads === 1 ? Promise.resolve({ data: { session } }) : waiting.promise),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
  } };
  const helper = evaluate(read("apps/mobile/lib/handoff.ts"), {
    process: { env: { EXPO_PUBLIC_WEB_BASE_URL: "https://web.example.test" } },
    require(name) { assert.equal(name, "./supabase"); return { getSupabase: () => supabase }; },
    fetch: async (_url, init) => {
      postedTargets.push(JSON.parse(init.body).caseId);
      return { ok: true, json: async () => ({ personId: "current-person", tasksCreated: 1 }) };
    }
  });
  const screen = screenScenario("apps/mobile/app/handoff.tsx", {
    params: { caseId: "00000000-0000-4000-8000-000000000011", token: `handoff_${"b".repeat(48)}` },
    supabase, consumeWebHandoff: helper.consumeWebHandoff
  });
  screen.render(); screen.focus(); await tick();
  assert.equal(reads, 2, "real handoff helper is waiting for its session read before POST");
  screen.blur();
  if (move === "target-change") {
    screen.params.caseId = "00000000-0000-4000-8000-000000000012";
    screen.render(); screen.focus();
  }
  waiting.resolve({ data: { session } });
  await tick();
  assert.deepEqual(postedTargets, move === "blur" ? [] : ["00000000-0000-4000-8000-000000000012"],
    "only the currently focused target may begin a POST after session read");
  if (move === "blur") assert.deepEqual(screen.navigations, []);
}
for (const move of ["blur", "target-change"]) {
  const waiting = deferred();
  const acceptedTokens = [];
  const supabase = {
    auth: { getSession: async () => ({ data: { session } }), getUser: () => waiting.promise },
    rpc: async (name, args) => {
      assert.equal(name, "accept_family_invite"); acceptedTokens.push(args.p_token); return { error: null };
    }
  };
  const helper = evaluate(read("apps/mobile/lib/mobileData.ts"), {
    process: { env: {} },
    require(name) {
      if (name === "./supabase") return { getSupabase: () => supabase };
      if (name === "@/lib/funnel" || name === "./demoData" || name === "@oyano/shared") return {};
      throw Error(`Unexpected invite dependency ${name}`);
    }
  });
  const screen = screenScenario("apps/mobile/app/invite.tsx", {
    params: { token: "old-token" }, supabase, acceptFamilyInvite: helper.acceptFamilyInvite
  });
  screen.render(); screen.focus(); screen.render();
  const old = screen.enabledPress("共有手帳に参加する"); await tick();
  screen.blur();
  if (move === "target-change") {
    screen.params.token = "current-token";
    screen.render(); screen.focus(); screen.render();
    screen.enabledPress("共有手帳に参加する"); await tick();
  }
  waiting.resolve({ data: { user } }); await old; await tick();
  assert.deepEqual(acceptedTokens, move === "blur" ? [] : ["current-token"],
    "only the currently focused invite may begin joining after user verification");
}
console.log("mobile CAPTCHA auth: PASS (real helpers/handlers; synthetic Auth, storage, email and native links only)");
