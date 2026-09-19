import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Execute real helpers, hook, widget callbacks and each existing email handler.
// Every Auth and DOM call is synthetic: no email, browser storage or network.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function evaluate(source, context) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, { ...context, module, exports: module.exports });
  return module.exports;
}
const env = { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public" };
const configFor = (siteKey) => evaluate(read("apps/web/lib/authCaptcha.ts"), {
  process: { env: { ...env, NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey } }
});
const config = configFor("synthetic-site");
let now = 0;
const store = config.createAuthCaptchaTokenStore(() => now);
store.accept("synthetic-token");
assert.equal(store.consume(), "synthetic-token");
assert.equal(store.consume(), null, "each widget token is consumed only once");
store.accept("expiring-token");
now = config.AUTH_CAPTCHA_MAX_AGE_MS;
assert.equal(store.consume(), null, "local expiry rejects before provider expiry");
store.accept("clock-token");
now -= 1;
assert.equal(store.consume(), null, "clock rollback cannot extend a token");
for (const value of [null, undefined, "", " ", "x".repeat(2049)]) {
  assert.equal(config.validAuthCaptchaToken(value), null);
}

function browserFixture(siteKey, outcome = "ok") {
  const calls = [];
  const captchaConfig = configFor(siteKey);
  const context = {
    URL, URLSearchParams, process: { env: { ...env, NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey } },
    window: { location: { origin: "https://example.test" } },
    require(name) {
      if (name === "@/lib/authCaptcha") return captchaConfig;
      if (name === "@oyano/shared") return { authErrorMessage: () => "安全確認が拒否されました。" };
      if (name === "@supabase/supabase-js") return { createClient: () => ({ auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithOtp: async (input) => {
          calls.push(input);
          if (outcome === "throw") throw new Error("synthetic offline");
          return { error: outcome === "reject" ? { message: "synthetic rejected" } : null };
        }
      } }) };
      throw new Error(`Unexpected dependency: ${name}`);
    }
  };
  return { api: evaluate(read("apps/web/lib/browserSupabase.ts"), context), calls };
}
const helperCases = [
  ["sendMagicLink", ["synthetic@example.test", "/family"], true, "/family"],
  ["sendAdminMagicLink", ["synthetic@example.test", "/admin/delete-requests/setup"], false, "/admin/delete-requests/setup"],
  ["sendNotebookMagicLink", ["synthetic@example.test"], true, "/home?cloud=1"]
];
for (const [name, args, shouldCreateUser, redirect] of helperCases) {
  const disabled = browserFixture(undefined);
  assert.equal((await disabled.api[name](...args)).ok, true, `${name}: unconfigured CAPTCHA preserves previous behavior`);
  assert.equal("captchaToken" in disabled.calls[0].options, false);
  for (const token of [undefined, null, "", "x".repeat(2049)]) {
    const enabled = browserFixture("synthetic-site");
    assert.equal((await enabled.api[name](...args, { captchaToken: token })).ok, false);
    assert.equal(enabled.calls.length, 0, `${name}: missing/invalid token cannot call Auth`);
  }
  for (const outcome of ["ok", "reject", "throw"]) {
    const enabled = browserFixture("synthetic-site", outcome);
    const result = await enabled.api[name](...args, { captchaToken: "fresh-token" });
    assert.equal(result.ok, outcome === "ok");
    assert.equal(enabled.calls.length, 1);
    assert.equal(enabled.calls[0].options.captchaToken, "fresh-token");
    assert.equal(enabled.calls[0].options.shouldCreateUser, shouldCreateUser);
    assert.equal(enabled.calls[0].options.emailRedirectTo, `https://example.test${redirect}`);
    if (outcome !== "ok") assert.ok(result.error, "rejection and network failures return a visible error");
  }
}

