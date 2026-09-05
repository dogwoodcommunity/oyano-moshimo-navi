import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Run the actual home entry JSX and navigation helpers with in-memory targets.
// No browser, stored notebooks, Auth, server, production URL or AI call is used.
// CSS source contracts below do not replace computed-style/responsive/Safari QA.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const ts = requireWeb("typescript");
const postcss = createRequire(requireWeb.resolve("next/package.json"))("postcss");
const home = read("apps/web/app/home/page.tsx");
const parsed = ts.createSourceFile("home.tsx", home, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const allNodes = [];
function visit(node) { allNodes.push(node); ts.forEachChild(node, visit); }
visit(parsed);

function jsxWithClass(name) {
  const matches = allNodes.filter((node) => ts.isJsxElement(node) &&
    node.openingElement.attributes.properties.some((attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(parsed) === "className" &&
      attribute.initializer?.getText(parsed).includes(name)));
  assert.equal(matches.length, 1, `one ${name} must be present in home`);
  return matches[0];
}
function helper(name) {
  const matches = allNodes.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, `one real ${name} helper is required`);
  return matches[0].getText(parsed);
}
function compile(source, globals = {}) {
  const output = ts.transpileModule(source, {
    fileName: "readable-entry-fixture.tsx",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: (name) => {
      assert.equal(name, "react/jsx-runtime", "entry rendering must not import an app service");
      return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    }, ...globals
  });
  return module.exports;
}
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
const entryNode = jsxWithClass("readable-entry-list");
const supportNode = jsxWithClass("readable-support-links");
const latestNode = jsxWithClass("record-first-latest");
const switcherNode = jsxWithClass("readable-person-switcher");
assert.ok(entryNode.pos < latestNode.pos && latestNode.pos < supportNode.pos,
  "primary actions, the latest record, then auxiliary links must keep reading priority");

const sourceCase = { id: "fixture-case-b" };
const otherCase = { id: "fixture-case-other" };
const fixtureEntry = { id: "fixture-entry-b", caseId: sourceCase.id, date: "2026-09-05", body: "仮の記録", mood: "stable" };
const profile = { displayName: "仮の対象者" };
const functions = ["tabForHash", "hashForNotebookTab", "openNotebookSection", "openConsultDraft",
  "openConsultFromDigest", "scrollToDiaryEntry", "showDiaryEntry"].map(helper).join("\n");
function harness(entries, { todayEntry = entries[0], activeCase = sourceCase } = {}) {
  const events = [];
  const record = (name) => (...args) => events.push([name, ...args]);
  const globals = {
    activeCase, activeEntries: entries, latestEntry: entries[0], todayEntry,
    cases: [sourceCase, otherCase], personName: () => "同じ仮名", setActiveCaseId: record("case"),
    activeProfile: profile, recordDigest: { summary: "仮のまとめ" },
    latestEntryLabel: entries.length ? "9月5日の記録" : "今日の記録はまだありません",
    latestEntrySummary: entries.length ? entries[0].body : "まだ記録はありません。",
    Link: "a", setActiveNotebookTab: record("tab"), markMonitorActivity: record("monitor"),
    trackFunnel: record("funnel"), setProfileEditorOpen: record("profile"),
    setSelectedDiaryDate: record("date"), setDiaryCalendarMonth: record("month"),
    setRecordFilter: record("filter"), monthInputValue: (date) => date.slice(0, 7),
    buildDigestConsultQuestion: (...args) => { events.push(["digest", ...args]); return "仮の相談"; },
    consultHref: (...args) => { events.push(["consultHref", ...args]); return "/fixture-consult"; },
    window: {
      setTimeout: (fn) => fn(), requestAnimationFrame: (fn) => fn(),
      location: { assign: record("navigate") }
    },
    document: {
      querySelector: (selector) => ({
        scrollIntoView: (options) => events.push(["scroll", selector, options.block]),
        focus: (options) => events.push(["focus", selector, options.preventScroll])
      }),
      getElementById: (id) => ({ scrollIntoView: (options) => events.push(["scrollId", id, options.block]) })
    }
  };
  const rendered = compile(`${functions}
    export const entries = (${entryNode.getText(parsed)});
    export const support = (${supportNode.getText(parsed)});
    export const latest = (${latestNode.getText(parsed)});
    export const switcher = activeCase ? (${switcherNode.getText(parsed)}) : null;
    export { openNotebookSection, hashForNotebookTab };`, globals);
  return { ...rendered, events };
}

for (const count of [0, 1, 2]) {
  const entries = Array.from({ length: count }, (_, index) => ({ ...fixtureEntry, id: `fixture-${index}` }));
  const ui = harness(entries);
  const buttons = descendants(ui.entries, (node) => node.type === "button");
  assert.equal(buttons.length, 3, "home must have exactly three primary entry buttons");
  assert.deepEqual(buttons.map((button) => text(descendants(button, (node) => node.type === "strong")[0])),
    ["記録を書く", "記録を見返す", "AIに相談する"]);
  for (const button of buttons) {
    assert.equal(button.props.type, "button", "entries must not accidentally submit a form");
    assert.equal(typeof button.props.onClick, "function");
    assert.equal(descendants(button.props.children, (node) => node.type === "button").length, 0);
  }
  assert.ok(text(buttons[0]).includes(count ? "今日の記録あり・もう1件書けます" : "今日あったことを1行から"));
  assert.ok(text(buttons[1]).includes(count ? `${count}件の記録を読む・直す` : "日付ごとに読む・直す"));
  assert.ok(text(buttons[2]).includes("毎日1回無料"));

  buttons[0].props.onClick();
  assert.deepEqual(ui.events.splice(0), [["tab", "record"], ["scroll", "#today-diary", "start"]]);
  buttons[1].props.onClick();
  assert.deepEqual(ui.events.splice(0), [["tab", "history"], ["monitor", "diaryHistoryOpened"],
    ["funnel", "history_viewed"], ["scroll", "#diary-history", "start"]]);
  buttons[2].props.onClick();
  assert.deepEqual(ui.events.splice(0), [["digest", entries, profile, "仮のまとめ"],
    ["consultHref", sourceCase.id, "仮の相談"], ["navigate", "/fixture-consult"]]);

  const family = descendants(ui.support, (node) => node.type === "a");
  assert.equal(family.length, 1);
  assert.equal(family[0].props.href, "/family");
  assert.equal(text(family[0]), "家族と使う");
  const documents = descendants(ui.support, (node) => node.type === "button");
  assert.equal(documents.length, 1);
  assert.equal(documents[0].props.type, "button");
  assert.equal(text(documents[0]), "書類・鍵の場所");
  documents[0].props.onClick();
  assert.deepEqual(ui.events.splice(0), [["tab", "profile"], ["profile", true],
    ["scroll", "#document-location-note", "start"], ["focus", "#document-location-note", true]]);

  const latest = descendants(ui.latest, (node) => node.type === "button");
  assert.equal(latest.length, 1);
  assert.equal(latest[0].props.type, "button");
  assert.equal(text(latest[0]), count ? "この記録を開く" : "1行だけ書く");
  latest[0].props.onClick();
  assert.deepEqual(ui.events.splice(0), count ? [
    ["tab", "history"], ["date", entries[0].date], ["month", "2026-09"], ["filter", "all"],
    ["monitor", "diaryHistoryOpened"], ["funnel", "history_viewed"], ["scrollId", `diary-entry-${entries[0].id}`, "start"]
  ] : [["tab", "record"], ["scroll", "#today-diary", "start"]]);

  const people = descendants(ui.switcher, (node) => node.type === "button");
  assert.equal(people.length, 2);
  assert.deepEqual(people.map((button) => button.props["aria-pressed"]), [true, false]);
  assert.deepEqual(people.map(text), ["同じ仮名", "同じ仮名"]);
  people[1].props.onClick();
  assert.deepEqual(ui.events.splice(0), [["case", otherCase.id]], "equal display names must still switch by exact notebook ID");
  const profileLink = descendants(ui.switcher, (node) => node.type === "a")[0];
  assert.equal(profileLink.props.href, "#person-profile");
  profileLink.props.onClick({ preventDefault: () => ui.events.push(["preventDefault"]) });
  assert.deepEqual(ui.events.splice(0), [["preventDefault"], ["tab", "profile"],
    ["profile", true], ["scroll", "#person-profile", "start"]]);

  for (const [tab, hash] of [["overview", "#notebook-overview"], ["record", "#today-diary"],
    ["history", "#diary-history"], ["profile", "#person-profile"], ["tasks", "#task-checklist"], ["media", "#media-library"]]) {
    assert.equal(ui.hashForNotebookTab(tab), hash);
    ui.openNotebookSection(hash);
    assert.deepEqual(ui.events[0], ["tab", tab], `${tab} must remain reachable`);
    ui.events.splice(0);
  }
}
const noCase = harness([], { activeCase: null });
descendants(noCase.entries, (node) => node.type === "button")[2].props.onClick();
assert.equal(noCase.events.length, 0, "AI entry must not navigate using a missing target");
const noToday = harness([fixtureEntry], { todayEntry: null });
assert.ok(text(noToday.entries).includes("今日あったことを1行から"));

const layout = read("apps/web/app/layout.tsx");
const globalCss = read("apps/web/app/globals.css");
const theme = read("apps/web/app/readable-theme.css");
const imports = [...layout.matchAll(/import\s+["'](.+?\.css)["']/g)].map((match) => match[1]);
assert.ok(imports.indexOf("./globals.css") >= 0);
assert.ok(imports.indexOf("./readable-theme.css") > imports.indexOf("./globals.css"),
  "readability overrides must load after existing styles");
assert.match(layout, /<html className=\{`[^`]*readableRounded\.variable[^`]*readable-design-b[^`]*`\} lang="ja"/);
assert.match(layout, /const readableRounded = Zen_Maru_Gothic\(/);
assert.match(layout, /variable: "--font-readable-rounded"/);
assert.match(layout, /weight: \["500", "700"\]/);
for (const selector of [".readable-entry-list", ".readable-entry", ".readable-support-links", ".record-first-latest"]) {
  assert.ok(theme.includes(selector), `${selector} must be styled by the B theme, not obsolete global rules`);
}
assert.match(theme, /:focus-visible/, "keyboard focus must remain visible");
assert.doesNotMatch(theme, /overflow(?:-x)?:\s*(?:hidden|clip)/, "do not disguise narrow-screen overflow by clipping content");
assert.doesNotMatch(theme, /pointer-events:\s*none/, "readability rules must not silently disable actions");
assert.doesNotMatch(`${globalCss}\n${theme}`, /\.notebook-tab-bar\s*\{[^}]*display:\s*none/,
  "the six existing notebook panels must not lose navigation");

// Parse actual theme declarations, not old globals or comments. These are
// representative declared colors/sizes, not a full cascade/accessibility audit.
const css = postcss.parse(theme);
function declaration(selector, property) {
  let value;
  css.walkRules(selector, (rule) => {
    if (rule.parent.type !== "root") return;
    rule.walkDecls(property, (decl) => { value = decl.value; });
  });
  assert.ok(value, `theme must declare ${selector} ${property}`);
  return value;
}
const themeRoot = "html.readable-design-b";
const mainNav = read("apps/web/components/MainNav.tsx");
assert.match(mainNav, /aria-current=\{isActive \? "page" : undefined\}/, "current navigation stays accessible");
assert.match(mainNav, /className="nav-current-label" aria-hidden=\{!isActive\}/, "inactive status reserves layout without being announced");
assert.equal(declaration(`${themeRoot} .nav-link.is-active`, "background"), "var(--action-bg)");
assert.equal(declaration(`${themeRoot} .nav-link.is-active`, "color"), "var(--action-ink)");
assert.equal(declaration(`${themeRoot} .nav-link .nav-current-label`, "color"), "inherit");
assert.equal(declaration(`${themeRoot} .nav-link.is-active::after`, "content"), "none");
assert.doesNotMatch(theme, /\.nav-crisis\.is-active/, "urgent navigation must not override the shared current-page colors");
assert.doesNotMatch(globalCss, /\.nav-link\.nav-crisis:not\(\.is-active\)\s*\{[^}]*!important/, "legacy urgent-nav exception must not force a different hover or text color");
assert.doesNotMatch(theme, /#(?:60421f|faf7f0|eee5d1|554d3b|b8a989)\b/i, "selected brown palette must not return");
assert.match(layout, /<Link href="\/sponsors">広告掲載<\/Link>/);
for (const file of ["apps/web/app/sponsors/page.tsx", "apps/web/components/SponsorApplicationForm.tsx"]) {
  assert.ok(read(file).includes("広告掲載"));
  assert.ok(!read(file).includes("スポンサー枠"), "public advertising entry and destination use the same wording");
}
const resolveColor = (value) => {
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  return variable ? resolveColor(declaration(themeRoot, variable[1])) : value;
};
function luminance(color) {
  color = resolveColor(color).replace(/^#/, "");
  if (color.length === 3) color = [...color].map((character) => character.repeat(2)).join("");
  assert.match(color, /^[\da-f]{6}$/i, "representative contrast colors must be opaque hex");
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const channel = parseInt(color.slice(index * 2, index * 2 + 2), 16) / 255;
    return sum + weight * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  }, 0);
}
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
for (const [label, foreground, background] of [
  ["body", "var(--ink)", "var(--paper)"], ["secondary", "var(--ink-sub)", "var(--paper)"],
  ["faint information", "var(--ink-faint)", "#fff"], ["record", "var(--ink)", "#fff"],
  ["primary entry", declaration(`${themeRoot} .readable-entry.is-primary`, "color"),
    declaration(`${themeRoot} .readable-entry.is-primary`, "background")],
  ["selected navigation", "var(--action-ink)", "var(--action-bg)"],
  ["primary entry explanation", declaration(`${themeRoot} .readable-entry.is-primary .entry-copy small`, "color"), "var(--action-bg)"]
]) {
  assert.ok(contrast(foreground, background) >= 7, `${label} declared colors must meet the selected 7:1 target`);
}
assert.equal(declaration(`${themeRoot} body`, "font-family"), "var(--font-ui)");
assert.equal(declaration(`${themeRoot} .app-brand`, "font-family"), "var(--font-brand)", "logo retains its separate typeface");
assert.ok(parseFloat(declaration(`${themeRoot} body`, "font-size")) >= 20);
assert.ok(parseFloat(declaration(`${themeRoot} :is(h1, h2)`, "font-size")) >= 28);
assert.ok(parseFloat(declaration(`${themeRoot} .readable-entry`, "min-height")) >= 56);
assert.ok(parseFloat(declaration(`${themeRoot} .readable-support-links :is(a, button)`, "min-height")) >= 48);
assert.ok(parseFloat(declaration(`${themeRoot} .readable-entry .entry-copy small`, "font-size")) >= 16);
assert.ok(parseFloat(declaration(`${themeRoot} :is(.diary-entry-body > p, .history-preview-card p, .diary-save-complete-body p)`, "font-size")) >= 20);
assert.match(declaration(`${themeRoot} .readable-entry`, "grid-template-columns"), /minmax\(0,\s*1fr\)/);
assert.match(declaration(`${themeRoot} .readable-support-links`, "flex-wrap"), /wrap/);
for (const selector of [`${themeRoot} .notebook-workspace [role="tabpanel"]`, `${themeRoot} #document-location-note`]) {
  let desktopMargin = 0;
  let mobileMargin = 0;
  css.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls("scroll-margin-top", (decl) => {
      assert.match(decl.value, /^\d+px$/, "header clearance must be explicit for scroll-start anchors");
      if (rule.parent.type === "root") desktopMargin = parseFloat(decl.value);
      if (rule.parent.type === "atrule" && rule.parent.name === "media" && rule.parent.params === "(max-width: 760px)") {
        mobileMargin = parseFloat(decl.value);
      }
    });
  });
  assert.ok(desktopMargin >= 110, `${selector} must clear the desktop sticky header`);
  assert.ok(mobileMargin >= 150, `${selector} must clear the mobile stacked header`);
}

// Preserve the existing storage/role boundary while moving visual entry points.
assert.match(home, /notebookInteractionRef\.current\.inert = reconciliationBusy/);
assert.match(home, /<main ref=\{notebookInteractionRef\} aria-busy=\{reconciliationBusy\}/);
assert.match(home, /disabled=\{cloudContentReadOnly\} onClick=\{\(\) => saveDiary\(activeCase\.id\)\}/);
assert.match(home, /disabled=\{cloudContentReadOnly \|\| !editForm\.body\.trim\(\)\}/);
assert.match(home, /disabled=\{reconciliationBusy \|\| !cloudUserEmail \|\| cloudIdentityStatus !== "ready"/);
assert.match(home, /この記録はまだ保存できていません/);
assert.match(home, /今はこの端末に保存/);
assert.match(home, /ナビからのヒントを見る/);

// Execute the real preference code with isolated storage and DOM-shaped fakes.
const preferenceSource = read("apps/web/lib/display-theme.ts");
const preferences = compile(preferenceSource);
const { displayThemes, displayTheme, readDisplayTheme, saveDisplayTheme, DISPLAY_THEME_KEY, displayThemeCss } = preferences;
assert.equal(displayThemes.length, 10);
assert.equal(new Set(displayThemes.map((item) => item.id)).size, 10);
assert.equal(displayTheme("not-a-theme").id, "sky");
assert.equal(displayTheme(null).id, "sky");
assert.equal(readDisplayTheme({ getItem() { throw new Error("unavailable"); } }).id, "sky");
assert.equal(saveDisplayTheme({ setItem() { throw new Error("quota"); } }, "mint"), false);
const paletteCss = postcss.parse(displayThemeCss);
for (const item of displayThemes) {
  assert.match(item.id, /^[a-z]+$/);
  for (const color of [item.paper, item.action, item.soft, item.line]) assert.match(color, /^#[\da-f]{6}$/i);
  for (const background of [item.paper, item.action, item.soft, "#ffffff"]) {
    for (const foreground of ["var(--ink)", "var(--ink-sub)", "var(--action-ink)", "var(--primary-deep)"]) {
      assert.ok(contrast(foreground, background) >= 7, `${item.id} ${foreground}/${background} >= 7:1`);
    }
  }
  let rules = 0;
  paletteCss.walkRules(`${themeRoot}[data-display-color="${item.id}"]`, (rule) => {
    rules++;
    assert.ok(rule.nodes.some((node) => node.prop === "--action-bg" && node.value === item.action));
    assert.ok(rule.nodes.some((node) => node.prop === "--paper" && node.value === item.paper));
  });
  assert.equal(rules, 1);
}
const pickerSource = read("apps/web/components/DisplayThemePicker.tsx");
assert.match(layout, /<DisplayThemePicker\s*\/>/);
assert.match(layout, /__html: criticalCss \+ displayThemeCss/);
assert.doesNotMatch(`${preferenceSource}\n${pickerSource}`, /(?:fetch\(|supabase|from ["'].*store["']|\.clear\(|\.removeItem\()/,
  "display preference must not call services or erase any existing browser data");
assert.match(pickerSource, /<fieldset aria-describedby="display-theme-help">/);
assert.match(pickerSource, /role="status"/);

function pickerHarness({ saved = "sakura", denyGet = false, denySet = false, denyAccess = false } = {}) {
  const data = new Map([[DISPLAY_THEME_KEY, saved], ["notebook-fixture", "must remain untouched"]]);
  const writes = [];
  const effects = [];
  const states = [];
  const listeners = new Map();
  const attributes = {};
  const dataset = {};
  let cursor = 0;
  let mounted = false;
  const storage = {
    getItem(key) { if (denyGet) throw new Error("denied"); return data.get(key) ?? null; },
    setItem(key, value) { if (denySet) throw new Error("full"); writes.push([key, value]); data.set(key, value); }
  };
  const windowFake = {
    get localStorage() { if (denyAccess) throw new Error("denied"); return storage; },
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { assert.equal(listeners.get(name), handler); listeners.delete(name); }
  };
  const react = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (next) => { states[index] = next; }]; },
    useEffect(effect) { if (!mounted) effects.push(effect); }
  };
  const module = { exports: {} };
  const output = ts.transpileModule(pickerSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports, window: windowFake,
    document: { documentElement: { dataset }, querySelector(selector) {
      assert.equal(selector, 'meta[name="theme-color"]');
      return { setAttribute(key, value) { attributes[key] = value; } };
    } },
    require(name) {
      if (name === "react") return react;
      if (name === "@/lib/display-theme") return preferences;
      assert.equal(name, "react/jsx-runtime");
      return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    }
  });
  const render = () => { cursor = 0; return module.exports.DisplayThemePicker(); };
  const initial = render();
  assert.equal(writes.length, 0, "SSR/first render must not overwrite a saved choice");
  const initialRadios = descendants(initial, (node) => node.type === "input");
  assert.equal(initialRadios.filter((radio) => radio.props.checked)[0].props.value, "sky");
  mounted = true;
  const cleanups = effects.map((effect) => effect());
  return { render, dataset, attributes, data, writes, listeners, cleanups };
}
const paletteUi = pickerHarness();
assert.equal(paletteUi.dataset.displayColor, "sakura", "saved preference applies on mount");
assert.equal(paletteUi.writes.length, 0, "loading preference never writes over it");
for (const item of displayThemes) {
  const radios = descendants(paletteUi.render(), (node) => node.type === "input");
  assert.equal(radios.length, 10);
  assert.ok(radios.every((radio) => radio.props.type === "radio" && radio.props.name === "display-color"));
  radios.find((radio) => radio.props.value === item.id).props.onChange();
  assert.equal(paletteUi.dataset.displayColor, item.id);
  assert.equal(paletteUi.attributes.content, item.action);
  assert.equal(paletteUi.data.get(DISPLAY_THEME_KEY), item.id);
  const rendered = paletteUi.render();
  assert.equal(descendants(rendered, (node) => node.type === "input" && node.props.checked).length, 1);
  assert.ok(text(rendered).includes(`${item.name}に変更しました。このブラウザに保存しました。`));
  assert.equal(pickerHarness({ saved: item.id }).dataset.displayColor, item.id, "next mount restores each of ten choices");
}
assert.equal(paletteUi.data.get("notebook-fixture"), "must remain untouched");
assert.ok(paletteUi.writes.every(([key]) => key === DISPLAY_THEME_KEY));
paletteUi.listeners.get("storage")({ key: "notebook-fixture", newValue: "sky" });
assert.equal(paletteUi.dataset.displayColor, "gray", "unrelated storage events do not change the theme");
paletteUi.listeners.get("storage")({ key: DISPLAY_THEME_KEY, newValue: "mint" });
assert.equal(paletteUi.dataset.displayColor, "mint");
paletteUi.listeners.get("storage")({ key: DISPLAY_THEME_KEY, newValue: "invalid" });
assert.equal(paletteUi.dataset.displayColor, "sky");
for (const options of [{ denyGet: true }, { denySet: true }, { denyAccess: true }, { saved: "invalid" }]) {
  const ui = pickerHarness(options);
  if (!options.denySet) assert.equal(ui.dataset.displayColor, "sky");
  descendants(ui.render(), (node) => node.type === "input" && node.props.value === "lemon")[0].props.onChange();
  assert.equal(ui.dataset.displayColor, "lemon", "temporary selection works even without storage");
  if (options.denySet || options.denyAccess) assert.ok(text(ui.render()).includes("保存できませんでした"));
}
paletteUi.cleanups.forEach((cleanup) => cleanup());
assert.equal(paletteUi.listeners.size, 0);

console.log("B design entry rendering/navigation, ten display colors and source safety contracts: passed (layout/device QA separate)");
