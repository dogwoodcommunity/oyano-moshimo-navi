import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual native TSX handlers, synthetic hooks and APIs only. No network, AI,
// device, storage or production data. Key changes model React unmount/remount.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const clone = (value) => JSON.parse(JSON.stringify(value));
function compile(source, fileName) {
  return ts.transpileModule(source, { fileName, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText;
}
const helperModule = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, "apps/mobile/lib/consultTarget.ts"), "utf8"), "consultTarget.ts"), {
  module: helperModule, exports: helperModule.exports
});
const helpers = helperModule.exports;
const people = ["a", "b"].map((id) => ({ id: `person-${id}`, displayName: `合成${id}`, currentStatus: "preparing" }));
const [personA, personB] = people;
const access = { signedIn: true, plan: "free", dailyFreeAvailable: true, dailyFreeUsedAt: null, canConsult: true };
const answer = { situation: "合成回答", nextChecks: [], askQuestions: [], providerCategories: [], watchOuts: [] };
function memoryFor(id) {
  return {
    personId: id, memory: { longTermSummary: id, userSummary: `${id}の補足`, importantChanges: [],
      excludedEventIds: [], recordCount: 1, firstRecordDate: null, lastRecordDate: null, memoryVersion: 1 },
    history: [{ id: `${id}-history`, question: `${id}の履歴`, answer, savedToNotebookAt: null, createdAt: null }],
    excludedSources: [], historyTotal: 2, historyHasMore: true, canEditSharedMemory: true, canManageSharedMemory: true
  };
}
const source = fs.readFileSync(path.join(root, "apps/mobile/app/consult.tsx"), "utf8");
const ast = ts.createSourceFile("consult.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functionNode = (name) => ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
const stateNames = (name) => functionNode(name).body.statements.filter(ts.isVariableStatement)
  .flatMap((node) => node.declarationList.declarations)
  .filter((node) => ts.isArrayBindingPattern(node.name) && ts.isCallExpression(node.initializer)
    && node.initializer.expression.getText(ast) === "useState")
  .map((node) => node.name.elements[0].name.getText(ast));
const guard = functionNode("PersonConsultScreen").body.statements.find(ts.isIfStatement);
const instrumented = source.slice(0, guard.getStart(ast))
  + "globalThis.__handlers = { toggleConsent, refreshMemory, saveMemoryCorrection, toggleMemorySource, confirmMemoryDelete, loadOlderHistory, ask, saveTurnToTimeline };\n"
  + source.slice(guard.getStart(ast))
  + "\nexports.__screens = { ConsultScreen, PersonConsultScreen };\n";
const compiled = compile(instrumented, "consult.tsx");

function harness(componentName, { initial = {}, requestedId, api: overrides = {} } = {}) {
  const state = { ...initial };
  const names = stateNames(componentName);
  const calls = [];
  const alerts = [];
  const params = { personId: requestedId };
  const effects = [];
  const queued = [];
  let stateCursor = 0;
  let effectCursor = 0;
  let mounted = true;
  const record = (name, fn) => async (...args) => { calls.push({ name, args }); return fn(...args); };
  const api = Object.fromEntries(Object.entries({
    fetchDashboardData: async () => ({ person: personA, people }),
    fetchTimelineEntries: async (id) => [{ eventType: "diary", body: `${id}の記録`, date: "2026-09-20" }],
    fetchConsultAccess: async () => access,
    readConsultConsent: async () => ({ ok: true, data: { active: true, revision: 1, canManageSharedMemory: true } }),
    fetchConsultMemory: async (id) => ({ ok: true, data: memoryFor(id) }),
    writeConsultConsent: async (_id, value) => ({ ok: true, data: { active: value, revision: 2, canManageSharedMemory: true } }),
    patchConsultMemory: async (id) => ({ ok: true, data: memoryFor(id) }),
    deleteConsultMemory: async () => ({ ok: true, data: null }),
    requestConsult: async () => ({ ok: true, answer, disclaimer: "合成注意" }),
    addTimelineEntry: async () => ({}),
    trackFunnel: async () => {},
    ...overrides
  }).map(([name, fn]) => [name, record(name, fn)]));
  const react = {
    useState(initialValue) {
      const name = names[stateCursor++];
      assert.ok(name, "each state hook is identified from the real component AST");
      if (!(name in state)) state[name] = typeof initialValue === "function" ? initialValue() : initialValue;
      return [state[name], (next) => {
        assert.equal(mounted, true, `${componentName}.${name} received a late response after unmount`);
        state[name] = typeof next === "function" ? next(state[name]) : next;
      }];
    },
    useEffect(effect, deps) {
      const index = effectCursor++;
      const previous = effects[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        queued.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, cleanup: effect() };
        });
      }
    }
  };
  const element = (type, props, key) => ({ type, props: props ?? {}, key });
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports, Date,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react-native") return {
        ...Object.fromEntries(["Pressable", "ScrollView", "Text", "TextInput", "View"].map((item) => [item, item])),
        StyleSheet: { create: (styles) => styles }, Alert: { alert: (...args) => alerts.push(args) }
      };
      if (name === "expo-router") return {
        Link: "Link", useLocalSearchParams: () => params,
        useRouter: () => ({ setParams: (next) => Object.assign(params, next) })
      };
      if (name === "@expo/vector-icons") return { MaterialCommunityIcons: "Icon" };
      if (name === "@oyano/shared") return {
        CONSULT_MAX_ENTRIES: 30, CONSULT_MAX_HISTORY: 5, CONSULT_MAX_QUESTION_LENGTH: 600,
        CONSULT_SENT_FIELDS: [], CONSULT_WITHHELD_FIELDS: [], CONSULT_MEMORY_CONSENT_TEXT: "合成同意",
        hasNotebookSubstance: ({ entries }) => entries.length > 0,
        consultAnswerToHistoryTurn: (question, value) => ({ question, situation: value.situation }),
        consultAnswerToDiaryBody: (question) => `合成保存:${question}`
      };
      if (name === "@/lib/consultTarget") return helpers;
      if (["@/lib/consult", "@/lib/mobileData", "@/lib/funnel"].includes(name)) return api;
      if (name === "@/lib/theme") return { colors: {}, radius: {}, shadow: {} };
      if (name === "@/components/MobileSessionProvider") return { ProtectedScreen: "ProtectedScreen" };
      if (name === "@/components/ReportAiAnswer") return { ReportAiAnswer: "ReportAiAnswer" };
      throw Error(`Unexpected dependency: ${name}`);
    }
  });
  vm.runInContext(compiled, context);
  return {
    state, calls, alerts, params,
    get handlers() { return context.__handlers; },
    render(person = personB) {
      stateCursor = 0;
      effectCursor = 0;
      const tree = module.exports.__screens[componentName]({ person });
      queued.splice(0).forEach((run) => run());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); mounted = false; }
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree && typeof tree === "object" ? text(tree.props?.children) : String(tree ?? "");
}
const child = (tree) => nodes(tree).find((node) => node.type?.name === "PersonConsultScreen");
const drain = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

