import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// In-memory transports only; actual SQL/concurrency/ACL is tested separately by
// test-push-installation-sql.sh. Never contacts Auth, Expo or a live database.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const I = "33333333-3333-4333-8333-333333333333", R = "44444444-4444-4444-8444-444444444444";
const T1 = "ExpoPushToken[synthetic-one]", T2 = "ExpoPushToken[synthetic-two]";
const KEY = "oyano.push-installation.v2", LEGACY = "oyano.push-device.v1";
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
function load(file, require, extra = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require, Date, URL, URLSearchParams, ...extra });
  return module.exports;
}
function apiFixture(options = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async (bearer) => ({ data: { user: bearer === "valid" ? { id: A } : null }, error: null }) },
    from(table) {
      assert.equal(table, "profiles", "route cannot write token table directly");
      return { upsert: async (body, opts) => {
        assert.deepEqual(plain(body), { id: A });
        assert.equal(opts.ignoreDuplicates, true, "do not overwrite existing profile details");
        return { error: options.profileError ? Error("PRIVATE") : null };
      } };
    },
    async rpc(name, body) {
      calls.push([name, plain(body)]);
      return { data: options.result ?? { ok: true, installationId: body.p_installation_id, revision: body.p_revision,
        requestId: body.p_request_id, state: body.p_action === "register" ? "active" : "revoked" },
        error: options.rpcError ? Error("PRIVATE") : null };
    }
  };
  const helper = load("apps/web/lib/pushInstallation.ts", (name) => {
    if (name === "next/server") return { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } };
    if (name === "./serverSupabase") return { getServerSupabase: () => options.unconfigured ? null : client };
    throw Error("Unexpected API import " + name);
  }, { process: { env: { PUSH_INSTALLATION_V2_ENABLED: options.disabled ? "false" : "true" } } });
  const routes = {};
  for (const route of ["register", "unregister"]) routes[route] = load("apps/web/app/api/push-tokens/" + route + "/route.ts", (name) => {
    assert.equal(name, "@/lib/pushInstallation"); return helper;
  });
  return { calls, client, helper, request: (body, route = "register", bearer = "valid", raw = false) => routes[route].POST(new Request("https://example.test", {
    method: "POST", headers: bearer ? { Authorization: "Bearer " + bearer } : {}, body: raw ? body : JSON.stringify(body)
  })) };
}
const payload = (overrides = {}) => ({ protocol: 2, installationId: I, secret: "a".repeat(64), revision: 1,
  requestId: R, expoPushToken: T1, platform: "ios", ...overrides });
{
  const f = apiFixture();
  const response = await f.request(payload({ userId: B }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(f.calls[0][1].p_user_id, A, "body cannot replace authenticated owner");
  assert.equal(f.calls[0][1].p_action, "register");
  assert.equal((await f.request(payload({ expoPushToken: undefined, platform: undefined }), "unregister")).status, 200);
  assert.equal(f.calls[1][1].p_action, "revoke");
  assert.equal(f.calls[1][1].p_token, null);
}
for (const [body, route, bearer, raw, status] of [
  [payload(), "register", null, false, 401], [payload(), "register", "bad", false, 401],
  [{ expoPushToken: T1 }, "register", "valid", false, 426],
  [{ mode: "check" }, "unregister", "valid", false, 426],
  ["{", "register", "valid", true, 400], ["x".repeat(2049), "register", "valid", true, 400],
  [payload({ revision: 0 }), "register", "valid", false, 400],
  [payload({ revision: Number.MAX_SAFE_INTEGER + 1 }), "register", "valid", false, 400],
  [payload({ secret: "short" }), "register", "valid", false, 400],
  [payload({ requestId: "wrong" }), "register", "valid", false, 400],
  [payload({ expoPushToken: "wrong" }), "register", "valid", false, 400],
  [payload(), "unregister", "valid", false, 400]
]) {
  const f = apiFixture();
  assert.equal((await f.request(body, route, bearer, raw)).status, status);
  assert.equal(f.calls.length, 0);
}
for (const options of [{ disabled: true }, { unconfigured: true }, { rpcError: true }, { profileError: true },
  { result: { ok: true, installationId: I, requestId: R, revision: 2, state: "active" } },
  { result: { error: "PRIVATE_PROVIDER_MESSAGE" } }]) {
  const f = apiFixture(options);
  const response = await f.request(payload());
  assert.ok(response.status >= 400);
  assert.doesNotMatch(await response.text(), /PRIVATE|synthetic-one|aaaaaa/);
}
{
  const f = apiFixture();
  await f.helper.invalidatePushDelivery(f.client, [
    { id: I, user_id: A, expo_push_token: T1, installation_id: I, installation_revision: 4 },
    { id: R, user_id: A, expo_push_token: T2, installation_id: R, installation_revision: 9 }
  ], [T1]);
  assert.deepEqual(f.calls, [["invalidate_push_delivery_v2", { p_id: I, p_revision: 4, p_token: T1 }]],
    "delivery failures carry the exact sent generation, not the token alone");
}

function transport() {
  const rows = new Map();
  const calls = [];
  function apply(body, action, ownerId) {
    const row = rows.get(body.installationId);
    if (row?.state === "erased") return { error: "installation_retired" };
    if (row && row.revision > body.revision) return { error: "stale_revision" };
    if (row && row.secret !== body.secret) return { error: "installation_conflict" };
    if (row && row.ownerId !== ownerId && row.state !== "revoked") return { error: "installation_conflict" };
    if (row && row.revision === body.revision && row.requestId !== body.requestId) return { error: "revision_conflict" };
    const state = action === "register" ? "active" : "revoked";
    rows.set(body.installationId, { ...body, ownerId, state });
    return { ok: true, installationId: body.installationId, revision: body.revision, requestId: body.requestId, state };
  }
  return { rows, calls, apply };
}
function native(options = {}) {
  const storage = options.storage ?? new Map();
  const backend = options.backend ?? transport();
  let userId = A, token = T1, nonce = options.seed ?? 10;
  const calls = { signOut: 0, permissions: 0, tokens: 0 };
  const delayed = [];
  const secure = {
    getItemAsync: async (key) => { if (options.readError) throw Error("locked"); return storage.get(key) ?? null; },
    setItemAsync: async (key, value) => { if (options.writeError) throw Error("locked"); storage.set(key, value); },
    deleteItemAsync: async (key) => { storage.delete(key); }
  };
  const supabase = { auth: {
    getSession: async () => ({ data: { session: userId ? { user: { id: userId }, access_token: userId } : null }, error: null }),
    signOut: async (scope) => {
      assert.deepEqual(plain(scope), { scope: "local" });
      calls.signOut++;
      options.signOutStarted?.resolve();
      if (options.signOutPause) await options.signOutPause;
      if (options.signOutError) return { error: Error("offline") };
      userId = null; return { error: null };
    }
  } };
  const helper = load("apps/mobile/lib/pushInstallation.ts", (name) => {
    if (name === "react-native") return { Platform: { OS: "ios" } };
    if (name === "expo-secure-store") return secure;
    if (name === "./supabase") return { getSupabase: () => supabase };
    if (name === "expo-crypto") return {
      randomUUID: () => "00000000-0000-4000-8000-" + String(++nonce).padStart(12, "0"),
      getRandomBytesAsync: async () => new Uint8Array(32).fill(nonce)
    };
    if (name === "expo-notifications") return {
      requestPermissionsAsync: async () => {
        calls.permissions++; options.permissionStarted?.resolve();
        if (options.permissionPause) await options.permissionPause;
        return { granted: options.granted ?? true };
      },
      getExpoPushTokenAsync: async () => { calls.tokens++; if (options.tokenError) throw Error("offline"); return { data: token }; }
    };
    throw Error("Unexpected native import " + name);
  }, { process: { env: { EXPO_PUBLIC_WEB_BASE_URL: "https://example.test" } },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body), action = url.endsWith("/register") ? "register" : "revoke";
      const stored = JSON.parse(storage.get(KEY));
      assert.equal(stored.pending.requestId, body.requestId);
      assert.equal(stored.pending.revision, body.revision, "durable operation precedes every network request");
      backend.calls.push({ body, action });
      if (options.offline) throw Error("offline");
      if (options.rejectOnce && backend.calls.length === 1) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
      const commit = () => backend.apply(body, action, init.headers.Authorization.slice(7));
      if (options.delayRegister && action === "register") { delayed.push(commit); throw Error("lost response"); }
      const response = commit();
      if (options.loseRevokeOnce && action === "revoke" && backend.calls.filter((call) => call.action === "revoke").length === 1) throw Error("lost ack");
      if (options.wrongReceipt) response.requestId = R;
      return new Response(JSON.stringify(response), { status: response.ok ? 200 : 409 });
    }
  });
  const auth = load("apps/mobile/lib/auth.ts", (name) => {
    if (name === "./notifications") return helper;
    if (name === "./supabase") return { getSupabase: () => supabase };
    if (name === "expo-secure-store") return secure;
    if (name === "./authFlow") return { MOBILE_AUTH_PENDING_KEY: "pending-auth" };
    if (["expo-linking", "expo-crypto"].includes(name)) return {};
    throw Error("Unexpected auth import " + name);
  });
  return { helper, auth, calls, storage, backend, delayed, user: () => userId,
    switchUser: (id) => { userId = id; }, changeToken: (next) => { token = next; } };
}
{
  const n = native();
  assert.equal((await n.helper.registerPushToken()).saved, true);
  const identity = JSON.parse(n.storage.get(KEY));
  assert.equal((await n.auth.signOutThisDevice()).ok, true);
  assert.equal(n.backend.rows.get(identity.id).state, "revoked");
  assert.equal(n.backend.rows.get(identity.id).revision, 2);
  assert.equal(n.calls.tokens, 1, "logout never needs an OS token or a permission prompt");
  assert.equal(n.calls.permissions, 1);
  assert.equal(JSON.parse(n.storage.get(KEY)).id, identity.id, "logout preserves installation identity/tombstone proof");
  n.switchUser(B);
  assert.equal((await n.helper.registerPushToken()).saved, true, "a revoked device can bind the next owner");
  assert.equal(n.backend.rows.get(identity.id).ownerId, B);
}
{
  const backend = transport(), first = native({ backend, seed: 10 }), second = native({ backend, seed: 20 });
  second.changeToken(T2);
  await first.helper.registerPushToken(); await second.helper.registerPushToken();
  await first.auth.signOutThisDevice();
  assert.equal([...backend.rows.values()].filter((row) => row.state === "active").length, 1, "other installation remains active");
}
{
  const n = native({ delayRegister: true });
  assert.equal((await n.helper.registerPushToken()).saved, false);
  assert.equal((await n.auth.signOutThisDevice()).ok, true, "newer revoke settles an uncertain old registration");
  assert.equal(n.delayed[0]().error, "stale_revision", "late register cannot resurrect revoked generation");
  assert.equal([...n.backend.rows.values()][0].state, "revoked");
}
{
  const n = native({ loseRevokeOnce: true });
  await n.helper.registerPushToken();
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  const pending = JSON.parse(n.storage.get(KEY)).pending;
  const restarted = native({ backend: n.backend, storage: n.storage });
  assert.equal((await restarted.auth.signOutThisDevice()).ok, true);
  assert.deepEqual(n.backend.calls.at(-1).body.requestId, pending.requestId);
  assert.equal(n.backend.calls.at(-1).body.revision, pending.revision, "restart retries exactly the durable revoke");
}
{
  const n = native();
  await n.helper.registerPushToken();
  const oldId = JSON.parse(n.storage.get(KEY)).id;
  n.backend.rows.set(oldId, { state: "erased" });
  // Real erasure logs the old user out; a later account may reuse the app.
  n.switchUser(B);
  assert.equal((await n.helper.registerPushToken()).saved, true);
  assert.notEqual(JSON.parse(n.storage.get(KEY)).id, oldId);
  assert.equal(n.backend.rows.get(oldId).state, "erased", "local reset never resurrects erased server identity");
}
{
  const n = native();
  await n.helper.registerPushToken();
  const oldId = JSON.parse(n.storage.get(KEY)).id;
  n.switchUser(B);
  assert.equal((await n.helper.registerPushToken()).saved, false, "a changed local Auth session cannot take an active old owner's installation");
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  assert.equal(n.backend.rows.get(oldId).ownerId, A);
  assert.equal(n.backend.rows.get(oldId).state, "active");
  assert.equal(JSON.parse(n.storage.get(KEY)).id, oldId, "ownership conflict never mints a replacement identity");
}
{
  const n = native({ rejectOnce: true });
  assert.equal((await n.helper.registerPushToken()).saved, false);
  assert.equal((await n.helper.registerPushToken()).saved, true, "401 followed by refreshed credentials can retry");
  assert.equal(n.backend.calls[0].body.requestId, n.backend.calls[1].body.requestId);
  assert.equal((await n.auth.signOutThisDevice()).ok, true);
}
{
  const n = native();
  await n.helper.registerPushToken();
  n.changeToken(T2);
  assert.equal((await n.helper.registerPushToken()).saved, true);
  assert.equal([...n.backend.rows.values()][0].expoPushToken, T2);
  assert.equal([...n.backend.rows.values()][0].revision, 2);
}
for (const options of [{ readError: true }, { writeError: true }, { offline: true }, { wrongReceipt: true }]) {
  const n = native(options);
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  assert.equal(n.calls.signOut, 0, "unverified or unpersisted revocation cannot clear Auth");
}
{
  const n = native({ granted: false });
  assert.equal((await n.helper.registerPushToken()).reason, "permission_denied");
  assert.equal((await n.auth.signOutThisDevice()).ok, true, "notification denial never blocks a fresh v2 device's logout");
  assert.equal(n.calls.tokens, 0);
}
for (const raw of ["corrupt", JSON.stringify({ version: 1, tokens: [T1], unsettledTokens: [] })]) {
  const n = native({ storage: new Map([[LEGACY, raw]]) });
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  assert.equal(n.backend.calls.length, 0, "legacy registration is not silently adopted or removed");
  assert.equal(n.storage.get(LEGACY), raw);
}
{
  const n = native({ signOutError: true });
  await n.helper.registerPushToken();
  assert.equal((await n.auth.signOutThisDevice()).ok, false);
  assert.equal([...n.backend.rows.values()][0].state, "revoked");
  assert.equal(n.user(), A);
}
{
  const permission = deferred(), permissionStarted = deferred(), signOutPause = deferred(), signOutStarted = deferred();
  const n = native({ permissionPause: permission.promise, permissionStarted, signOutPause: signOutPause.promise, signOutStarted });
  const register = n.helper.registerPushToken();
  await permissionStarted.promise;
  const logout = n.auth.signOutThisDevice();
  permission.resolve();
  assert.equal((await register).saved, true);
  await signOutStarted.promise;
  const late = n.helper.registerPushToken();
  signOutPause.resolve();
  assert.equal((await logout).ok, true);
  assert.equal((await late).reason, "login_required");
  assert.equal([...n.backend.rows.values()][0].state, "revoked");
}
assert.doesNotMatch(read("apps/mobile/lib/pushInstallation.ts"), /console\.|from\("push_tokens"\)/);
for (const file of ["apps/web/app/api/family/notify/route.ts", "apps/web/app/api/cron/send-due-notifications/route.ts"]) {
  const source = read(file);
  assert.match(source, /list_deliverable_push_tokens_v2/);
  assert.match(source, /invalidatePushDelivery/);
  assert.doesNotMatch(source, /from\("push_tokens"\)/);
}
console.log("mobile push v2: PASS (real API/native helpers; durable revisions, retries, lost responses, owner/installation isolation; synthetic transport, SQL tested separately)");
