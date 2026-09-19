import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual route and dedicated rate helper; all Auth/RPC clients are synthetic.
// No environment file, real request, guest account, persistent data or AI call.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const ts = requireWeb("typescript");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const routeSource = read("apps/web/app/api/consult/guest/route.ts");
const rateSource = read("apps/web/lib/consultGuestRateLimit.ts");
const fixtureEnv = {
  CONSULT_GUEST_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-project.example",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-anon-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "synthetic-public-turnstile-key",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-rate-only-secret"
};
const requestUrl = "https://synthetic-notebook.example/api/consult/guest";
function request({ body = { captchaToken: "synthetic-captcha-token" }, headers = {} } = {}) {
  const values = new Headers({
    origin: "https://synthetic-notebook.example", "content-type": "application/json",
    "sec-fetch-site": "same-origin", "x-forwarded-for": "192.0.2.7", "user-agent": "synthetic-browser"
  });
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) values.delete(name);
    else values.set(name, value);
  }
  return new Request(requestUrl, { method: "POST", headers: values, body: typeof body === "string" ? body : JSON.stringify(body) });
}
function harness({ env = {}, rateResults = [], noRateClient = false, authError = null, authData, throwAuth = false } = {}) {
  const rpcCalls = [];
  const publicClients = [];
  const signupCalls = [];
  let serverClientCalls = 0;
  const environment = { ...fixtureEnv, ...env };
  const contextBase = {
    process: { env: environment }, URL, TextDecoder, Uint8Array,
    fetch: () => { throw new Error("real fetch is forbidden in this test"); }
  };
  function evaluate(source, mocks) {
    const module = { exports: {} };
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    vm.runInNewContext(compiled, {
      ...contextBase, module, exports: module.exports,
      require(name) {
        if (name in mocks) return mocks[name];
        if (name === "node:crypto" || name === "node:net") return requireWeb(name);
        throw new Error(`Unexpected guest admission import: ${name}`);
      }
    });
    return module.exports;
  }
  const rates = evaluate(rateSource, {
    "@/lib/serverSupabase": {
      getServerSupabase() {
        serverClientCalls++;
        if (noRateClient) return null;
        return new Proxy({
          async rpc(name, args) {
            assert.equal(name, "check_public_api_rate_limit", "privileged client may only consume the atomic rate counter");
            rpcCalls.push(JSON.parse(JSON.stringify(args)));
            const result = rateResults[rpcCalls.length - 1];
            if (result instanceof Error) throw result;
            return result ?? { data: { allowed: true, retry_after: 0 }, error: null };
          }
        }, { get(target, key) {
          assert.equal(key, "rpc", "privileged client must never create Auth users or mutate another resource");
          return target[key];
        } });
      }
    }
  });
  const route = evaluate(routeSource, {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/consultGuestRateLimit": rates,
    "@supabase/supabase-js": {
      createClient(url, key, options) {
        assert.equal(url, fixtureEnv.NEXT_PUBLIC_SUPABASE_URL);
        assert.equal(key, fixtureEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, "signup uses the public anon key, never the privileged rate key");
        assert.deepEqual(JSON.parse(JSON.stringify(options.auth)), {
          persistSession: false, autoRefreshToken: false, detectSessionInUrl: false
        });
        publicClients.push({ url, key });
        return { auth: new Proxy({
          async signInAnonymously(options) {
            signupCalls.push(JSON.parse(JSON.stringify(options)));
            if (throwAuth) throw new Error("synthetic provider error includes data that must never leak");
            return { error: authError, data: authData ?? {
              user: { id: "synthetic-guest-id", is_anonymous: true, private_field: "must-not-return" },
              session: { access_token: "synthetic-access", refresh_token: "synthetic-refresh", private_field: "must-not-return" }
            } };
          }
        }, { get(target, key) {
          assert.equal(key, "signInAnonymously", "no admin/signup/password bypass of CAPTCHA");
          return target[key];
        } }) };
      }
    }
  });
  return { route, rates, rpcCalls, signupCalls, publicClients, get serverClientCalls() { return serverClientCalls; } };
}
async function responseIs(response, status, error) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store", "tokens and availability must never be cached");
  const body = await response.json();
  if (error) assert.equal(body.error, error);
  return body;
}
function noSignup(h) {
  assert.equal(h.publicClients.length, 0, "rejected admission must not even construct an Auth client");
  assert.equal(h.signupCalls.length, 0);
}

