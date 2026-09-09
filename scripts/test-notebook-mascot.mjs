import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Run the actual TSX with a small deterministic React-hook/JSX harness.
// No browser, real timers, network, storage, notebook records or AI calls.
// These lifecycle and CSS-source checks do not replace visual/browser QA.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const ts = requireWeb("typescript");
const postcss = createRequire(requireWeb.resolve("next/package.json"))("postcss");
const source = read("apps/web/components/NotebookMascot.tsx");
const css = read("apps/web/components/NotebookMascot.module.css");
const compiled = ts.transpileModule(source, {
  fileName: "NotebookMascot.tsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

function descendants(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => descendants(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...descendants(tree.props?.children, predicate)];
}

function harness({ reducedMotion = false, server = false } = {}) {
  let hookIndex = 0;
  let dirty = false;
  let mounted = true;
  let pendingEffects = [];
  let previousProps = {};
  let latestTree;
  let clock = 0;
  let timerId = 0;
  const hooks = [];
  const timers = new Map();
  const listeners = new Set();
  const media = {
    get matches() { return reducedMotion; },
    addEventListener(name, callback) {
      assert.equal(name, "change");
      listeners.add(callback);
    },
    removeEventListener(name, callback) {
      assert.equal(name, "change");
      assert.ok(listeners.delete(callback), "cleanup removes its exact preference listener");
    }
  };
  const react = {
    useRef(initial) {
      const index = hookIndex++;
      hooks[index] ??= { kind: "ref", value: { current: initial } };
      assert.equal(hooks[index].kind, "ref");
      return hooks[index].value;
    },
    useState(initial) {
      const index = hookIndex++;
      hooks[index] ??= { kind: "state", value: typeof initial === "function" ? initial() : initial };
      assert.equal(hooks[index].kind, "state");
      return [hooks[index].value, (update) => {
        assert.ok(mounted, "no state update after unmount");
        const next = typeof update === "function" ? update(hooks[index].value) : update;
        if (!Object.is(hooks[index].value, next)) {
          hooks[index].value = next;
          dirty = true;
        }
      }];
    },
    useEffect(setup, deps) {
      const index = hookIndex++;
      const previous = hooks[index];
      if (previous) assert.equal(previous.kind, "effect");
      if (!previous || deps.length !== previous.deps.length || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          hooks[index] = { kind: "effect", deps, setup, cleanup: setup() };
        });
      }
    }
  };
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") {
        const jsx = (type, props, key) => ({ type, props, key });
        return { jsx, jsxs: jsx, Fragment: "fragment" };
      }
      if (name === "./NotebookMascot.module.css") {
        return { default: new Proxy({}, { get: (_, property) => String(property) }) };
      }
      throw new Error(`Unexpected mascot dependency: ${name}`);
    }
  };
  if (!server) {
    context.window = {
      matchMedia(query) {
        assert.equal(query, "(prefers-reduced-motion: reduce)");
        return media;
      },
      setTimeout(callback, delay) {
        assert.ok(delay > 0 && delay <= 1100, "one brief reaction, not a long-running animation");
        const id = ++timerId;
        timers.set(id, { callback, due: clock + delay });
        return id;
      },
      clearTimeout(id) { timers.delete(id); }
    };
  }
  vm.runInNewContext(compiled, context);

  function render(props = previousProps) {
    assert.ok(mounted);
    previousProps = props;
    for (let pass = 0; pass < 10; pass += 1) {
      hookIndex = 0;
      dirty = false;
      pendingEffects = [];
      latestTree = module.exports.NotebookMascot(props);
      if (server) return latestTree; // React does not run effects on the server.
      for (const effect of pendingEffects) effect();
      if (!dirty) return latestTree;
    }
    assert.fail("mascot must settle without a render/effect loop");
  }

  return {
    render,
    moving: (props) => render(props).props["data-mascot-animating"],
    get timerCount() { return timers.size; },
    get listenerCount() { return listeners.size; },
    get tree() { return latestTree; },
    replayMountEffects() {
      for (const hook of hooks) {
        if (hook.kind !== "effect") continue;
        hook.cleanup?.();
        hook.cleanup = hook.setup();
      }
      return render();
    },
    setReducedMotion(value) {
      reducedMotion = value;
      for (const callback of [...listeners]) callback({ matches: value });
      return render();
    },
    tick(duration) {
      const until = clock + duration;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= until)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        timers.delete(next[0]);
        clock = next[1].due;
        next[1].callback();
        if (mounted && dirty) render();
      }
      clock = until;
      return latestTree;
    },
    unmount() {
      for (const hook of hooks) hook.cleanup?.();
      mounted = false;
    }
  };
}

