import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Execute the actual component and its handlers with synthetic React state and
// mocked dependencies. No real storage, browser, network, account or AI call.
// SSR/handler evidence complements, but does not replace, browser layout checks.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const ts = requireWeb("typescript");
const React = requireWeb("react");
const jsxRuntime = requireWeb("react/jsx-runtime");
const { renderToStaticMarkup } = requireWeb("react-dom/server");
const source = fs.readFileSync(path.join(root, "apps/web/components/ConsultPanel.tsx"), "utf8");
const ast = ts.createSourceFile("ConsultPanel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "ConsultPanel");
assert.ok(component?.body, "actual consultation component exists");
const stateNames = component.body.statements.filter(ts.isVariableStatement)
  .flatMap((node) => node.declarationList.declarations)
  .filter((node) => ts.isArrayBindingPattern(node.name) && ts.isCallExpression(node.initializer)
    && node.initializer.expression.getText(ast) === "useState")
  .map((node) => node.name.elements[0].name.getText(ast));
const firstGuard = component.body.statements.find(ts.isIfStatement);
assert.ok(firstGuard, "component has its loading/empty-state guard");
// Expose actual lexical handlers inside this VM, including those whose button
// is hidden/disabled; this tests their own guards independently of the DOM.
const instrumented = source.slice(0, firstGuard.getStart(ast))
  + "globalThis.__consultHandlers = { submit, startFirstConsult, recheckConsultSetup };\n"
  + source.slice(firstGuard.getStart(ast));
const compiled = ts.transpileModule(instrumented, {
  fileName: "ConsultPanel.tsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const clone = (value) => JSON.parse(JSON.stringify(value));
const caseA = {
  id: "synthetic-case-a", cloudPersonId: "synthetic-person-a", createdAt: "2026-09-01T00:00:00Z",
  selectedStatus: "at_home", answers: { targetName: "合成の手帳" }, personProfile: { displayName: "合成の手帳" }
};
const access = { signedIn: true, plan: "free", dailyFreeAvailable: true, dailyFreeUsedAt: null, canConsult: true };
const memory = {
  longTermSummary: "合成の記録", userSummary: "", importantChanges: [], recordCount: 1,
  firstRecordDate: null, lastRecordDate: null, memoryVersion: 1, updatedAt: null, excludedEventIds: []
};
const payload = {
  personId: caseA.cloudPersonId, memory, turns: [], historyTotal: 0, historyHasMore: false,
  historyOffset: 0, canEditSharedMemory: true, canManageSharedMemory: true
};
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object") return [];
  return [node, ...flatten(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  return node && typeof node === "object" ? text(node.props?.children) : String(node ?? "");
}
const classIs = (node, name) => String(node.props?.className ?? "").split(" ").includes(name);
function one(nodes, predicate, label) {
  const found = nodes.filter(predicate);
  assert.equal(found.length, 1, label);
  return found[0];
}

function harness(patch = {}, options = {}) {
  const state = {
    loaded: true, cases: clone([caseA]), activeCaseId: caseA.id, consent: false,
    question: "合成の相談文を入力しています。", phase: "idle", turns: [], errorMessage: "",
    hasSubstance: true, authChecked: true, consultAccess: clone(access), openedFromRecord: false,
    memoryMode: "temporary", memoryReason: "合成の設定待ち", memoryPayload: null,
    memoryDraft: "", memoryEditing: false, memoryAction: "idle", historyLoading: false,
    consentSaving: false, consentRevision: 0, consentCanManageSharedMemory: false,
    memoryMessage: "", deleteIntent: null, memoryDetailsOpen: false, ...patch
  };
  const requests = [];
  const preparations = [];
  let identityChecks = 0;
  const effects = [];
  const timers = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  let localCases = clone(options.localCases ?? state.cases);
  let localReads = 0;
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: "synthetic-token", user: { id: "synthetic-user" } } } }) }
  };
  const shared = {
    CONSULT_MAX_QUESTION_LENGTH: 600, CONSULT_MEMORY_CONSENT_VERSION: "synthetic-consent-version",
    CONSULT_MEMORY_CONSENT_TEXT: "合成の長期記憶の同意説明", CONSULT_SENT_FIELDS: [], CONSULT_WITHHELD_FIELDS: [],
    statusLabel: () => "合成状態", hasNotebookSubstance: () => true,
    normalizeConsultAnswer: (value) => value ?? null,
    consultAnswerToDiaryBody: () => { throw new Error("not a notebook-save test"); }
  };
  const react = {
    useState(initial) {
      const name = stateNames[stateIndex++];
      assert.ok(name, "every actual state hook has an AST-derived name");
      if (!(name in state)) state[name] = typeof initial === "function" ? initial() : initial;
      return [state[name], (value) => { state[name] = typeof value === "function" ? value(state[name]) : value; }];
    },
    useMemo: (make) => make(),
    useRef(initial) {
      const index = refIndex++;
      refs[index] ??= { current: initial };
      return refs[index];
    },
    useEffect(setup, deps) { effects.push({ setup, deps }); }
  };
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, URLSearchParams,
    window: { location: { search: "" }, setTimeout: (callback) => { timers.push(callback); return timers.length; } },
    document: { getElementById: () => null },
    fetch: async (url, init = {}) => {
      const method = init.method ?? "GET";
      requests.push({ url, method, ...init });
      if (method === "POST" && url === "/api/consult") {
        if (options.postNetworkFailure) throw new Error("合成の通信中断");
        if (options.postSuccess) return { ok: true, status: 200, json: async () => ({ answer: { summary: "合成の回答" } }) };
        return { ok: false, status: 503, json: async () => ({ message: "合成の送信失敗" }) };
      }
      if (method === "POST" && url === "/api/consult/memory/consent") {
        return { ok: true, status: 200, json: async () => ({ consent: { active: true, revision: 2 }, canManageSharedMemory: true }) };
      }
      assert.equal(method, "GET", "entry/recheck never sends consent, notebook or memory writes");
      if (url.startsWith("/api/consult/memory/consent?")) {
        return { ok: true, json: async () => ({ consent: { active: options.consentActive !== false, revision: 1 }, canManageSharedMemory: true }) };
      }
      if (url.startsWith("/api/consult/memory?")) {
        return { ok: true, json: async () => ({ ...payload, personId: new URLSearchParams(url.split("?")[1]).get("personId"), history: [] }) };
      }
      assert.equal(url, "/api/consult");
      if (options.accessReadFailure) throw new Error("合成の利用枠取得失敗");
      return { ok: true, json: async () => clone(access) };
    },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "next/link") return { default: "a" };
      if (name === "@oyano/shared") return shared;
      if (name === "@/components/NotebookMascot") return { NotebookMascot: () => React.createElement("span", { "aria-hidden": true }) };
      if (name === "@/components/MascotMotionPreference") return { useMascotMotionPreference: () => ({ enabled: false }) };
      if (name === "@/lib/browserSupabase") return { getBrowserSupabase: () => client };
      if (name === "@/components/ConsultGuestCheck") return { ConsultGuestCheck: () => React.createElement("div", null, "合成の安全確認") };
      if (name === "@/lib/consultNotebookPreparation") return { prepareConsultNotebook: async (input) => {
        preparations.push(input);
        input.assertCurrent();
        if (options.prepareFailure) throw new Error("合成の保存失敗");
        return { caseRecord: caseA, guest: Boolean(options.guest), authUserId: "synthetic-user", assertIdentity: async () => {
          identityChecks++;
          if (identityChecks === options.failIdentityAt) throw new Error("合成の本人変更");
        } };
      } };
      if (name === "@/lib/date") return { japanDateInputValue: () => "2026-09-19" };
      if (name === "@/lib/funnel") return { trackFunnel: () => {} };
      if (name === "@/lib/monitorSession") return { markMonitorActivity: () => {} };
      if (name === "@/lib/store") return {
        listLocalCases: () => { localReads++; return clone(localCases); },
        listDiaryEntries: () => [{ body: "合成の日記" }],
        readNotebookCloudBinding: () => ({ authUserId: "synthetic-user", familyId: "synthetic-family" }),
        addDiaryEntryWithStatus: () => { throw new Error("entry must not write notebook data"); }
      };
      throw new Error(`Unexpected consultation dependency: ${name}`);
    }
  };
  vm.runInNewContext(compiled, context);
  return {
    state, requests, effects, preparations,
    get handlers() { return context.__consultHandlers; },
    get localReads() { return localReads; },
    setLocalCases(value) { localCases = clone(value); },
    render() {
      stateIndex = 0;
      refIndex = 0;
      effects.length = 0;
      const tree = module.exports.ConsultPanel();
      return { tree, nodes: flatten(tree), html: renderToStaticMarkup(tree) };
    }
  };
}
const ready = { memoryMode: "durable", memoryPayload: clone(payload), consent: true, memoryReason: "" };