for (const requested of ["missing-person", "", [personB.id], [personA.id, personB.id]]) {
  assert.equal(helpers.resolveConsultTarget(people, requested).reason, "unavailable");
  assert.equal(helpers.resolveConsultTarget([personA], requested).person, null, "bad ID never falls back even with one person");
}
assert.equal(helpers.resolveConsultTarget(people, undefined).reason, "choose");
assert.equal(helpers.resolveConsultTarget([], undefined).reason, "empty");
assert.equal(helpers.resolveConsultTarget([personB], undefined).person, personB);
assert.equal(helpers.resolveConsultTarget(people, personB.id).person, personB);
const scope = helpers.createConsultTargetScope();
assert.equal(scope.capture()(), false);
const before = scope.begin();
scope.invalidate();
const after = scope.begin();
assert.equal(before(), false, "an old effect stays invalid after a new effect begins");
assert.equal(after(), true);

const selector = harness("ConsultScreen");
selector.render();
await drain();
let tree = selector.render();
assert.equal(child(tree), undefined, "multiple readable people require a choice");
assert.match(text(tree), /相談する人を選んでください/);
assert.equal(selector.calls.length, 1, "selection itself never reads private AI memory or sends a consultation");
nodes(tree).find((node) => node.type === "Pressable" && text(node).includes(personB.displayName)).props.onPress();
tree = selector.render();
assert.equal(child(tree).props.person.id, personB.id);
assert.equal(child(tree).key, personB.id, "person-specific state belongs to a keyed screen");
nodes(tree).find((node) => node.type === "Pressable" && text(node).includes("相談する人を変更")).props.onPress();
tree = selector.render();
nodes(tree).find((node) => node.type === "Pressable" && text(node).includes(personA.displayName)).props.onPress();
assert.equal(selector.params.personId, personB.id, "switch needs explicit discard confirmation");
const switchButtons = selector.alerts[0][2];
assert.equal(switchButtons[0].style, "cancel");
switchButtons[1].onPress();
assert.equal(child(selector.render()).key, personA.id);
selector.params.personId = "not-readable";
assert.equal(child(selector.render()), undefined, "invalid route removes the former person's screen");
for (const [returnedPeople, shouldFail] of [[[], false], [people, true]]) {
  const unavailable = harness("ConsultScreen", { requestedId: "not-readable", api: {
    fetchDashboardData: async () => {
      if (shouldFail) throw Error("synthetic read failure");
      return { people: returnedPeople };
    }
  } });
  unavailable.render();
  await drain();
  const unavailableTree = unavailable.render();
  assert.equal(child(unavailableTree), undefined);
  assert.match(text(unavailableTree), shouldFail ? /手帳を確認できませんでした/ : /先に対象者を登録してください/);
  assert.ok(nodes(unavailableTree).some((node) => node.type === "Link"), "empty/error state has a way back");
}