const poses = ["neutral", "hello", "saved", "photo", "listen"];
for (const pose of poses) {
  const server = harness({ server: true });
  const tree = server.render({ pose, motionKey: 17, motionEnabled: true, className: "fixture-size" });
  assert.equal(tree.props["aria-hidden"], "true", "visible nearby text conveys meaning instead of decorative speech");
  assert.equal(tree.props["data-mascot-pose"], pose);
  assert.equal(tree.props["data-mascot-animating"], false, "SSR cannot access window or autoplay");
  assert.ok(tree.props.className.includes("fixture-size"), "parent can supply a size/layout class");
  assert.equal(descendants(tree, (node) => node.type === "button").length, 0, "mascot itself is not an unexplained control");
  const images = descendants(tree, (node) => node.type === "img");
  assert.equal(images.length, 1);
  assert.equal(images[0].props.src, "/brand/watch-bird-mark.svg", "every pose reuses the unchanged official asset reference");
  assert.equal(images[0].props.alt, "");
  assert.equal(images[0].props.draggable, false);
  server.unmount();
}
const officialLogo = read("apps/web/public/brand/watch-bird-mark.svg");
assert.match(officialLogo, /<svg[^>]*viewBox="0 0 56 56"/);
assert.match(read("apps/web/app/layout.tsx"), /className="app-brand-logo"\s+src="\/brand\/watch-bird-mark\.svg"/,
  "header and decorative mascot share the existing asset; no alternate/replaced brand logo");
assert.doesNotMatch(officialLogo, /<animate|<set\b|<script|<style|onload=/i, "official logo asset remains static");
assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\(|sendBeacon|supabase|setInterval|requestAnimationFrame/,
  "mascot cannot read/write notebook data or communicate with a service");

const initial = harness();
assert.equal(initial.moving({}), false);
assert.equal(initial.tree.props["data-mascot-pose"], "neutral");
assert.equal(initial.timerCount, 0);
assert.equal(initial.listenerCount, 0);
initial.unmount();

const live = harness();
const base = { pose: "hello", motionEnabled: true };
assert.equal(live.moving({ ...base, motionKey: 1 }), false, "mount with a positive key must not autoplay");
assert.equal(live.replayMountEffects().props["data-mascot-animating"], false, "Strict Mode mount replay must stay still");
assert.equal(live.timerCount, 0);
assert.equal(live.moving({ ...base, motionKey: 2 }), true, "new positive event starts once");
assert.equal(live.timerCount, 1);
assert.equal(live.listenerCount, 1);
const firstFigureKey = live.tree.props.children.key;
live.tick(250);
assert.equal(live.moving({ ...base, motionKey: 2 }), true);
assert.equal(live.timerCount, 1, "same key does not schedule another reaction");
assert.equal(live.tree.props.children.key, firstFigureKey, "same event does not restart CSS via remount");
assert.equal(live.moving({ ...base, motionKey: 3 }), true);
assert.notEqual(live.tree.props.children.key, firstFigureKey, "a new event restarts a same-pose CSS animation");
assert.equal(live.timerCount, 1, "new event cleans the previous timer");
assert.equal(live.listenerCount, 1, "new event cleans the previous listener");
live.tick(750);
assert.equal(live.tree.props["data-mascot-animating"], true, "old timer cannot prematurely stop a newer event");
live.tick(250);
assert.equal(live.tree.props["data-mascot-animating"], false, "one reaction finishes without looping");
assert.equal(live.timerCount, 0);
assert.equal(live.moving({ ...base, motionKey: 3 }), false, "completed key cannot replay");