for (const mode of ["temporary", "checking", "consent-required", "durable"]) {
  const h = harness(mode === "durable" ? ready : { memoryMode: mode });
  let rendered = h.render();
  const composer = one(rendered.nodes, (node) => classIs(node, "consult-composer"), `${mode}: one composer`);
  const input = one(flatten(composer), (node) => node.type === "textarea", `${mode}: editable question field`);
  assert.equal(Boolean(input.props.disabled || input.props.readOnly), false, `${mode}: preparation never blocks drafting`);
  assert.equal(input.props.maxLength, 600);
  const details = one(rendered.nodes, (node) => node.type === "details" && classIs(node, "consult-memory-details"),
  `${mode}: one preparation/memory disclosure`);
  assert.equal(Boolean(details.props.open), false, `${mode}: detail starts collapsed`);
  assert.ok(rendered.nodes.indexOf(composer) < rendered.nodes.indexOf(details), `${mode}: writing precedes preparation`);
  assert.ok(rendered.html.includes("<textarea"), `${mode}: SSR includes question input`);
  input.props.onChange({ target: { value: "編集した合成の相談文" } });
  assert.equal(h.state.question, "編集した合成の相談文");
  rendered = h.render();
  const suggestions = rendered.nodes.filter((node) => node.type === "button" && node.props["aria-label"]?.endsWith("を相談内容に追加"));
  assert.ok(suggestions.length > 0, `${mode}: question examples are available before setup`);
  suggestions[0].props.onClick();
  assert.ok(h.state.question.startsWith("編集した合成の相談文\n\n"), "suggestions retain existing text");
  assert.equal(h.requests.length, 0, "rendering/typing/suggestions do not send requests");
  if (mode === "temporary" || mode === "consent-required") {
    const cta = one(flatten(composer), (node) => node.type === "button" && classIs(node, "consult-submit"), "preparation CTA");
    assert.equal(Boolean(cta.props.disabled), false);
    await cta.props.onClick();
    assert.equal(h.state.firstUseOpen, true, "CTA opens a brief in-place consent check, not separate setup");
    assert.equal(h.state.memoryDetailsOpen, false);
    assert.equal(h.requests.length, 0, "preparation CTA must never send the consultation");
  }
  if (mode === "temporary") {
    const link = one(rendered.nodes, (node) => node.props.href === "/home#cloud-backup", "one setup link");
    assert.equal(link.props.target, "_blank", "setup preserves the current mounted draft in another tab");
    assert.match(link.props.rel, /noopener/);
    assert.match(text(link), /別タブ|別のタブ/, "new-tab behavior is explained before navigation");
  }
}