for (const env of [
  { CONSULT_GUEST_ENABLED: undefined }, { CONSULT_GUEST_ENABLED: "false" }, { CONSULT_GUEST_ENABLED: "TRUE" },
  { NEXT_PUBLIC_SUPABASE_URL: undefined }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined },
  { NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined }, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "  " },
  { SUPABASE_SERVICE_ROLE_KEY: undefined }
]) {
  const h = harness({ env });
  assert.deepEqual(await responseIs(await h.route.GET(), 200), { enabled: false });
  await responseIs(await h.route.POST(request()), 503, "guest_unavailable");
  noSignup(h);
  assert.equal(h.serverClientCalls, 0, "disabled setup does not consume rates or touch Supabase");
}
{
  const h = harness();
  assert.deepEqual(await responseIs(await h.route.GET(), 200), {
    enabled: true, captchaSiteKey: fixtureEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  });
  noSignup(h);
  assert.equal(h.serverClientCalls, 0, "capability discovery is read-only and local");
}
for (const headers of [
  { origin: null }, { origin: "null" }, { origin: "https://attacker.example" },
  { origin: "https://synthetic-notebook.example.attacker.example" },
  { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }
]) {
  const h = harness();
  await responseIs(await h.route.POST(request({ headers })), 403, "origin_not_allowed");
  noSignup(h);
  assert.equal(h.rpcCalls.length, 0);
}
for (const [options, status, error] of [
  [{ body: {} }, 400, "captcha_required"], [{ body: { captchaToken: "  " } }, 400, "captcha_required"],
  [{ body: { captchaToken: 1 } }, 400, "captcha_required"],
  [{ body: { captchaToken: "a".repeat(2049) } }, 400, "captcha_required"],
  [{ body: [] }, 400, "invalid_request"], [{ body: "null" }, 400, "invalid_request"],
  [{ body: "{" }, 400, "invalid_request"],
  [{ body: { captchaToken: "synthetic", userId: "forged-user" } }, 400, "invalid_request"],
  [{ headers: { "content-type": "text/plain" } }, 415, "invalid_content_type"],
  [{ headers: { "content-type": null } }, 415, "invalid_content_type"],
  [{ headers: { "content-length": "4097" } }, 413, "request_too_large"],
  [{ headers: { "content-length": "not-a-number" } }, 413, "request_too_large"],
  [{ body: " ".repeat(4097) }, 413, "request_too_large"]
]) {
  const h = harness();
  await responseIs(await h.route.POST(request(options)), status, error);
  noSignup(h);
  assert.equal(h.rpcCalls.length, 0, "invalid payload must be rejected before rate RPCs");
}
for (const headers of [
  { "x-forwarded-for": null, "x-real-ip": null }, { "x-forwarded-for": "not-an-ip" }
]) {
  const h = harness();
  await responseIs(await h.route.POST(request({ headers })), 503, "guest_unavailable");
  noSignup(h);
  assert.equal(h.serverClientCalls, 0, "untrusted/missing client address fails closed");
}
for (const options of [
  { noRateClient: true }, { rateResults: [{ data: null, error: null }] },
  { rateResults: [{ data: {}, error: null }] }, { rateResults: [{ data: { allowed: "true" }, error: null }] },
  { rateResults: [{ data: { allowed: true }, error: { message: "synthetic-rate-secret" } }] },
  { rateResults: [new Error("synthetic RPC failure")] },
  { rateResults: [undefined, { data: null, error: { message: "synthetic global RPC failure" } }] }
]) {
  const h = harness(options);
  await responseIs(await h.route.POST(request()), 503, "guest_unavailable");
  noSignup(h);
}
for (const deniedIndex of [0, 1]) {
  const rateResults = [];
  rateResults[deniedIndex] = { data: { allowed: false, retry_after: 177 }, error: null };
  const h = harness({ rateResults });
  const response = await h.route.POST(request());
  await responseIs(response, 429, "guest_rate_limited");
  assert.equal(response.headers.get("retry-after"), "177");
  assert.equal(h.rpcCalls.length, deniedIndex + 1, "blocked IP does not consume global quota");
  noSignup(h);
}
{
  const h = harness();
  const response = await h.route.POST(request());
  assert.deepEqual(await responseIs(response, 201), { access_token: "synthetic-access", refresh_token: "synthetic-refresh" });
  assert.deepEqual(h.signupCalls, [{ options: { captchaToken: "synthetic-captcha-token" } }], "CAPTCHA token reaches Supabase Auth unchanged");
  assert.equal(h.rpcCalls.length, 2);
  assert.match(h.rpcCalls[0].p_key, /^consult-guest:ip:[0-9a-f]{64}$/);
  assert.doesNotMatch(h.rpcCalls[0].p_key, /192\.0\.2\.7|synthetic-browser/);
  assert.deepEqual(h.rpcCalls.map((item) => [item.p_limit, item.p_window_seconds]), [[3, 86400], [50, 86400]]);
  assert.equal(h.rpcCalls[1].p_key, "consult-guest:service");
  const anotherUa = harness();
  await responseIs(await anotherUa.route.POST(request({ headers: { "user-agent": "different-browser" } })), 201);
  assert.equal(anotherUa.rpcCalls[0].p_key, h.rpcCalls[0].p_key, "changing user-agent cannot reset the IP admission allowance");
  const anotherIp = harness();
  await responseIs(await anotherIp.route.POST(request({ headers: { "x-forwarded-for": "2001:db8::1" } })), 201);
  assert.notEqual(anotherIp.rpcCalls[0].p_key, h.rpcCalls[0].p_key);
  assert.equal(anotherIp.rpcCalls[1].p_key, h.rpcCalls[1].p_key, "global quota is shared across IPs");
}
for (const [options, status, error] of [
  [{ authError: { code: "captcha_failed", message: "synthetic-private-provider-message" } }, 400, "captcha_failed"],
  [{ authError: { status: 429, message: "synthetic-private-provider-message" } }, 429, "guest_rate_limited"],
  [{ authError: { code: "anonymous_provider_disabled", message: "synthetic-private-provider-message" } }, 503, "guest_unavailable"],
  [{ throwAuth: true }, 503, "guest_unavailable"],
  [{ authData: { user: { is_anonymous: false }, session: { access_token: "unexpected", refresh_token: "unexpected" } } }, 503, "guest_unavailable"],
  [{ authData: { user: { is_anonymous: true }, session: null } }, 503, "guest_unavailable"]
]) {
  const h = harness(options);
  const body = await responseIs(await h.route.POST(request()), status, error);
  assert.doesNotMatch(JSON.stringify(body), /synthetic-private|unexpected|synthetic-access|synthetic-refresh|provider error/,
    "provider errors and session details never leak through failure bodies");
}
assert.doesNotMatch(routeSource, /console\.|auth\.admin|createUser\(|SERVICE_ROLE_KEY/,
  "guest route neither logs bodies/tokens nor accesses privileged Auth creation");
assert.doesNotMatch(rateSource, /localBuckets|localRateLimit|\.auth\b|\.from\(/,
  "strict admission has no local fallback, Auth administration or data writes outside rate RPC");
console.log("consult guest route: ok (default-off, same-origin, bounded CAPTCHA body, strict IP/global RPC limits, public anonymous Auth only, no-store token response; synthetic only)");