assert.equal(live.moving({ ...base, motionKey: 4 }), true);
assert.equal(live.moving({ ...base, motionKey: 4, motionEnabled: false }), false, "disable stops immediately");
assert.equal(live.timerCount, 0);
assert.equal(live.listenerCount, 0);
assert.equal(live.moving({ ...base, motionKey: 5, motionEnabled: false }), false);
assert.equal(live.moving({ ...base, motionKey: 5 }), false, "enabling cannot replay an event received while disabled");
assert.equal(live.moving({ ...base, motionKey: 6 }), true);
assert.equal(live.moving({ ...base, motionKey: 6, pose: "neutral" }), false, "neutral stops immediately");
assert.equal(live.timerCount, 0);
assert.equal(live.listenerCount, 0);
assert.equal(live.moving({ ...base, motionKey: 6 }), false, "pose change alone cannot replay");
assert.equal(live.moving({ ...base, motionKey: 7, pose: "neutral" }), false);
assert.equal(live.moving({ ...base, motionKey: 7 }), false, "a neutral-pose event is consumed rather than delayed");
for (const motionKey of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.equal(live.moving({ ...base, motionKey }), false, "only finite positive keys can start motion");
  assert.equal(live.timerCount, 0);
}

live.setReducedMotion(true);
assert.equal(live.moving({ ...base, motionKey: 8, pose: "saved" }), false, "OS reduced motion suppresses an event");
assert.equal(live.timerCount, 0);
assert.equal(live.setReducedMotion(false).props["data-mascot-animating"], false, "turning OS motion on cannot replay");
assert.equal(live.moving({ ...base, motionKey: 9, pose: "saved" }), true);
assert.equal(live.setReducedMotion(true).props["data-mascot-animating"], false, "OS preference change stops a running reaction");
assert.equal(live.setReducedMotion(false).props["data-mascot-animating"], false, "OS preference toggle cannot resume a consumed event");
for (const [index, pose] of ["photo", "listen", "hello", "saved"].entries()) {
  assert.equal(live.moving({ ...base, motionKey: 10 + index, pose }), true, `${pose} can react to an explicit event`);
  live.tick(1100);
  assert.equal(live.tree.props["data-mascot-animating"], false, `${pose} stops after one reaction`);
}
assert.equal(live.moving({ ...base, motionKey: 14 }), true);
assert.equal(live.timerCount, 1);
live.unmount();
assert.equal(live.timerCount, 0, "unmount releases the live timer");
assert.equal(live.listenerCount, 0, "unmount releases the exact preference listener");
live.tick(5000); // Any remaining callback would fail the unmounted-state assertion.

const stylesheet = postcss.parse(css);
let reactionRules = 0;
stylesheet.walkDecls("animation", (declaration) => {
  if (declaration.value === "none") {
    assert.ok(declaration.important, "reduced-motion override wins over pose selectors");
    assert.equal(declaration.parent.parent.type, "atrule");
    assert.equal(declaration.parent.parent.name, "media");
    assert.equal(declaration.parent.parent.params, "(prefers-reduced-motion: reduce)");
    for (const element of [".face", ".wing", ".keepsake"]) {
      assert.ok(declaration.parent.selector.includes(element), `reduced motion covers ${element}`);
    }
    return;
  }
  reactionRules += 1;
  assert.ok(declaration.parent.selector.includes('[data-mascot-animating="true"]'), "CSS never animates a static pose");
  assert.match(declaration.value, /^\w+\s+[1-9]\d{1,2}ms\s+[\w-]+\s+1$/, "all animations have one brief finite iteration");
});
assert.equal(reactionRules, 4, "one finite animation for each non-neutral pose");
assert.doesNotMatch(css, /\binfinite\b|\btransition\s*:/, "no looping or implicit pose-change animation");