// Call the actual submit handler even when UI disables or omits the button.
for (const patch of [
  { memoryMode: "temporary", memoryPayload: null }, { memoryMode: "checking" },
  { memoryMode: "consent-required", consent: false }, { consent: false },
  { authChecked: false }, { consentSaving: true }, { hasSubstance: false },
  { question: "" }, { question: "  \n " }, { question: "三文字" }, { phase: "loading" },
  { consultAccess: { ...access, canConsult: false, dailyFreeAvailable: false } }, { memoryPayload: null }
]) {
  const h = harness({ ...ready, ...patch });
  h.render();
  const original = h.state.question;
  await h.handlers.submit();
  assert.equal(h.requests.length, 0, `blocked submit must not send: ${JSON.stringify(patch)}`);
  assert.equal(h.state.question, original, "blocked submit retains the draft");
}
{
  const h = harness(ready);
  const original = h.state.question;
  const rendered = h.render();
  const composer = one(rendered.nodes, (node) => classIs(node, "consult-composer"), "ready composer");
  const send = one(flatten(composer), (node) => node.type === "button" && classIs(node, "consult-submit"), "ready send");
  assert.equal(send.props.disabled, false);
  await send.props.onClick();
  assert.equal(h.requests.filter((request) => request.method === "POST").length, 1, "ready explicit send rechecks consent and memory before the mocked consultation endpoint");
  assert.equal(h.requests.at(-1).method, "POST");
  assert.deepEqual(JSON.parse(h.requests.find((request) => request.method === "POST" && request.url === "/api/consult").body), {
    question: original, personId: caseA.cloudPersonId, memoryConsentVersion: "synthetic-consent-version"
  });
  assert.equal(h.state.question, original, "failed send preserves the original draft");
  assert.equal(h.state.phase, "error");
}

