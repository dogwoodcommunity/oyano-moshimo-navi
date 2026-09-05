import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const source = fs.readFileSync(path.join(repoRoot, "apps/web/components/AdminDeleteAccessCheck.tsx"), "utf8");
const parent = fs.readFileSync(path.join(repoRoot, "apps/web/components/AdminDeleteRequests.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const executor = "supabase_account_delete_executor";
const administrator = "supabase_app_admin";
const expectedPaths = [
  "/api/admin/delete-requests/auth-status",
  "/api/admin/delete-requests",
  "/api/admin/monitor-feedback",
  "/api/admin/ai-usage",
  "/api/admin/env-check"
];

function harness(fetcher) {
  const slots = [];
  let position = 0;
  const effects = [];
  const listeners = new Map();
  const opaqueHeaders = Object.freeze({ opaque: "test-header-handle" });
  const localStorage = {};
  const browserWindow = {
    localStorage, setTimeout, clearTimeout,
    addEventListener: (name, handler) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    removeEventListener: (name, handler) => listeners.get(name)?.delete(handler)
  };
  const react = {
    useRef: (initial) => {
      const index = position++;
      return slots[index] ??= { current: initial };
    },
    useState: (initial) => {
      const index = position++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useEffect: (effect, dependencies) => {
      const index = position++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: effect() };
        });
      }
    }
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})(require,module,exports);`, {
    module, exports: module.exports, window: browserWindow, fetch: fetcher, AbortController,
    require: (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "@/lib/adminClientAuth") return {
        ADMIN_BEARER_TOKEN_STORAGE_KEY: "test-bearer-key",
        adminBearerHeaders: () => opaqueHeaders
      };
      throw new Error(`Unexpected module ${name}`);
    }
  });
  return {
    ...module.exports, opaqueHeaders, localStorage,
    render: (operatorMethod) => {
      position = 0;
      const tree = module.exports.AdminDeleteAccessCheck({ operatorMethod });
      effects.splice(0).forEach((effect) => effect());
      return tree;
    },
    event: (name, event = {}) => listeners.get(name)?.forEach((handler) => handler(event)),
    unmount: () => slots.forEach((slot) => slot?.cleanup?.())
  };
}

function button(tree) {
  if (!tree || typeof tree !== "object") return null;
  if (tree.type === "button") return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = button(child);
    if (found) return found;
  }
  return null;
}

function response(status, cancellations) {
  const forbiddenRead = () => { throw new Error("Response body must not be read"); };
  return {
    status,
    body: { cancel: async () => { cancellations.push(status); } },
    json: forbiddenRead, text: forbiddenRead, arrayBuffer: forbiddenRead,
    blob: forbiddenRead, formData: forbiddenRead, clone: forbiddenRead
  };
}

for (const [role, statuses] of [[executor, [200, 200, 403, 403, 403]], [administrator, [200, 200, 200, 200, 200]]]) {
  const calls = [];
  const cancellations = [];
  const h = harness(async (url, options) => {
    calls.push({ url, options });
    return response(statuses[calls.length - 1], cancellations);
  });
  assert.equal(h.render(null), null, "no unauthenticated diagnostic control");
  h.render(role);
  const tree = h.render(role);
  assert.equal(calls.length, 0, "mount, role changes and opening the page must not probe APIs");
  const action = button(tree);
  assert.equal(action.props.disabled, false);
  await action.props.onClick();
  assert.deepEqual(calls.map((call) => call.url), expectedPaths, "exactly five allowlisted read-only endpoints");
  for (const { options } of calls) {
    assert.equal(options.method, "GET");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error", "a redirected login page cannot masquerade as HTTP 200");
    assert.equal(options.headers, h.opaqueHeaders, "use existing bearer helper without reading credentials");
    assert.equal("body" in options, false);
  }
  assert.deepEqual(cancellations, statuses, "cancel every response body, including generic unexpected-success bodies");
  const rendered = JSON.stringify(h.render(role));
  assert.match(rendered, /すべて想定どおりの応答/);
  assert.doesNotMatch(rendered, /test-header-handle/);
  h.event("admin-auth-changed");
  assert.doesNotMatch(JSON.stringify(h.render(role)), /HTTP 200|すべて想定どおりの応答/);
  assert.equal(button(h.render(role)).props.disabled, true, "auth changes require the parent to reverify the role");
  await action.props.onClick();
  assert.equal(calls.length, 5, "even a stale click handler cannot rerun with an invalidated role");
  h.unmount();
}

for (const status of [401, 403, 503, null]) {
  let count = 0;
  const h = harness(async () => {
    count += 1;
    if (status === null) throw new Error("do not display this internal error");
    return response(status, []);
  });
  const rows = await h.checkDeleteOperatorAccess(executor, {}, new AbortController().signal);
  assert.equal(count, 1, "failed scoped auth must stop before list and generic APIs");
  assert.equal(rows[0].status, status);
  assert.equal(rows[0].expectedStatus, 200);
}

{
  let count = 0;
  const h = harness(async () => response(++count === 1 ? 200 : 403, []));
  const rows = await h.checkDeleteOperatorAccess(executor, {}, new AbortController().signal);
  assert.equal(count, 2, "a forbidden scoped list must stop before the generic APIs");
  assert.equal(rows[1].status, 403);
  assert.equal(rows[1].expectedStatus, 200);
}

{
  let count = 0;
  const h = harness(async () => { count += 1; return response(200, []); });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.checkDeleteOperatorAccess(executor, {}, controller.signal));
  assert.equal(count, 0, "already-invalidated sessions must not start a network request");
}

{
  const h = harness(async () => response(200, []));
  h.render(executor);
  await button(h.render(executor)).props.onClick();
  const rendered = JSON.stringify(h.render(executor));
  assert.match(rendered, /想定と異なる応答/, "a delete-only user allowed into a generic API must fail the check");
  assert.doesNotMatch(rendered, /すべて想定どおりの応答/);
  h.unmount();
}

for (const invalidate of ["auth", "storage", "clear-storage", "role", "unmount"]) {
  let release;
  let signal;
  let calls = 0;
  const h = harness(async (_url, options) => {
    calls += 1;
    signal = options.signal;
    return new Promise((resolve) => { release = () => resolve(response(200, [])); });
  });
  h.render(executor);
  const action = button(h.render(executor));
  const pending = action.props.onClick();
  await action.props.onClick();
  assert.equal(calls, 1, "double clicks cannot start overlapping probes");
  if (invalidate === "auth") h.event("admin-auth-changed");
  if (invalidate === "storage" || invalidate === "clear-storage") h.event("storage", {
    storageArea: h.localStorage, key: invalidate === "storage" ? "test-bearer-key" : null
  });
  if (invalidate === "role") h.render(administrator);
  if (invalidate === "unmount") h.unmount();
  assert.equal(signal.aborted, true, `${invalidate} must abort in-flight work`);
  release();
  await pending;
  assert.equal(calls, 1, "an old session response cannot launch the next request");
  if (invalidate !== "unmount") {
    assert.doesNotMatch(JSON.stringify(h.render(invalidate === "role" ? administrator : executor)), /HTTP 200|すべて想定どおりの応答/);
    h.unmount();
  }
}

assert.match(parent, /<AdminDeleteAccessCheck operatorMethod=\{operatorMethod\} \/>/, "use only the verified scoped role from the existing list");
assert.doesNotMatch(source, /\.json\(|\.text\(|\.arrayBuffer\(|\.blob\(|\.formData\(|\.clone\(/, "never consume response bodies");
assert.doesNotMatch(source, /localStorage\.(getItem|setItem|removeItem)|console\.|Authorization|access_token|email|userId/, "never inspect or persist tokens, identities or response details");
assert.doesNotMatch(source, /method: "(POST|PUT|PATCH|DELETE)"|\/execute|\/preflight|\/prepare|\/grant|\/approve/, "diagnostics must have no erasure/write surface");
console.log("Admin deletion access diagnostics: PASS (status-only, manual, role-aware, abort-safe)");