// Integration source contracts: legacy global image/span rules must not style
// the component's nested decorative face, wing or photo. DOM layout is still QA.
const globalStyles = postcss.parse(read("apps/web/app/globals.css"));
const globalSelectors = [];
globalStyles.walkRules((rule) => {
  globalSelectors.push(...rule.selectors.map((selector) => selector.replace(/\s+/g, " ").trim()));
});
for (const safe of [".diary-save-complete-head > img", ".diary-save-complete-head > div > span", ".consult-chat-title > img"]) {
  assert.ok(globalSelectors.includes(safe), `keep the direct-child safety boundary: ${safe}`);
}
for (const selector of globalSelectors) {
  assert.doesNotMatch(selector, /\.diary-save-complete-head\s+(?:img|span)\b/,
    "save notice styling must not reach nested mascot images or expression spans");
  assert.doesNotMatch(selector, /\.consult-chat-title\s+img\b/,
    "consult title padding/dimensions must not leak into the nested mascot image");
}

function parseTsx(name) {
  const text = read(name);
  const ast = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const nodes = [];
  const visit = (node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(ast);
  return { text, ast, nodes };
}
function exactlyOne(nodes, predicate, message) {
  const found = nodes.filter(predicate);
  assert.equal(found.length, 1, message);
  return found[0];
}
function jsxAttribute(node, name, ast) {
  const attribute = node.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText(ast) === name);
  if (!attribute?.initializer) return undefined;
  return ts.isJsxExpression(attribute.initializer)
    ? attribute.initializer.expression?.getText(ast)
    : attribute.initializer.text;
}

const home = parseTsx("apps/web/app/home/page.tsx");
for (const [functionName, failureCondition, successIdCall] of [
  ["saveDiary", "!persisted", "setDiarySavedId(entry.id)"],
  ["saveDiaryEdit", "!updateResult.persisted", "setDiaryUpdatedId(entryId)"]
]) {
  const handler = exactlyOne(home.nodes,
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === functionName,
    `one actual ${functionName} handler`);
  const statements = [...handler.body.statements];
  const failureIndex = statements.findIndex((node) => ts.isIfStatement(node) && node.expression.getText(home.ast) === failureCondition);
  const successIndex = statements.findIndex((node) => ts.isExpressionStatement(node) && node.expression.getText(home.ast) === successIdCall);
  assert.ok(failureIndex >= 0 && successIndex > failureIndex, "success notice ID is set after the persistence failure guard");
  const failureBlock = statements[failureIndex].thenStatement;
  assert.ok(ts.isBlock(failureBlock) && failureBlock.statements.some(ts.isReturnStatement),
    "a failed local save exits before any success ID/event");
  assert.ok(!failureBlock.getText(home.ast).includes(successIdCall), "failed save cannot create a success notice ID");
  assert.doesNotMatch(handler.getText(home.ast), /setSavedMascotPulse/,
    "save handler keeps persistence separate from post-render decoration");
}
const successEffect = exactlyOne(home.nodes,
  (node) => ts.isCallExpression(node) && node.expression.getText(home.ast) === "useEffect"
    && node.arguments[0]?.getText(home.ast).includes("setSavedMascotPulse"),
  "one post-render save-success effect");
assert.equal(successEffect.arguments[1].getText(home.ast), "[diarySavedId, diaryUpdatedId]",
  "pulse follows saved/updated IDs, not text changes, timer ticks, or the save button");