for (const patch of [{ firstUseAccepted: false }, { requiresGuestSession: true, guestCapability: { enabled: false } },
  { requiresGuestSession: true, guestCapability: { enabled: true, captchaSiteKey: "synthetic" }, captchaToken: "" },
  { question: "" }, { phase: "loading" }]) {
  const h = harness({ firstUseAccepted: true, ...patch });
  h.render();
  await h.handlers.startFirstConsult();
  assert.equal(h.preparations.length, 0, "no preparation without explicit consent, question and safety check");
  assert.equal(h.requests.length, 0);
}
{
  const h = harness({ firstUseAccepted: true, requiresGuestSession: true,
    guestCapability: { enabled: true, captchaSiteKey: "synthetic" }, captchaToken: "synthetic-captcha" }, { consentActive: false, guest: true });
  h.render();
  const draft = h.state.question;
  await Promise.all([h.handlers.startFirstConsult(), h.handlers.startFirstConsult()]);
  assert.equal(h.preparations.length, 1, "double click cannot provision or send twice");
  assert.equal(h.preparations[0].allowCreate, true);
  assert.equal(h.requests.filter((request) => request.method === "POST" && request.url === "/api/consult").length, 1);
  assert.ok(h.requests.findIndex((request) => request.url === "/api/consult/memory/consent")
    < h.requests.findIndex((request) => request.url === "/api/consult"), "consent persists before AI send");
  assert.equal(h.state.question, draft, "AI error retains first-use draft");
  assert.equal(h.state.guestSession, true);
}
for (const options of [{ prepareFailure: true }, { failIdentityAt: 1 }, { failIdentityAt: 2 }, { failIdentityAt: 3 }]) {
  const h = harness({ firstUseAccepted: true }, { consentActive: false, ...options });
  h.render();
  const draft = h.state.question;
  await h.handlers.startFirstConsult();
  assert.equal(h.requests.filter((request) => request.method === "POST" && request.url === "/api/consult").length, 0,
    "save/identity failures block the AI request");
  assert.equal(h.state.question, draft);
  assert.equal(h.state.phase, "error");
}

for (const options of [{ postSuccess: true, failIdentityAt: 4 }, { postNetworkFailure: true }]) {
  const h = harness(ready, options);
  h.render();
  const draft = h.state.question;
  await h.handlers.submit();
  assert.equal(h.requests.filter((request) => request.method === "POST" && request.url === "/api/consult").length, 1);
  assert.equal(h.state.question, draft, "uncertain post-send result retains the draft");
  assert.equal(h.state.phase, "error");
  assert.match(h.state.errorMessage, /届いている可能性.*再送する前に.*相談履歴/);
  assert.doesNotMatch(h.state.errorMessage, /送信していません|もう一度相談/);
}
{
  const h = harness(ready, { postSuccess: true, accessReadFailure: true });
  h.render();
  await h.handlers.submit();
  assert.equal(h.state.phase, "done", "quota-read failure must not turn a saved answer into a failed send");
  assert.equal(h.state.turns.length, 1);
  assert.equal(h.state.question, "");
  assert.equal(h.state.errorMessage, "");
}

for (const patch of [ready, { memoryMode: "checking" }, { phase: "loading" },
  { consentSaving: true }, { memoryAction: "saving" }, { memoryEditing: true },
  { historyLoading: true }, { deleteIntent: "history" }]) {
  const h = harness(patch);
  h.render();
  const original = clone(h.state);
  h.handlers.recheckConsultSetup();
  assert.equal(h.localReads, 0, "recheck cannot reset active consultation/edit/consent/delete state");
  assert.deepEqual(clone(h.state), original);
  assert.equal(h.requests.length, 0);
}
{
  const updated = { ...caseA, cloudPersonId: "synthetic-updated-person", personProfile: { nickname: "更新した合成手帳" } };
  const other = { ...caseA, id: "synthetic-other-case", cloudPersonId: "synthetic-other-person" };
  const h = harness({}, { localCases: [other, updated] });
  h.render();
  const original = h.state.question;
  h.handlers.recheckConsultSetup();
  assert.equal(h.localReads, 1);
  assert.equal(h.state.activeCaseId, caseA.id, "recheck must preserve target despite reordered notebooks");
  h.render();
  for (const effect of h.effects.filter((item) => item.deps?.length === 1)) effect.setup();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(h.state.question, original, "setup and permission refresh preserve the question");
  assert.equal(h.state.memoryMode, "durable", "explicit recheck reloads consent and current memory");
  assert.equal(h.state.memoryPayload.personId, updated.cloudPersonId, "updated same-case cloud identifier is used");
  assert.ok(h.requests.some((item) => item.url === "/api/consult"), "recheck refreshes access/quota too");
  assert.ok(h.requests.every((item) => item.method === "GET"), "recheck never auto-sends any content");
  h.state.memoryMode = "temporary";
  h.state.memoryPayload = null;
  h.setLocalCases([other]);
  h.render();
  h.handlers.recheckConsultSetup();
  const missing = h.render();
  assert.equal(h.state.activeCaseId, caseA.id, "deleted target must not fall back to another person");
  assert.equal(h.state.question, original);
  assert.equal(missing.nodes.some((node) => classIs(node, "consult-composer")), false, "missing target cannot send against another notebook");
}

assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|sendBeacon|\.setItem\(/,
  "consultation drafts gain no persistent storage or implicit transmission");
assert.doesNotMatch(source, /addEventListener\(\s*["'](?:focus|visibilitychange)["']/,
  "returning to the tab does not reset live edits through implicit focus refresh");
console.log("consult entry: ok (actual TSX + SSR; composer-first in 4 modes, no-send setup CTA, guarded submit/recheck, same-case refresh and draft preservation; synthetic only)");