const screen = harness("PersonConsultScreen");
screen.render();
await drain();
assert.equal(screen.state.memory.personId, personB.id);
assert.ok(screen.calls.filter((call) => ["fetchTimelineEntries", "readConsultConsent", "fetchConsultMemory"].includes(call.name))
  .every((call) => call.args[0] === personB.id));
screen.state.question = "合成の相談文です";
screen.state.turns = [{ id: "b-turn", question: "Bさんの前の相談", answer, saved: false }];
screen.render();
await screen.handlers.ask();
const sent = screen.calls.find((call) => call.name === "requestConsult").args[0];
assert.equal(sent.personId, personB.id);
assert.equal(sent.entries[0].body, `${personB.id}の記録`);
assert.equal(sent.history[0].question, "Bさんの前の相談");
screen.state.question = "送信してはいけない相談";
screen.state.consent = false;
screen.render();
const sentCount = screen.calls.length;
await screen.handlers.ask();
assert.equal(screen.calls.length, sentCount, "handler enforces consent as well as disabled UI");
screen.unmount();
const nextScreen = harness("PersonConsultScreen");
nextScreen.render(personA);
assert.equal(nextScreen.state.question, "");
assert.equal(nextScreen.state.turns.length, 0);
assert.equal(nextScreen.state.memory, null);
assert.equal(nextScreen.state.memoryDraft, "");
assert.equal(nextScreen.state.consent, false);
assert.equal(nextScreen.state.deleteScope, null);
await drain();
assert.equal(nextScreen.state.memory.personId, personA.id);

for (const [apiName, invoke, result] of [
  ["writeConsultConsent", (h) => h.toggleConsent(), { ok: true, data: { active: true, revision: 2, canManageSharedMemory: true } }],
  ["fetchConsultMemory", (h) => h.refreshMemory(), { ok: true, data: memoryFor(personB.id) }],
  ["patchConsultMemory", (h) => h.saveMemoryCorrection(), { ok: false, code: "memory_conflict" }],
  ["patchConsultMemory", (h) => h.toggleMemorySource("b-entry", true), { ok: true, data: memoryFor(personB.id) }],
  ["deleteConsultMemory", (h) => h.confirmMemoryDelete(), { ok: true, data: null }],
  ["fetchConsultMemory", (h) => h.loadOlderHistory(), { ok: true, data: memoryFor(personB.id) }],
  ["requestConsult", (h) => h.ask(), { ok: true, answer, disclaimer: "旧対象者の回答" }],
  ["addTimelineEntry", (h) => h.saveTurnToTimeline(0), {}]
]) {
  const pending = deferred();
  let hold = false;
  const stale = harness("PersonConsultScreen", { api: {
    [apiName]: async (id) => hold ? pending.promise : { ok: true, data: memoryFor(id) }
  } });
  stale.render();
  await drain();
  Object.assign(stale.state, {
    phase: "ready", consent: apiName !== "writeConsultConsent", memory: memoryFor(personB.id),
    question: "切り替え前の合成相談", memoryDraft: "切り替え前の補足", deleteScope: "all",
    turns: [{ id: "old-turn", question: "切り替え前", answer, saved: false }]
  });
  stale.render();
  hold = true;
  const operation = invoke(stale.handlers);
  assert.equal(stale.calls.at(-1).name, apiName);
  stale.unmount();
  const previousCalls = stale.calls.length;
  pending.resolve(result);
  await operation;
  await drain();
  assert.equal(stale.calls.length, previousCalls, `${apiName}: stale result cannot launch further requests`);
}