assert.match(successEffect.arguments[0].getText(home.ast), /if \(diarySavedId \|\| diaryUpdatedId\) setSavedMascotPulse/);
for (const [diarySavedId, diaryUpdatedId, expected] of [[null, null, 0], ["fixture-new", null, 1], [null, "fixture-edit", 1]]) {
  let pulse = 0;
  vm.runInNewContext(`(${successEffect.arguments[0].getText(home.ast)})()`, {
    diarySavedId, diaryUpdatedId,
    setSavedMascotPulse(update) { pulse = update(pulse); }
  });
  assert.equal(pulse, expected, "only a successful saved/updated ID can request a reaction");
}
const quiet = exactlyOne(home.nodes,
  (node) => ts.isVariableDeclaration(node) && node.name.getText(home.ast) === "mascotQuiet",
  "one quiet-context policy").initializer.getText(home.ast);
for (const [cloudContentReadOnly, recordStorageTone, mood, expected] of [
  [false, "info", "stable", false], [false, "info", "changed", false],
  [true, "info", "stable", true], [false, "warning", "stable", true], [false, "info", "urgent", true]
]) {
  assert.equal(vm.runInNewContext(quiet, { cloudContentReadOnly, recordStorageTone, activeForm: { mood } }), expected,
    "read-only, warning, and urgent contexts stay quiet");
}
const homeMascots = home.nodes.filter((node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText(home.ast) === "NotebookMascot");
assert.ok(homeMascots.length >= 4, "greeting, photo, new-save and edited-save placements remain connected");
for (const node of homeMascots) {
  assert.ok(jsxAttribute(node, "pose", home.ast).includes("mascotQuiet"));
  assert.ok(jsxAttribute(node, "motionEnabled", home.ast).includes("!mascotQuiet"),
    "every notebook placement respects quiet contexts and the motion setting");
}
const savedMascots = homeMascots.filter((node) => jsxAttribute(node, "motionKey", home.ast) === "savedMascotPulse");
assert.equal(savedMascots.length, 2, "both new and edited save notices use the post-success pulse");
for (const node of savedMascots) {
  assert.match(jsxAttribute(node, "pose", home.ast), /\.mood === "urgent" \? "neutral" : "saved"/);
  assert.match(jsxAttribute(node, "motionEnabled", home.ast), /\.mood !== "urgent"/,
    "an urgent saved record stays neutral even after the input form has reset");
}

const layout = parseTsx("apps/web/app/layout.tsx");
const settings = exactlyOne(layout.nodes,
  (node) => ts.isJsxElement(node) && node.openingElement.tagName.getText(layout.ast) === "details"
    && jsxAttribute(node.openingElement, "className", layout.ast) === "notebook-motion-settings",
  "one collapsed motion setting near the footer");
assert.match(settings.getText(layout.ast), /<summary>キャラクターの表示設定<\/summary>/);
assert.match(settings.getText(layout.ast), /<MascotMotionToggle\s*\/>/);
assert.ok(layout.text.indexOf("{children}") < settings.pos && settings.end < layout.text.indexOf('<footer className="footer">'),
  "motion preference stays below content and before the footer rather than displacing primary actions");

const consult = parseTsx("apps/web/components/ConsultPanel.tsx");
const consultTitle = exactlyOne(consult.nodes,
  (node) => ts.isJsxElement(node) && jsxAttribute(node.openingElement, "className", consult.ast) === "consult-chat-title",
  "one consultation heading").getText(consult.ast);
assert.match(consultTitle, /<p>AI相談チャット<\/p>/, "character must not hide that the service is AI");
assert.match(consultTitle, /<h2>\{consultNotebookBaseName\(activeCase\)\}の手帳を読んで答えます<\/h2>/,
  "consultation retains its explicit notebook-based title");
assert.match(consultTitle, /pose=\{phase === "error" \? "neutral" : "listen"\}/,
  "consultation error state does not show a playful reaction");
assert.match(consultTitle, /motionEnabled=\{mascotMotionEnabled\}/, "consultation uses the same footer preference");

console.log("notebook mascot: ok (actual TSX; SSR, one-shot/no-replay, quiet/reduced motion, timer/unmount, shared logo, CSS isolation, success-only integration and AI heading; synthetic only)");
