import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Execute actual component/hook code in isolated DOM/storage-shaped fixtures.
// No browser profile, stored notebook, server, credentials or network is used.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const source = fs.readFileSync(path.join(root, "apps/web/components/MascotMotionPreference.tsx"), "utf8");
const preferenceKey = "oyano-moshimo:mascot-motion:v1";
const eventName = "oyano-moshimo:mascot-motion:change";
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
assert.doesNotMatch(source, /\bfetch\s*\(|supabase|\.clear\s*\(|\.removeItem\s*\(/,
  "a visual preference must not call services or erase any stored data");

function descendants(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => descendants(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...descendants(tree.props?.children, predicate)];
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return text(tree.props?.children);
}

function harness({ saved, denyAccess = false, denyGet = false, denySet = false, server = false } = {}) {
  const data = new Map([["notebook-fixture", "keep diary and photos"], ["auth-fixture", "keep session"]]);
  if (saved !== undefined) data.set(preferenceKey, saved);
  const reads = [];
  const writes = [];
  const listeners = new Map();
  const storage = {
    getItem(key) {
      reads.push(key);
      if (denyGet) throw new Error("access denied");
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (denySet) throw new Error("quota exceeded");
      writes.push([key, value]);
      data.set(key, value);
    }
  };
  const windowFixture = {
    get localStorage() {
      if (denyAccess) throw new Error("access denied");
      return storage;
    },
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    removeEventListener(name, handler) {
      assert.ok(listeners.get(name)?.delete(handler), "cleanup removes the same registered listener");
      if (listeners.get(name).size === 0) listeners.delete(name);
    },
    dispatchEvent(event) {
      for (const handler of [...(listeners.get(event.type) ?? [])]) handler(event);
    }
  };
  let active;
  let id = 0;
  const react = {
    useState(initial) {
      const instance = active;
      const index = instance.cursor++;
      if (!(index in instance.states)) instance.states[index] = initial;
      return [instance.states[index], (value) => {
        instance.updates++;
        instance.states[index] = typeof value === "function" ? value(instance.states[index]) : value;
      }];
    },
    useId() {
      const index = active.cursor++;
      if (!(index in active.states)) active.states[index] = `fixture-help-${++id}`;
      return active.states[index];
    },
    useEffect(effect) {
      if (!active.mounted) active.effects.push(effect);
    }
  };
  const module = { exports: {} };
  const globals = {
    module, exports: module.exports,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    require(name) {
      if (name === "react") return react;
      assert.equal(name, "react/jsx-runtime", "only React may be imported; no application data services");
      return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    }
  };
  if (!server) globals.window = windowFixture;
  vm.runInNewContext(output, globals);

  function component(name) {
    const instance = { states: [], effects: [], cleanups: [], mounted: false, cursor: 0, updates: 0 };
    const render = () => {
      active = instance;
      instance.cursor = 0;
      return module.exports[name]();
    };
    const initial = render();
    const mount = () => {
      assert.equal(server, false, "server rendering must never execute client effects");
      instance.mounted = true;
      instance.cleanups = instance.effects.map((effect) => effect());
    };
    const unmount = () => instance.cleanups.forEach((cleanup) => cleanup());
    return { initial, mount, render, unmount, instance };
  }
  return { component, data, reads, writes, listeners, storage, windowFixture };
}

const checkbox = (tree) => {
  const found = descendants(tree, (node) => node.type === "input");
  assert.equal(found.length, 1);
  assert.equal(found[0].props.type, "checkbox");
  return found[0];
};
const change = (component, enabled) => checkbox(component.render()).props.onChange({ currentTarget: { checked: enabled } });

const ssr = harness({ server: true });
const serverHook = ssr.component("useMascotMotionPreference");
assert.equal(serverHook.initial.enabled, false);
assert.equal(serverHook.initial.ready, false);
const serverToggle = ssr.component("MascotMotionToggle");
assert.equal(checkbox(serverToggle.initial).props.checked, false);
assert.equal(checkbox(serverToggle.initial).props.disabled, true);
assert.deepEqual(ssr.reads, []);
assert.deepEqual(ssr.writes, []);

for (const [saved, expected] of [[undefined, true], ["on", true], ["off", false], ["unexpected", true], ["", true]]) {
  const fixture = harness({ saved });
  const hook = fixture.component("useMascotMotionPreference");
  assert.equal(hook.initial.enabled, false, "initial client render matches the server");
  assert.equal(hook.initial.ready, false);
  assert.deepEqual(fixture.reads, [], "render itself does not read browser storage");
  hook.mount();
  assert.equal(hook.render().enabled, expected);
  assert.equal(hook.render().ready, true);
  assert.deepEqual(fixture.reads, [preferenceKey]);
  assert.deepEqual(fixture.writes, [], "mounting never replaces a saved value/default");
  hook.unmount();
  assert.equal(fixture.listeners.size, 0);
}

const fixture = harness({ saved: "off" });
const toggle = fixture.component("MascotMotionToggle");
const consumer = fixture.component("useMascotMotionPreference");
toggle.mount();
consumer.mount();
assert.equal(fixture.listeners.get(eventName).size, 2, "both same-tab consumers subscribe");
const tree = toggle.render();
assert.equal(tree.props.className, "mascot-motion-control");
const label = descendants(tree, (node) => node.type === "label")[0];
assert.ok(text(label).includes("キャラクターの動き"));
assert.equal(checkbox(tree).props.disabled, false);
assert.equal(descendants(tree, (node) => node.props?.id === checkbox(tree).props["aria-describedby"]).length, 1);
assert.ok(text(tree).includes("動きをオフにしても、表情は表示されます。"));
assert.equal(descendants(tree, (node) => node.props?.role === "status").length, 1);

for (const enabled of [true, false, true]) {
  change(toggle, enabled);
  assert.equal(checkbox(toggle.render()).props.checked, enabled);
  assert.equal(consumer.render().enabled, enabled, "change is immediate for other same-tab hook consumers");
  assert.equal(fixture.data.get(preferenceKey), enabled ? "on" : "off");
}
fixture.windowFixture.dispatchEvent({ type: eventName, detail: { enabled: "off" } });
assert.equal(consumer.render().enabled, true, "invalid same-tab event payload is ignored");
fixture.windowFixture.dispatchEvent({ type: eventName });
assert.equal(consumer.render().enabled, true, "missing same-tab event payload is ignored");

for (const event of [
  { key: "notebook-fixture", newValue: "off", storageArea: fixture.storage },
  { key: null, newValue: null, storageArea: fixture.storage },
  { key: preferenceKey, newValue: "off", storageArea: {} }
]) {
  fixture.windowFixture.dispatchEvent({ type: "storage", ...event });
  assert.equal(consumer.render().enabled, true, "unrelated keys and non-local storage must be ignored");
}
for (const [newValue, expected] of [["off", false], ["on", true], ["invalid", true], [null, true]]) {
  fixture.windowFixture.dispatchEvent({ type: "storage", key: preferenceKey, newValue, storageArea: fixture.storage });
  assert.equal(consumer.render().enabled, expected, "another tab updates the hook");
  assert.equal(checkbox(toggle.render()).props.checked, expected, "another tab updates the checkbox");
}
assert.ok(fixture.reads.every((key) => key === preferenceKey));
assert.ok(fixture.writes.every(([key]) => key === preferenceKey));
assert.equal(fixture.data.get("notebook-fixture"), "keep diary and photos");
assert.equal(fixture.data.get("auth-fixture"), "keep session");

toggle.unmount();
consumer.unmount();
assert.equal(fixture.listeners.size, 0);
const updatesAfterUnmount = consumer.instance.updates;
fixture.windowFixture.dispatchEvent({ type: eventName, detail: { enabled: false } });
assert.equal(consumer.instance.updates, updatesAfterUnmount, "unmounted components are not updated");

for (const options of [{ denyAccess: true }, { denyGet: true }, { denySet: true }]) {
  const restricted = harness({ ...options, saved: "off" });
  const control = restricted.component("MascotMotionToggle");
  const mascot = restricted.component("useMascotMotionPreference");
  control.mount();
  mascot.mount();
  assert.equal(mascot.render().enabled, false);
  assert.equal(mascot.render().ready, true, "denied storage must not leave the control permanently disabled");
  change(control, true);
  assert.equal(mascot.render().enabled, true, "user can still change motion in this tab");
  if (options.denyAccess || options.denySet) {
    const status = descendants(control.render(), (node) => node.props?.role === "status")[0];
    assert.ok(text(status).includes("保存できませんでした"));
    assert.deepEqual(restricted.writes, []);
    const later = restricted.component("useMascotMotionPreference");
    later.mount();
    assert.equal(later.render().enabled, true, "temporary preference also applies to later same-tab mounts");
    later.unmount();
  }
  restricted.windowFixture.dispatchEvent({ type: "storage", key: preferenceKey, newValue: "off", storageArea: restricted.storage });
  assert.equal(mascot.render().enabled, Boolean(options.denyAccess), "denied access event is ignored safely");
  assert.equal(restricted.data.get("notebook-fixture"), "keep diary and photos");
  assert.equal(restricted.data.get("auth-fixture"), "keep session");
  control.unmount();
  mascot.unmount();
  assert.equal(restricted.listeners.size, 0);
}

console.log("Mascot motion preference: SSR, persistence, same/other-tab sync, access/quota failure, accessibility and data isolation passed (browser QA separate)");
