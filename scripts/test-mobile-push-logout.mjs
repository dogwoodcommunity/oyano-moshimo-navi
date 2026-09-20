import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Real route/native helpers with in-memory Auth, SecureStore and database only.
// No environment files, network, notifications, real users or provider writes.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const A = "synthetic-owner-a", B = "synthetic-owner-b";
const T1 = "ExponentPushToken[synthetic-device-one]", T2 = "ExpoPushToken[synthetic-device-two]";
const T3 = "ExpoPushToken[synthetic-replacement]", KEY = "oyano.push-device.v1";
const row = (user_id, expo_push_token) => ({ id: `${user_id}-${expo_push_token}`, user_id, expo_push_token, is_active: true });
const record = (tokens = [T1], userId = A) => JSON.stringify({ version: 1, userId, tokens, unsettledTokens: [] });
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

function load(file, require, extra = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true
  } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require, Date, URL, URLSearchParams, ...extra });
  return module.exports;
}

function server(options = {}) {
  const rows = (options.rows ?? []).map((value) => ({ ...value }));
  const writes = [];
  const registrations = [];
  const supabase = {
    auth: { getUser: async (bearer) => {
      if (options.authThrow) throw Error("PRIVATE_PROVIDER_MESSAGE");
      return { data: { user: bearer === "owner-access" ? { id: A } : bearer === "other-access" ? { id: B } : null }, error: null };
    } },
    from(table) {
      assert.ok(["push_tokens", "profiles"].includes(table), "no diary or family mutations");
      let values = null;
      const filters = [];
      const unequalFilters = [];
      const matches = (value) => filters.every(([key, expected]) => value[key] === expected)
        && unequalFilters.every(([key, expected]) => value[key] !== expected);
      const query = {
        async upsert(value) {
          if (table === "profiles") return { error: null };
          registrations.push(value);
          if (options.registrationWriteError) return { error: Error("PRIVATE_PROVIDER_MESSAGE") };
          if (options.registrationWriteThrow) throw Error("PRIVATE_PROVIDER_MESSAGE");
          const existing = rows.find((item) => item.user_id === value.user_id && item.expo_push_token === value.expo_push_token);
          if (existing) Object.assign(existing, value);
          else rows.push({ id: "new-registration", ...value });
          return { error: null };
        },
        update(next) { values = next; return this; },
        select(columns) { assert.equal(columns, "id"); return this; },
        eq(key, expected) { filters.push([key, expected]); return this; },
        neq(key, expected) { unequalFilters.push([key, expected]); return this; },
        async limit(count) {
          assert.equal(count, 1);
          return { data: options.readError ? null : rows.filter(matches).slice(0, count), error: options.readError ? Error("PRIVATE_PROVIDER_MESSAGE") : null };
        },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            assert.equal(values.is_active, false);
            assert.ok(filters.some(([key]) => key === "user_id"));
            assert.ok(filters.some(([key]) => key === "expo_push_token"));
            if (options.writeError) return { error: Error("PRIVATE_PROVIDER_MESSAGE") };
            writes.push(plain(filters));
            if (!options.ignoreUpdate) rows.filter(matches).forEach((value) => Object.assign(value, values));
            return { error: null };
          }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const requireRoute = (name) => {
    if (name === "next/server") return { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } };
    if (name === "@/lib/serverSupabase") return { getServerSupabase: () => options.unconfigured ? null : supabase };
    throw Error(`Unexpected route dependency ${name}`);
  };
  const route = load("apps/web/app/api/push-tokens/unregister/route.ts", requireRoute);
  const registerRoute = load("apps/web/app/api/push-tokens/register/route.ts", requireRoute);
  const request = (body, bearer = "owner-access", raw = false) => route.POST(new Request("https://synthetic.test/api/push-tokens/unregister", {
    method: "POST", headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, body: raw ? body : JSON.stringify(body)
  }));
  const registerRequest = (body, bearer = "owner-access", raw = false) => registerRoute.POST(new Request("https://synthetic.test/api/push-tokens/register", {
    method: "POST", headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, body: raw ? body : JSON.stringify(body)
  }));
  return { rows, writes, request, registerRequest, registrations };
}

{
  const s = server({ rows: [row(A, T1), row(A, T2), row(B, T3)] });
  const response = await s.request({ mode: "revoke", expoPushToken: T1, userId: B });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(s.rows.map((value) => value.is_active), [false, true, true]);
  assert.equal((await s.request({ mode: "revoke", expoPushToken: T1 })).status, 200, "retry is idempotent");
  assert.equal((await s.request({ mode: "revoke", expoPushToken: "ExpoPushToken[absent]" })).status, 200, "absent exact token is verified inactive");
  assert.equal((await s.request({ mode: "check" })).status, 409, "legacy check never removes other devices");
  assert.equal(s.rows[1].is_active, true);
  assert.equal(s.rows[2].is_active, true);
}
{
  const s = server({ rows: [row(A, T1), row(B, T1), row(A, T2)] });
  const response = await s.request({ mode: "revoke", expoPushToken: T1 });
  assert.equal(response.status, 409, "same physical token still registered to another owner cannot be reported stopped");
  assert.deepEqual(s.rows.map((value) => value.is_active), [false, true, true]);
  assert.doesNotMatch(await response.text(), /synthetic-owner|synthetic-device/);
}
for (const [body, bearer, raw, status] of [
  [{ mode: "revoke", expoPushToken: T1 }, null, false, 401],
  [{ mode: "revoke", expoPushToken: T1 }, "expired", false, 401],
  ["{", "owner-access", true, 400], [null, "owner-access", false, 400],
  [{ mode: "revoke" }, "owner-access", false, 400],
  [{ mode: "revoke", expoPushToken: "not-a-token" }, "owner-access", false, 400],
  [{ mode: "check", expoPushToken: T1 }, "owner-access", false, 400],
  ["x".repeat(1025), "owner-access", true, 400]
]) {
  const s = server({ rows: [row(A, T1)] });
  assert.equal((await s.request(body, bearer, raw)).status, status);
  assert.equal(s.writes.length, 0);
}
for (const options of [{ readError: true }, { writeError: true }, { authThrow: true }, { unconfigured: true }, { ignoreUpdate: true }]) {
  const s = server({ ...options, rows: [row(A, T1)] });
  const response = await s.request({ mode: "revoke", expoPushToken: T1 });
  assert.ok(response.status >= 400);
  assert.doesNotMatch(await response.text(), /PRIVATE|synthetic-device/);
}
for (const [body, bearer, raw, status] of [
  [{ expoPushToken: T1 }, null, false, 401], [{ expoPushToken: T1 }, "expired", false, 401],
  ["{", "owner-access", true, 400], [null, "owner-access", false, 400],
  [{ expoPushToken: "invalid" }, "owner-access", false, 400],
  [{ expoPushToken: T1, deviceName: 123 }, "owner-access", false, 400]
]) {
  const s = server();
  const response = await s.registerRequest(body, bearer, raw);
  assert.equal(response.status, status);
  assert.equal((await response.json()).registrationState, "not_written");
  assert.equal(s.registrations.length, 0);
}
{
  const s = server({ rows: [row(B, T2)] });
  const response = await s.registerRequest({ expoPushToken: T1, platform: "ios", userId: B });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(s.registrations[0].user_id, A, "registration owner comes from verified Auth, never the body");
  assert.equal(s.rows[0].is_active, true);
}
{
  const s = server({ rows: [row(B, T1)] });
  const response = await s.registerRequest({ expoPushToken: T1 });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).registrationState, "not_written");
  assert.equal(s.registrations.length, 0, "do not adopt another owner's active physical token");
  assert.equal(s.rows[0].is_active, true);
}
for (const options of [{ readError: true }, { authThrow: true }, { unconfigured: true }]) {
  const s = server(options);
  const response = await s.registerRequest({ expoPushToken: T1 });
  assert.equal((await response.json()).registrationState, "not_written");
  assert.equal(s.registrations.length, 0);
}
for (const options of [{ registrationWriteError: true }, { registrationWriteThrow: true }]) {
  const s = server(options);
  const response = await s.registerRequest({ expoPushToken: T1 });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).registrationState, undefined, "an attempted write cannot issue a definitive non-write receipt");
}

