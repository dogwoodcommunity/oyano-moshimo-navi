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
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true
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
  let randomness = 0;
  const calls = [];
  const native = { auth: {
    getSession: async () => ({ data: { session: currentUser ? { user: currentUser } : null }, error: options.sessionError ?? null }),
    setSession: async (tokens) => { calls.push(["setSession", tokens]); currentUser = user; return { error: options.setError ?? null }; }
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
      if (name === "./supabase") return { getSupabase: () => options.unconfigured ? null : native, createMobileAuthVerifier: () => verifier };
      if (name === "expo-crypto") return { getRandomBytesAsync: async () => new Uint8Array(32).fill(++randomness) };
      if (name === "expo-linking") return { openURL: async (url) => { calls.push(["openURL", url]); if (options.openFailure) throw Error("offline"); } };
      if (name === "expo-secure-store") return {
        getItemAsync: async () => stored,
        setItemAsync: async (_key, value) => { if (options.storeFailure) throw Error("locked"); stored = value; calls.push(["store"]); },
        deleteItemAsync: async () => { stored = null; calls.push(["remove"]); }
      };
      throw Error(`Unexpected native dependency ${name}`);
    }
  });
  return { api, calls, stored: () => stored, currentUser: () => currentUser };
}

for (const redirectPath of [handoff, invite, "/(tabs)/dashboard"]) {
  const fixture = nativeScenario({ pending: pending({ redirectPath }) });
  const result = await fixture.api.handleAuthRedirectUrl(callback());
  assert.equal(result.handled, true);
  assert.equal(result.redirectPath, redirectPath);
  assert.equal(fixture.stored(), null);
  assert.deepEqual(fixture.calls.map(([method]) => method), ["getUser", "refreshSession", "getUser", "remove", "setSession"]);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback())).handled, false, "consumed nonce cannot be replayed");
  assert.equal(fixture.calls.filter(([method]) => method === "setSession").length, 1);
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
  assert.equal(fixture.calls.find(([method]) => method === "openURL")[1], `https://web.example.test/auth/mobile#state=${firstState}`);
  await fixture.api.sendMagicLink(user.email, invite);
  assert.notEqual(JSON.parse(fixture.stored()).state, firstState);
  assert.equal((await fixture.api.handleAuthRedirectUrl(callback(firstState))).handled, false, "resend invalidates the earlier nonce");
}
for (const options of [{ openFailure: true }, { storeFailure: true }, { webBase: "http://unsafe.test" }]) {
  const fixture = nativeScenario(options);
  const result = await fixture.api.sendMagicLink(user.email);
  assert.equal(result.browserOpened, undefined);
  assert.equal(result.demo, false);
  assert.equal(fixture.stored(), null);
}
assert.equal((await nativeScenario({ unconfigured: true }).api.sendMagicLink(user.email)).demo, true);

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
{
  const calls = [];
  const api = evaluate(`${functionSource("apps/mobile/app/(auth)/welcome.tsx", "continueToApp")}\nexport { continueToApp };`, {
    submitting: false, email: user.email, hasHandoff: false, setSubmitting() {}, setMessage() {},
    sendMagicLink: async () => ({ sent: false, demo: false, browserOpened: true, message: "ブラウザで確認" }),
    consumeWebHandoff: async () => { calls.push("handoff"); }, router: { replace: () => calls.push("navigate") }
  });
  await api.continueToApp();
  assert.deepEqual(calls, [], "opening CAPTCHA must not bypass login or prematurely consume handoff");
}
console.log("mobile CAPTCHA auth: PASS (real helpers/handlers; synthetic Auth, storage, email and native links only)");