const lateRead = deferred();
const staleLoading = harness("PersonConsultScreen", { api: { fetchTimelineEntries: () => lateRead.promise } });
staleLoading.render();
staleLoading.unmount();
lateRead.resolve([]);
await drain();
assert.equal(staleLoading.calls.some((call) => call.name === "readConsultConsent"), false);
const failedRead = harness("PersonConsultScreen", { api: {
  fetchTimelineEntries: async () => { throw Error("synthetic read failure"); }
} });
failedRead.render();
await drain();
assert.match(text(failedRead.render()), /手帳を読み込めませんでした/);
assert.equal(nodes(failedRead.render()).some((node) => node.type === "TextInput"), false, "read failure does not expose an empty, apparently ready notebook");

const noConsent = harness("PersonConsultScreen", { api: {
  readConsultConsent: async () => ({ ok: true, data: { active: false, revision: 1, canManageSharedMemory: false } })
} });
noConsent.render();
await drain();
assert.equal(noConsent.calls.some((call) => call.name === "fetchConsultMemory"), false);
noConsent.state.deleteScope = "all";
noConsent.render();
await noConsent.handlers.confirmMemoryDelete();
assert.equal(noConsent.calls.some((call) => call.name === "deleteConsultMemory"), false, "shared deletion keeps owner/admin gate");

const turnId = "11111111-1111-4111-8111-111111111111";
let responseMemory;
const transportCalls = [];
const transportModule = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, "apps/mobile/lib/consult.ts"), "utf8"), "consult.ts"), {
  module: transportModule, exports: transportModule.exports,
  process: { env: { EXPO_PUBLIC_WEB_BASE_URL: "https://synthetic.invalid" } },
  fetch: async (url, options) => {
    transportCalls.push({ url, options });
    return { ok: true, json: async () => ({ answer, memory: responseMemory }) };
  },
  require(name) {
    if (name === "@oyano/shared") return { CONSULT_MEMORY_CONSENT_VERSION: "synthetic-consent", normalizeConsultAnswer: (value) => value };
    if (name === "./supabase") return { getSupabase: () => ({ auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic-token" } } })
    } }) };
    throw Error(`Unexpected transport dependency: ${name}`);
  }
});
for (const [value, expected] of [
  [{ personId: personB.id, persistedTurnId: turnId }, turnId],
  [{ personId: personA.id, persistedTurnId: turnId }, undefined],
  [{ personId: personB.id, persistedTurnId: "local-ui-id" }, undefined],
  [{ personId: personB.id, persistedTurnId: null }, undefined],
  [undefined, undefined]
]) {
  responseMemory = value;
  const outcome = await transportModule.exports.requestConsult({ personId: personB.id, question: "合成相談" });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.persistedTurnId, expected, "only this person's persisted server ID is reportable");
}
responseMemory = { persistedTurnId: turnId };
assert.equal((await transportModule.exports.requestConsult({ question: "対象者なしの合成相談" })).persistedTurnId, undefined);
assert.equal(JSON.parse(transportCalls[0].options.body).memoryConsentVersion, "synthetic-consent");
assert.equal(transportCalls[0].options.headers.Authorization, "Bearer synthetic-token");
assert.ok(nodes(nextScreen.render(personA)).filter((node) => node.type === "ReportAiAnswer")
  .every((node) => Object.keys(node.props).join(",") === "turnId"), "report controls receive no question, answer or person data");

const dashboardSource = fs.readFileSync(path.join(root, "apps/mobile/app/(tabs)/dashboard.tsx"), "utf8");
const personSource = fs.readFileSync(path.join(root, "apps/mobile/app/people/[id]/index.tsx"), "utf8");
assert.match(dashboardSource, /ConsultCard personId=\{data\.person\.id\}/);
assert.match(dashboardSource, /pathname: "\/consult", params: \{ personId \}/);
assert.match(personSource, /pathname: "\/consult", params: \{ personId: person\.id \}/);
console.log("mobile consult target: ok (actual native TSX; readable targets, explicit multi-person choice, keyed draft isolation, 8 late-result guards, consent/owner gates; synthetic only)");