// A small React hook runner executes lifecycle changes without a browser.
function hookRuntime() {
  const states = [], refs = [], callbacks = [], effects = [], pending = [];
  let stateIndex = 0, refIndex = 0, callbackIndex = 0, effectIndex = 0;
  const sameDeps = (left, right) => left?.length === right?.length && left.every((dep, i) => Object.is(dep, right[i]));
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = callbackIndex++;
      if (!callbacks[index] || !sameDeps(deps, callbacks[index].deps)) callbacks[index] = { callback, deps };
      return callbacks[index].callback;
    },
    useEffect(effect, deps) {
      const index = effectIndex++;
      const old = effects[index];
      const same = old && sameDeps(deps, old.deps);
      if (!same) pending.push(() => { old?.cleanup?.(); effects[index] = { deps, cleanup: effect() }; });
    }
  };
  return {
    react, refs,
    render(render) { stateIndex = 0; refIndex = 0; callbackIndex = 0; effectIndex = 0; return render(); },
    flush() { while (pending.length) pending.shift()(); },
    unmount() { for (const effect of effects) effect?.cleanup?.(); }
  };
}
function widgetFixture(siteKey = "synthetic-site", preloaded = true) {
  const hooks = hookRuntime(), timers = new Map(), scripts = [], renders = [], tokens = [], removed = [];
  let timerId = 0;
  const api = {
    render: (_host, options) => { renders.push(options); return `widget-${renders.length}`; },
    remove: (id) => removed.push(id)
  };
  const setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; };
  const clearTimeout = (id) => timers.delete(id);
  const window = { ...(preloaded ? { turnstile: api } : {}), setTimeout, clearTimeout };
  const document = {
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { appendChild: (script) => scripts.push(script) }
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const module = evaluate(read("apps/web/components/AuthCaptcha.tsx"), {
    window, document, setTimeout, clearTimeout,
    require(name) {
      if (name === "react") return hooks.react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@/lib/authCaptcha") return configFor(siteKey);
      throw new Error(`Unexpected dependency: ${name}`);
    }
  });
  return { hooks, timers, scripts, renders, tokens, removed, api, window, module,
    renderWidget() {
      const tree = hooks.render(() => module.TurnstileCheck({ siteKey, onToken: (token) => tokens.push(token) }));
      hooks.refs[0].current = {};
      hooks.flush();
      return tree;
    }
  };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
{
  const fixture = widgetFixture();
  let captcha = fixture.hooks.render(() => fixture.module.useAuthCaptcha());
  fixture.hooks.flush();
  assert.equal(captcha.ready, false);
  captcha.acceptToken("one-use-token");
  captcha = fixture.hooks.render(() => fixture.module.useAuthCaptcha());
  assert.equal(captcha.ready, true);
  assert.equal(captcha.consumeToken(), "one-use-token");
  assert.equal(captcha.consumeToken(), null, "rapid repeated submit cannot reuse the token");
  captcha = fixture.hooks.render(() => fixture.module.useAuthCaptcha());
  assert.equal(captcha.ready, false);
  assert.ok(captcha.attempt > 0, "consumption remounts the widget even after a failed send");
  captcha.acceptToken("expiring-token");
  const expiry = [...fixture.timers.values()].find((timer) => timer.ms === config.AUTH_CAPTCHA_MAX_AGE_MS);
  expiry.fn();
  captcha = fixture.hooks.render(() => fixture.module.useAuthCaptcha());
  assert.equal(captcha.ready, false);
  assert.equal(captcha.consumeToken(), null);
  fixture.hooks.unmount();
}
{
  const fixture = widgetFixture("");
  const captcha = fixture.hooks.render(() => fixture.module.useAuthCaptcha());
  assert.equal(captcha.ready, true);
  assert.equal(captcha.consumeToken(), undefined);
  assert.equal(fixture.module.AuthCaptcha({ control: captcha }), null);
  assert.equal(fixture.scripts.length, 0, "unconfigured CAPTCHA never loads a provider script");
}
for (const event of ["expired-callback", "timeout-callback", "error-callback"]) {
  const fixture = widgetFixture();
  fixture.renderWidget(); await settle();
  fixture.renders[0].callback("solved-token");
  assert.equal(fixture.tokens.at(-1), "solved-token");
  fixture.renders[0][event]();
  assert.equal(fixture.tokens.at(-1), "", `${event}: invalidate the solved token`);
  const tree = fixture.renderWidget();
  const retry = tree.props.children.find((node) => node?.type === "button");
  assert.ok(retry, `${event}: explicit retry is available`);
  retry.props.onClick();
  fixture.renderWidget(); await settle();
  assert.equal(fixture.renders.length, 2);
  assert.equal(fixture.removed.length, 1);
  fixture.hooks.unmount();
  assert.equal(fixture.tokens.at(-1), "", "unmount clears all tokens");
}
for (const failure of ["error", "timeout"]) {
  const fixture = widgetFixture("synthetic-site", false);
  fixture.renderWidget();
  assert.equal(fixture.scripts.length, 1);
  if (failure === "error") fixture.scripts[0].onerror();
  else [...fixture.timers.values()].find((timer) => timer.ms === 15_000).fn();
  await settle();
  const tree = fixture.renderWidget();
  const retry = tree.props.children.find((node) => node?.type === "button");
  assert.ok(retry, `${failure}: blocked script has an explicit recovery button`);
  assert.equal(fixture.scripts[0].removed, true);
  retry.props.onClick();
  fixture.renderWidget();
  assert.equal(fixture.scripts.length, 2, "retry creates a fresh script after load failure");
  fixture.window.turnstile = fixture.api;
  fixture.scripts[1].onload(); await settle();
  assert.equal(fixture.renders.length, 1);
}

const screens = [
  ["app/home/page.tsx", "requestCloudLink", "cloudEmail"],
  ["components/AccountDeleteRequest.tsx", "requestSignIn", "email"],
  ["components/FamilyShare.tsx", "requestSignIn", "signInEmail"],
  ["components/InviteAccept.tsx", "requestSignIn", "email"],
  ["components/PlusUpgrade.tsx", "requestSignIn", "email"],
  ["components/AdminTokenControl.tsx", "sendLink", "email"],
  ["components/DeleteOperatorMfaSetup.tsx", "sendLoginLink", "loginEmail"]
];
for (const [file, handler, emailField] of screens) {
  const source = read(`apps/web/${file}`);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let node;
  const visit = (candidate) => {
    if (ts.isFunctionDeclaration(candidate) && candidate.name?.text === handler) node = candidate;
    ts.forEachChild(candidate, visit);
  };
  visit(ast);
  assert.ok(node, `${file}: real handler found`);
  assert.match(source, /<AuthCaptcha control=\{authCaptcha\}/, `${file}: widget is rendered`);
  assert.match(source, /disabled=\{[^\n]*!authCaptcha\.ready/, `${file}: send waits for a solved token`);
  for (const scenario of ["missing", "ok", "reject", "throw"]) {
    const fixture = browserFixture("synthetic-site", scenario === "missing" ? "ok" : scenario);
    const tokenStore = config.createAuthCaptchaTokenStore();
    if (scenario !== "missing") tokenStore.accept("handler-token");
    const state = { [emailField]: "synthetic@example.test" }, messages = [];
    const context = {
      email: state[emailField], signInEmail: state[emailField], loginEmail: state[emailField], cloudEmail: state[emailField],
      authState: "signed-out", phase: "signed-out", state: "signed-out", sending: false, working: false,
      cloudEmailSending: false, cloudIsGuest: false, cloudUserId: null,
      emailInputRef: { current: { validity: { valid: true } } },
      cloudAuthGenerationRef: { current: 1 }, requestGeneration: { current: 1 },
      token: "synthetic-invite", roleLabel: "合成管理者", redirectPath: "/admin/monitor-feedback", setupRedirectPath: "/admin/delete-requests/setup",
      authCaptcha: { consumeToken: () => tokenStore.consume() },
      looksLikeEmail: () => true,
      ...fixture.api,
      showEmailError: (message) => messages.push(message), showMessage: (message) => messages.push(message)
    };
    for (const setter of ["setAuthState", "setError", "setMessage", "setPhase", "setState", "setSending", "setEmailError", "setWorking", "setCloudEmailSending", "setCloudEmailMessage"]) {
      context[setter] = (value) => { state[setter] = value; if (/Error|Message/.test(setter)) messages.push(value); };
    }
    const actual = evaluate(`export ${node.getText(ast)}`, context);
    await actual[handler]();
    assert.equal(fixture.calls.length, scenario === "missing" ? 0 : 1, `${file}: ${scenario}`);
    assert.equal(state[emailField], "synthetic@example.test", `${file}: email draft survives ${scenario}`);
    if (scenario !== "ok") assert.ok(messages.some(Boolean), `${file}: ${scenario} is visible`);
    assert.equal(tokenStore.consume(), null, `${file}: token consumed on ${scenario}`);
  }
}
console.log("Auth CAPTCHA PASS: one-use/expiry, 3 real Auth helpers, widget load/error/retry lifecycle, and 7 real email handlers; synthetic only, external sends 0.");