function native(options = {}) {
  const s = server(options);
  let userId = A, token = options.token ?? T1;
  const storage = new Map(options.stored === undefined ? [] : [[KEY, options.stored]]);
  const events = [];
  const delayedRegistrations = [];
  const calls = { permissionRequests: 0, permissionReads: 0, registration: 0, signOut: 0 };
  const supabase = { auth: {
    getSession: async () => ({ data: { session: userId ? { user: { id: userId }, access_token: userId === A ? "owner-access" : "other-access" } : null } }),
    signOut: async (input) => {
      assert.deepEqual(plain(input), { scope: "local" });
      calls.signOut++;
      events.push("signOut");
      options.signOutStarted?.resolve();
      if (options.pauseSignOut) await options.pauseSignOut;
      if (options.signOutError) return { error: Error("offline") };
      userId = null;
      return { error: null };
    }
  } };
  const secure = {
    getItemAsync: async (key) => { if (options.storageReadError) throw Error("locked"); return storage.get(key) ?? null; },
    setItemAsync: async (key, value) => { if (options.storageWriteError) throw Error("locked"); storage.set(key, value); events.push("persist"); },
    deleteItemAsync: async (key) => { storage.delete(key); }
  };
  const notifications = {
    requestPermissionsAsync: async () => {
      calls.permissionRequests++;
      options.permissionStarted?.resolve();
      if (options.pausePermission) await options.pausePermission;
      return { granted: options.granted ?? true };
    },
    getPermissionsAsync: async () => { calls.permissionReads++; return { granted: options.granted ?? true }; },
    getExpoPushTokenAsync: async () => {
      if (options.tokenError) throw Error("offline");
      return { data: token };
    }
  };
  const api = load("apps/mobile/lib/notifications.ts", (name) => {
    if (name === "react-native") return { Platform: { OS: "ios" } };
    if (name === "expo-secure-store") return secure;
    if (name === "expo-notifications") return notifications;
    if (name === "./supabase") return { getSupabase: () => supabase };
    throw Error(`Unexpected native dependency ${name}`);
  }, {
    process: { env: { EXPO_PUBLIC_WEB_BASE_URL: "https://synthetic.test", EXPO_PUBLIC_EAS_PROJECT_ID: "synthetic-project" } },
    fetch: async (url, init) => {
      if (options.offline) throw Error("offline");
      const body = JSON.parse(init.body);
      if (url.endsWith("/unregister")) {
        events.push(body.mode);
        const result = await s.request(body, init.headers.Authorization.replace("Bearer ", ""));
        if (options.changeUserOnRevoke && body.mode === "revoke") userId = B;
        return result;
      }
      assert.ok(url.endsWith("/register"));
      calls.registration++;
      events.push("register");
      assert.ok(JSON.parse(storage.get(KEY)).tokens.includes(body.expoPushToken), "token is durable before server registration");
      if (options.registrationRejected && calls.registration === 1) {
        return new Response(JSON.stringify(options.unmarkedRejection ? { error: "unauthorized" } : { error: "unauthorized", registrationState: "not_written" }), { status: options.registrationRejected });
      }
      const commit = () => {
        const existing = s.rows.find((value) => value.user_id === A && value.expo_push_token === body.expoPushToken);
        if (existing) existing.is_active = true;
        else s.rows.push(row(A, body.expoPushToken));
      };
      if (options.delayRegistrationCommit) {
        delayedRegistrations.push(commit);
        throw Error("connection lost before server commit");
      }
      commit();
      if (options.lostRegistrationResponse) throw Error("lost response");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  });
  const auth = load("apps/mobile/lib/auth.ts", (name) => {
    if (name === "./notifications") return api;
    if (name === "./supabase") return { getSupabase: () => supabase };
    if (name === "expo-secure-store") return secure;
    if (name === "./authFlow") return { MOBILE_AUTH_PENDING_KEY: "pending-auth" };
    if (name === "expo-linking" || name === "expo-crypto") return {};
    throw Error(`Unexpected auth dependency ${name}`);
  });
  return { ...s, api, auth, storage, calls, events, userId: () => userId,
    commitDelayedRegistrations: () => delayedRegistrations.forEach((commit) => commit()) };
}

{
  const n = native({ stored: record(), rows: [row(A, T1), row(A, T2), row(B, T3)] });
  assert.equal((await n.auth.signOutThisDevice()).ok, true);
  assert.deepEqual(n.rows.map((value) => value.is_active), [false, true, true]);
  assert.equal(n.userId(), null);
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).tokens, []);
  assert.ok(n.events.indexOf("revoke") < n.events.indexOf("signOut"));
}
for (const stored of [undefined, record(), record([])]) {
  const n = native({ stored, rows: [row(B, T1)] });
  const result = await n.auth.signOutThisDevice();
  assert.equal(result.ok, false, "another owner's active row for this exact physical token blocks logout even without a local mapping");
  assert.equal(n.calls.signOut, 0);
  assert.equal(n.rows[0].is_active, true, "another owner's token is never disabled");
  assert.equal((await n.api.registerPushToken()).saved, false);
  assert.equal(n.calls.registration, 0, "registration cannot adopt the conflicting device token");
}
{
  const n = native({ granted: false });
  assert.equal((await n.auth.signOutThisDevice()).ok, true, "a brand-new installation that denied notifications can still log out");
  assert.equal(n.calls.signOut, 1);
  assert.equal(n.calls.permissionRequests, 0);
}
for (const options of [
  { offline: true }, { readError: true }, { writeError: true }, { ignoreUpdate: true },
  { storageReadError: true }, { storageWriteError: true }, { stored: "corrupt" },
  { stored: record([T1], B) }, { changeUserOnRevoke: true }
]) {
  const n = native({ stored: record(), rows: [row(A, T1)], ...options });
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  assert.equal(n.calls.signOut, 0, "uncertain token cleanup must retain the authenticated session");
}
{
  const n = native({ stored: record(), rows: [row(A, T1)], signOutError: true });
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  assert.equal(n.userId(), A);
  assert.equal(n.rows[0].is_active, false, "failed Auth sign-out does not reactivate notifications");
}
{
  const n = native({ rows: [row(B, T2)] });
  assert.equal((await n.auth.signOutThisDevice()).ok, true, "never-registered owner can sign out");
  assert.equal(n.rows[0].is_active, true);
  assert.equal(n.calls.permissionRequests, 0);
}
{
  const n = native({ rows: [row(A, T1)] });
  assert.equal((await n.auth.signOutThisDevice()).ok, true, "legacy current token alone can be recovered and verified");
  assert.equal(n.calls.permissionReads, 1);
  assert.equal(n.calls.permissionRequests, 0, "logout must never prompt for notification permission");
  assert.equal(n.rows[0].is_active, false);
}
for (const options of [{ rows: [row(A, T2)] }, { rows: [row(A, T1)], granted: false }, { rows: [row(A, T1)], tokenError: true }]) {
  const n = native(options);
  const result = await n.auth.signOutThisDevice();
  assert.equal(result.ok, false);
  assert.match(result.message, options.tokenError ? /通知解除を確認できない/ : /以前の通知登録/);
  assert.equal(n.calls.signOut, 0);
  assert.equal(n.calls.permissionRequests, 0);
  assert.equal(n.rows[0].is_active, true, "unknown legacy token never gets guessed or bulk-removed");
}
for (const status of [400, 401, 409, 501, 503]) {
  const n = native({ registrationRejected: status });
  assert.equal((await n.api.registerPushToken()).saved, false);
  assert.equal(n.rows.length, 0);
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).unsettledTokens, [], "definitive non-write receipt allows recovery");
  assert.equal((await n.api.registerPushToken()).saved, true, "a later valid request can retry a definite rejection");
  assert.equal(n.calls.registration, 2);
  assert.equal((await n.auth.signOutThisDevice()).ok, true);
  assert.equal(n.rows[0].is_active, false);
}
{
  const n = native({ registrationRejected: 401 });
  await n.api.registerPushToken();
  assert.equal((await n.auth.signOutThisDevice()).ok, true, "definite rejection does not force re-registration before logout");
}
{
  const n = native({ registrationRejected: 401, unmarkedRejection: true });
  await n.api.registerPushToken();
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).unsettledTokens, [T1], "a bare 401 might be intermediary-generated and is not a non-write receipt");
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
}
{
  const n = native({ rows: [row(A, T1), row(A, T2)] });
  assert.equal((await n.auth.signOutThisDevice()).ok, false, "unknown historical/other-device tokens remain explicitly unresolved");
  assert.deepEqual(n.rows.map((value) => value.is_active), [false, true]);
}
{
  const n = native({ stored: record(), rows: [row(A, T1), row(A, T2)], token: T3 });
  assert.equal((await n.api.registerPushToken()).saved, true);
  assert.deepEqual(n.rows.map((value) => value.is_active), [false, true, true]);
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).tokens, [T3]);
  assert.equal((await n.auth.signOutThisDevice()).ok, true);
  assert.deepEqual(n.rows.map((value) => value.is_active), [false, true, false]);
}
{
  const n = native({ stored: record(), rows: [row(A, T1)], token: T3, writeError: true });
  assert.equal((await n.api.registerPushToken()).saved, false);
  assert.equal(n.calls.registration, 0, "replacement waits for previous token's verified revocation");
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).tokens, [T1, T3]);
}
{
  const n = native({ lostRegistrationResponse: true });
  assert.equal((await n.api.registerPushToken()).saved, false);
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).tokens, [T1]);
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).unsettledTokens, [T1]);
  const result = await n.auth.signOutThisDevice();
  assert.equal(result.ok, false, "unknown completion cannot rule out a registration committing after revocation");
  assert.match(result.message, /通信結果が未確認/);
  assert.equal(n.calls.signOut, 0);
  assert.equal(n.rows[0].is_active, false);
  assert.deepEqual(JSON.parse(n.storage.get(KEY)).unsettledTokens, [T1], "uncertain registrations stay durable for recovery");
  assert.equal((await n.api.registerPushToken()).reason, "registration_unverified");
  assert.equal(n.calls.registration, 1, "do not start more writes while an older write may still be pending");
}
{
  const n = native({ delayRegistrationCommit: true });
  assert.equal((await n.api.registerPushToken()).saved, false);
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  assert.equal(n.rows.length, 0, "even a verified absence cannot settle a registration still executing on the server");
  n.commitDelayedRegistrations();
  assert.equal(n.rows[0].is_active, true);
  assert.equal(n.userId(), A, "a late server commit must not reach a falsely signed-out device");
  const restarted = native({ stored: n.storage.get(KEY), rows: n.rows });
  assert.equal((await restarted.auth.signOutThisDevice()).ok, false, "process restart cannot discard unresolved registration state");
  assert.equal(restarted.rows[0].is_active, false, "best-effort exact revocation is retried without claiming recovery");
}
{
  const permission = deferred(), started = deferred(), signout = deferred(), signOutStarted = deferred();
  const n = native({ pausePermission: permission.promise, permissionStarted: started, pauseSignOut: signout.promise, signOutStarted });
  const registering = n.api.registerPushToken();
  await started.promise;
  const logout = n.auth.signOutThisDevice();
  permission.resolve();
  assert.equal((await registering).saved, true);
  await signOutStarted.promise;
  const lateRegister = n.api.registerPushToken();
  signout.resolve();
  assert.equal((await logout).ok, true);
  assert.equal((await lateRegister).reason, "login_required");
  assert.equal(n.calls.registration, 1);
  assert.equal(n.rows[0].is_active, false, "registration cannot race past logout revocation");
}
for (const options of [{ storageWriteError: true }, { granted: false }, { tokenError: true }]) {
  const n = native(options);
  assert.equal((await n.api.registerPushToken()).saved, false);
  assert.equal(n.calls.registration, 0);
}
assert.doesNotMatch(read("apps/mobile/lib/notifications.ts"), /console\.|from\("push_tokens"\)/, "no token logging or fallback that bypasses lifecycle verification");
assert.doesNotMatch(read("apps/web/app/api/push-tokens/unregister/route.ts"), /console\.|\.delete\(/);
console.log("mobile push logout: ok (exact owner/token, verified revocation, other-device preservation, secure pending tokens, replacement, offline, legacy recovery and signout races; synthetic only)");
