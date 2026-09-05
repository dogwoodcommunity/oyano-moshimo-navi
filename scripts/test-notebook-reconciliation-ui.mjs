import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Event-level component regression with in-memory React/Auth/storage/HTTP mocks.
// No browser, environment files, real accounts, database or network are used.
// The real pure reconciliation planner and stable-ID implementation run here.
// DOM layout, home integration and atomic storage are separate test boundaries.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const plain = (value) => JSON.parse(JSON.stringify(value));
const A = "41000000-0000-4000-8000-000000000001";
const B = "41000000-0000-4000-8000-000000000002";
const FAMILY = "41000000-0000-4000-8000-000000000003";
const PERSON = "41000000-0000-4000-8000-000000000004";
const SOURCE = "ui-source-case";
const TARGET = "ui-target-case";
const TIME = "2026-09-05T10:00:00.000Z";
const labels = {
  preview: "両方の記録を確認する", submit: "日記を1冊にまとめる",
  close: "変更せず閉じる", source: "端末の控えをダウンロード", archive: "まとめる前の端末手帳をダウンロード"
};

function load(relative, dependencies, globals = {}) {
  const filename = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})(require,module,exports);`, {
    module, exports: module.exports, require: dependencies,
    crypto: webcrypto, TextEncoder, Uint8Array, Date, Error, ...globals
  }, { filename });
  return module.exports;
}
const helper = load("apps/web/lib/notebookReconciliation.ts", (name) => {
  throw new Error(`Unexpected pure helper dependency: ${name}`);
});

function fixtures() {
  const sourceCase = {
    id: SOURCE, selectedStatus: "prepare", answers: {}, status: "result_ready", createdAt: TIME,
    personProfile: { displayName: "端末の仮名", documentLocationNote: "端末だけの所在メモ" },
    result: { tasks: [{ id: "source-task", title: "端末だけの確認事項" }] }
  };
  const remoteCase = {
    id: TARGET, selectedStatus: "prepare", answers: {}, status: "result_ready", createdAt: TIME,
    cloudPersonId: PERSON, cloudRevision: 2, cloudHash: "b".repeat(64),
    personProfile: { displayName: "クラウドの仮名", documentLocationNote: "既存の所在メモ" },
    result: { tasks: [{ id: "remote-task", title: "既存の確認事項" }] }
  };
  const entry = {
    id: "source-entry", caseId: SOURCE, date: "2026-09-05", mood: "stable", attachments: [],
    body: "UI回帰テストの仮の記録です。", createdAt: TIME
  };
  return {
    local: { version: 1, exportedAt: TIME, cases: [sourceCase], diaryEntries: [entry] },
    remote: {
      familyId: FAMILY, memberRole: "owner", cases: [remoteCase],
      diaryEntries: [{ ...entry, id: "remote-existing-entry", caseId: TARGET, body: "既存の仮の記録です。", cloudRevision: 1, cloudHash: "a".repeat(64) }]
    }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve, hit: false };
}
const nextTurn = () => new Promise((done) => setImmediate(done));

function harness(options = {}) {
  const initial = fixtures();
  const h = {
    local: initial.local, remote: initial.remote, binding: null, archive: null,
    session: { user: { id: A }, access_token: "mock-token-A" },
    events: [], posts: [], installs: [], completions: [], busyEvents: [], violations: [], downloads: [],
    blockedPeople: new Set(), blockedDiaries: new Set(), gates: new Map(), listeners: new Set(),
    sessionCount: 0, sessionInFlight: 0, readCount: 0, active: true, archiveOK: true, installOK: true,
    postOK: true, postCommits: true, responseTransform: (value) => value,
    remoteReadTransform: (value) => value, ...options
  };
  const slots = [];
  const refs = [];
  let position = 0;
  let pendingEffects = [];
  let dirty = false;
  let tree;
  function useSlot(initial) {
    const index = position++;
    if (!(index in slots)) slots[index] = initial();
    return index;
  }
  const react = {
    useState(initialValue) {
      const index = useSlot(() => typeof initialValue === "function" ? initialValue() : initialValue);
      return [slots[index], (next) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef(initialValue) {
      const index = useSlot(() => {
        const ref = { current: initialValue };
        refs.push({ initialValue, ref });
        return ref;
      });
      return slots[index];
    },
    useEffect(effect, deps) {
      const index = useSlot(() => ({ deps: undefined, cleanup: undefined }));
      const old = slots[index];
      if (!old.deps || !deps || old.deps.length !== deps.length || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        pendingEffects.push(() => {
          old.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    }
  };
  h.props = {
    userId: A, email: "ui-regression@example.test", familyId: FAMILY, eligible: true, unavailable: false,
    onBusy(value) { h.events.push(`busy:${value}`); h.busyEvents.push(value); },
    onComplete(value) { h.events.push("complete"); h.completions.push(plain(value)); }
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  async function step(label) {
    h.events.push(label);
    const gate = h.gates.get(label);
    if (gate) { gate.hit = true; await gate.promise; }
  }
  // Protocol violations must fail even when the component catches an exception.
  function protocol(condition, message) {
    if (!condition) { h.violations.push(message); throw new Error(message); }
  }
  const client = {
    auth: {
      async getSession() {
        h.sessionInFlight += 1;
        try {
          await step(`session:${++h.sessionCount}`);
          return { data: { session: h.session ? plain(h.session) : null } };
        } finally { h.sessionInFlight -= 1; }
      },
      onAuthStateChange(callback) {
        h.listeners.add(callback);
        return { data: { subscription: { unsubscribe() { h.listeners.delete(callback); } } } };
      }
    }
  };
  const store = {
    exportNotebookData: () => plain(h.local),
    readNotebookCloudBinding: () => h.binding ? plain(h.binding) : null,
    readNotebookReconciliationArchive: () => {
      if (!h.archive) return null;
      // Mirror the store's filtered download view, not its raw install journal.
      // Atomic journal recovery/real tombstones run in the storage regression.
      const related = new Set(h.archive.source.cases.map((item) => item.id));
      if (h.archive.targetCaseId) related.add(h.archive.targetCaseId);
      if ([...related].some((caseId) => h.blockedPeople.has(caseId)
          || [...h.blockedDiaries].some((key) => key.startsWith(`${caseId}:`)))) return null;
      return plain(h.archive);
    },
    isPersonNotebookCloudSyncBlocked: (id) => h.blockedPeople.has(id),
    isDiaryEntryCloudSyncBlocked: (caseId, id) => h.blockedDiaries.has(`${caseId}:${id}`),
    archiveNotebookForReconciliation(source, destination) {
      h.events.push("archive");
      if (!h.archiveOK) return false;
      h.archive = { source: plain(source), destination: plain(destination), status: "prepared" };
      return true;
    },
    installReconciledNotebook(input) {
      h.events.push("install");
      h.installs.push(plain(input));
      // A mock of the real store's compare-before-install guard, not a test of
      // the store implementation itself (covered by the storage regression).
      if (!h.installOK || !h.archive
          || helper.notebookReconciliationFingerprint(h.local) !== helper.notebookReconciliationFingerprint(input.source)
          || h.session?.user.id !== input.destination.authUserId) return false;
      h.local = { version: 1, exportedAt: TIME, cases: plain(input.notebook.cases), diaryEntries: plain(input.notebook.diaryEntries) };
      h.binding = plain(input.destination);
      h.archive.targetCaseId = input.notebook.cases[0].id;
      h.archive.status = "installed";
      return true;
    }
  };
  const cloud = {
    async readReconciliationCloudNotebook(input) {
      protocol(input.familyId === FAMILY && typeof input.assertCurrent === "function", "GET must be scoped and cancellable");
      input.assertCurrent();
      const count = ++h.readCount;
      const snapshot = plain(h.remote);
      await step(`read:${count}`);
      input.assertCurrent();
      return h.remoteReadTransform(snapshot, count);
    }
  };
  const fetch = async (url, init) => {
    protocol(url === "/api/notebook/reconcile" && init.method === "POST", "Only the mocked append endpoint is allowed");
    protocol(h.archive?.status === "prepared", "POST requires an archived original");
    protocol(init.headers.Authorization === `Bearer ${h.session?.access_token}`, "POST must use the freshly verified session");
    const body = JSON.parse(init.body);
    h.posts.push(body);
    await step("post");
    if (h.postCommits) {
      const plan = await helper.planNotebookReconciliation({
        local: { cases: [{ id: body.sourceCaseId }], diaryEntries: body.diaryEntries },
        remote: h.remote, userId: A, familyId: FAMILY, memberRole: "owner", binding: null
      });
      for (const copy of plan.copies) {
        if (!h.remote.diaryEntries.some((entry) => entry.id === copy.id)) h.remote.diaryEntries.push(plain(copy));
      }
    }
    return {
      ok: h.postOK,
      async json() {
        await step("post:json");
        return h.responseTransform({ ok: true, familyId: FAMILY, personId: PERSON, targetCaseId: TARGET });
      }
    };
  };
  const component = load("apps/web/components/NotebookReconciliation.tsx", (name) => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name === "@/lib/browserSupabase") return { getBrowserSupabase: () => client };
    if (name === "@/lib/store") return store;
    if (name === "@/lib/notebookReconciliation") return helper;
    if (name === "@/lib/notebookReconciliationClient") return cloud;
    throw new Error(`Unexpected UI dependency: ${name}`);
  }, {
    fetch, Blob,
    URL: { createObjectURL(blob) { h.downloads.push(blob); return "blob:mock-reconciliation"; }, revokeObjectURL() {} },
    document: { createElement(name) { protocol(name === "a", "Only a mocked download link is permitted"); return { click() { h.events.push("download"); } }; } }
  }).NotebookReconciliation;
  h.render = (patch = {}) => {
    if (!h.active) return tree;
    // React props are immutable per render: do not mutate captured old props.
    h.props = { ...h.props, ...patch };
    let turns = 0;
    do {
      dirty = false; position = 0; pendingEffects = [];
      tree = component(h.props);
      const effects = pendingEffects;
      pendingEffects = [];
      for (const effect of effects) effect();
      assert.ok(++turns < 30, "mock React effects must settle");
    } while (dirty);
    return tree;
  };
  h.nodes = () => {
    h.render();
    const result = [];
    function visit(node) {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object") return;
      result.push(node); visit(node.props?.children);
    }
    visit(tree);
    return result;
  };
  h.button = (label) => h.nodes().find((node) => node.type === "button" && node.props.children === label);
  h.input = (type, index = 0) => h.nodes().filter((node) => node.type === "input" && node.props.type === type)[index];
  h.status = () => h.nodes().find((node) => node.props.role === "status")?.props.children ?? "";
  h.running = () => refs.find((item) => item.initialValue === false)?.ref.current === true;
  h.block = (label) => { const gate = deferred(); h.gates.set(label, gate); return gate; };
  h.until = async (condition, explanation) => {
    for (let i = 0; i < 1000; i++) {
      h.render();
      if (condition()) return;
      await nextTurn();
    }
    assert.fail(`UI operation did not settle: ${explanation}; events=${h.events.join(",")}`);
  };
  h.at = (gate) => h.until(() => gate.hit, "awaited gate");
  h.drain = async () => {
    await h.until(() => !h.running() && h.sessionInFlight === 0, "completion");
    assert.deepEqual(h.violations, []);
  };
  h.click = (label, { force = false, twice = false } = {}) => {
    const button = h.button(label);
    assert.ok(button, `Button exists: ${label}`);
    if (!force) assert.equal(Boolean(button.props.disabled), false, `Button enabled: ${label}`);
    button.props.onClick();
    if (twice) button.props.onClick();
    h.render();
  };
  h.preview = async () => { h.click(labels.preview); await h.drain(); };
  h.consent = () => {
    const same = h.input("radio");
    assert.ok(same, "same-person choice appears only after preview");
    same.props.onChange(); h.render();
    assert.ok(h.input("checkbox"), "separate acknowledgment is required");
    h.input("checkbox").props.onChange({ target: { checked: true } }); h.render();
  };
  h.ready = async () => { await h.preview(); h.consent(); };
  h.changeSession = (userId, emit = true) => {
    h.session = userId ? { user: { id: userId }, access_token: `mock-token-${userId === A ? "A" : "B"}` } : null;
    if (emit) for (const listener of h.listeners) listener("SIGNED_IN", h.session);
  };
  h.unmount = () => {
    h.active = false;
    for (const slot of slots) slot?.cleanup?.();
    assert.equal(h.listeners.size, 0, "auth listener unsubscribes on unmount");
  };
  h.render();
  return h;
}

let checks = 0;
async function test(name, run) {
  try { await run(); checks += 1; }
  catch (error) { throw new Error(`Notebook reconciliation UI: ${name}`, { cause: error }); }
}
function unchanged(h, original) {
  assert.deepEqual(h.local, original, "the source notebook is not replaced on failure");
  assert.equal(h.completions.length, 0);
}

await test("explicit preview/choice/acknowledgment and ordered append-only success", async () => {
  const h = harness();
  const original = plain(h.local);
  const originalRemote = plain(h.remote);
  assert.equal(h.button(labels.submit), undefined);
  await h.preview();
  assert.equal(h.posts.length, 0); assert.equal(h.archive, null);
  assert.equal(h.button(labels.submit).props.disabled, true);
  h.click(labels.submit, { force: true }); await h.drain();
  h.input("radio", 1).props.onChange(); h.render();
  assert.equal(h.input("checkbox"), undefined);
  h.click(labels.submit, { force: true }); await h.drain();
  h.input("radio").props.onChange(); h.render();
  assert.equal(h.button(labels.submit).props.disabled, true);
  h.click(labels.submit, { force: true }); await h.drain();
  assert.equal(h.posts.length, 0);
  h.consent(); h.click(labels.submit); await h.drain();
  assert.deepEqual(h.events, [
    "busy:true", "session:1", "read:1", "busy:false",
    "busy:true", "session:2", "read:2", "archive", "session:3", "post", "post:json", "read:3", "session:4", "install", "complete", "busy:false"
  ]);
  assert.equal(h.posts.length, 1); assert.equal(h.installs.length, 1); assert.equal(h.completions.length, 1);
  assert.deepEqual(Object.keys(h.posts[0]).sort(), ["diaryEntries", "familyId", "personId", "samePersonConfirmed", "sourceCaseId", "targetCaseId"]);
  assert.deepEqual(h.posts[0].diaryEntries, original.diaryEntries.map((entry) => ({ ...entry, updatedAt: entry.createdAt })));
  assert.equal(h.posts[0].diaryEntries.some((entry) => entry.id === "remote-existing-entry"), false);
  assert.deepEqual(h.local.cases, originalRemote.cases, "cloud profile and tasks remain the authority");
  assert.deepEqual(h.local.diaryEntries[0], originalRemote.diaryEntries[0]);
  assert.equal(h.local.diaryEntries.length, 2);
  assert.match(h.local.diaryEntries[1].id, /^reconciled_[0-9a-f]{64}$/);
  assert.deepEqual(h.archive.source, original);
  assert.equal(h.archive.destination.authUserId, A);
  assert.match(h.status(), /両方の日記を残しました/);
  h.unmount();
});

await test("synchronous double-clicks cannot start concurrent preview or append", async () => {
  const h = harness();
  const previewGate = h.block("read:1");
  h.click(labels.preview, { twice: true }); await h.at(previewGate);
  assert.equal(h.sessionCount, 1); assert.equal(h.readCount, 1);
  assert.equal(h.button(labels.preview).props.disabled, true);
  previewGate.resolve(); await h.drain(); h.consent();
  const postGate = h.block("post");
  h.click(labels.submit, { twice: true }); await h.at(postGate);
  for (const label of [labels.preview, labels.submit, labels.close]) assert.equal(h.button(label).props.disabled, true);
  assert.equal(h.nodes().find((node) => node.type === "fieldset").props.disabled, true);
  assert.equal(h.posts.length, 1);
  postGate.resolve(); await h.drain();
  assert.equal(h.installs.length, 1); assert.equal(h.completions.length, 1);
  assert.deepEqual(h.busyEvents, [true, false, true, false]);
  h.unmount();
});

const interruptions = {
  unmount: (h) => h.unmount(),
  auth_event: (h) => h.changeSession(B),
  sign_out: (h) => h.changeSession(null),
  props_account: (h) => h.render({ userId: B, email: "other-ui-test@example.test" }),
  props_family: (h) => h.render({ familyId: "different-family" }),
  draft_unavailable: (h) => h.render({ unavailable: true }),
  no_longer_eligible: (h) => h.render({ eligible: false })
};
for (const [stage, gateName, expectedPosts] of [
  ["preview", "read:1", 0], ["preflight", "read:2", 0], ["prePOST", "session:3", 0],
  ["POST", "post", 1], ["freshGET", "read:3", 1], ["preinstall", "session:4", 1]
]) {
  for (const [reason, interrupt] of Object.entries(interruptions)) {
    await test(`${reason} during ${stage} stops POST or installation`, async () => {
      const h = harness();
      const original = plain(h.local);
      if (stage !== "preview") await h.ready();
      const gate = h.block(gateName);
      h.click(stage === "preview" ? labels.preview : labels.submit);
      await h.at(gate); interrupt(h); gate.resolve(); await h.drain();
      assert.equal(h.posts.length, expectedPosts); assert.equal(h.installs.length, 0);
      unchanged(h, original);
      if (reason === "unmount") assert.equal(h.busyEvents.at(-1), true, "no parent callback after unmount");
      else h.unmount();
    });
  }
}

for (const [stage, gateName, posts] of [["prePOST", "session:3", 0], ["preinstall", "session:4", 1]]) {
  await test(`real session mismatch without auth event at ${stage}`, async () => {
    const h = harness(); const original = plain(h.local);
    await h.ready(); const gate = h.block(gateName);
    h.click(labels.submit); await h.at(gate);
    h.changeSession(B, false); gate.resolve(); await h.drain();
    assert.equal(h.posts.length, posts); assert.equal(h.installs.length, 0); unchanged(h, original);
    assert.match(h.status(), /本人確認/); h.unmount();
  });
}

await test("refreshing same-account access token uses the current token for POST", async () => {
  const h = harness(); await h.ready(); const gate = h.block("session:3");
  h.click(labels.submit); await h.at(gate);
  h.session.access_token = "mock-token-refreshed";
  for (const listener of h.listeners) listener("TOKEN_REFRESHED", h.session);
  gate.resolve(); await h.drain();
  assert.equal(h.completions.length, 1); h.unmount();
});

await test("persisted source change before POST preserves the changed source", async () => {
  const h = harness(); await h.ready(); const gate = h.block("session:3");
  h.click(labels.submit); await h.at(gate);
  h.local.diaryEntries[0].body = "別画面で保存した仮の変更";
  const changed = plain(h.local); gate.resolve(); await h.drain();
  assert.equal(h.posts.length, 0); assert.equal(h.installs.length, 0); unchanged(h, changed);
  assert.match(h.status(), /端末の記録が変わった/); h.unmount();
});

await test("persisted source change after POST cannot be installed over", async () => {
  const h = harness(); await h.ready(); const gate = h.block("session:4");
  h.click(labels.submit); await h.at(gate);
  h.local.diaryEntries[0].body = "保存後に別画面で変更した仮の記録";
  const changed = plain(h.local); gate.resolve(); await h.drain();
  assert.equal(h.posts.length, 1); assert.equal(h.installs.length, 1); unchanged(h, changed);
  assert.match(h.status(), /端末の切り替えが止まりました/); h.unmount();
});

for (const where of ["local", "remote"]) {
  await test(`${where} changes between preview and submit require a fresh preview`, async () => {
    const h = harness(); await h.ready(); h[where].diaryEntries[0].body += "変更";
    const original = plain(h.local); h.click(labels.submit); await h.drain();
    assert.equal(h.posts.length, 0); assert.equal(h.archive, null); unchanged(h, original);
    assert.equal(h.button(labels.submit), undefined); assert.match(h.status(), /確認後に記録が変わりました/);
    h.unmount();
  });
}

for (const [name, options, posts, installs, message] of [
  ["archive unavailable", { archiveOK: false }, 0, 0, /端末の控えを安全に保存できない/],
  ["HTTP failure with unknown commit", { postOK: false }, 1, 0, /追加の完了を確認できません/],
  ["mismatched response family", { responseTransform: (value) => ({ ...value, familyId: "other" }) }, 1, 0, /追加の完了を確認できません/],
  ["mismatched response person", { responseTransform: (value) => ({ ...value, personId: "other" }) }, 1, 0, /追加の完了を確認できません/],
  ["mismatched response case", { responseTransform: (value) => ({ ...value, targetCaseId: "other" }) }, 1, 0, /追加の完了を確認できません/],
  ["POST not present in fresh GET", { postCommits: false }, 1, 0, /両方の記録が残ったことを確認できません/],
  ["storage install failure", { installOK: false }, 1, 1, /端末の切り替えが止まりました/],
  ["old diary missing in fresh GET", { remoteReadTransform: (value, count) => count === 3 ? { ...value, diaryEntries: value.diaryEntries.filter((entry) => entry.id !== "remote-existing-entry") } : value }, 1, 0, /両方の記録が残ったことを確認できません/],
  ["target UUID replaced in fresh GET", { remoteReadTransform: (value, count) => count === 3 ? { ...value, cases: [{ ...value.cases[0], cloudPersonId: B }] } : value }, 1, 0, /両方の記録が残ったことを確認できません/]
]) {
  await test(name, async () => {
    const h = harness(options); const original = plain(h.local);
    await h.ready(); h.click(labels.submit); await h.drain();
    assert.equal(h.posts.length, posts); assert.equal(h.installs.length, installs); unchanged(h, original);
    assert.match(h.status(), message);
    if (posts) assert.deepEqual(h.archive.source, original);
    h.unmount();
  });
}

await test("retry after successful POST but lost response does not POST duplicates", async () => {
  const h = harness({ postOK: false }); const original = plain(h.local);
  await h.ready(); h.click(labels.submit); await h.drain(); unchanged(h, original);
  assert.equal(h.remote.diaryEntries.length, 2);
  const fixedId = h.remote.diaryEntries[1].id;
  h.postOK = true; await h.ready();
  assert.ok(h.nodes().some((node) => node.type === "p" && JSON.stringify(node.props.children).includes("重複させません")));
  h.click(labels.submit); await h.drain();
  assert.equal(h.posts.length, 1, "retry performs GET verification, not a second POST");
  assert.equal(h.local.diaryEntries.length, 2); assert.equal(h.local.diaryEntries[1].id, fixedId);
  assert.equal(h.completions.length, 1); h.unmount();
});

await test("retry refuses an already-copied diary whose content changed", async () => {
  const h = harness({ postOK: false }); const original = plain(h.local);
  await h.ready(); h.click(labels.submit); await h.drain();
  h.remote.diaryEntries[1].body = "あとから修正された仮の記録";
  await h.preview();
  assert.equal(h.posts.length, 1); assert.equal(h.installs.length, 0); unchanged(h, original);
  assert.match(h.status(), /以前まとめた記録の内容が異なっています/); h.unmount();
});

await test("legacy trimmed copy keeps both notebooks and offers inspection without retrying or overwriting", async () => {
  const h = harness(); let inspections = 0;
  h.render({ onOpenLocal: () => { inspections += 1; } });
  h.local.diaryEntries[0].body = "  仮の記録\r\n\n";
  const entry = h.local.diaryEntries[0];
  h.remote.diaryEntries.push({ ...entry,
    id: await helper.reconciledDiaryId(SOURCE, entry.id), caseId: TARGET,
    body: entry.body.trim(), cloudRevision: 1, cloudHash: "c".repeat(64)
  });
  const original = plain(h.local); const remote = plain(h.remote);
  await h.preview();
  assert.match(h.status(), /空白や改行の違い/);
  assert.match(h.status(), /両方の手帳は残っています/);
  assert.match(h.status(), /保存し直すだけで統合できるとは限りません/);
  assert.ok(h.nodes().some((node) => node.type === "a" && node.props.href === "/legal/privacy#contact"));
  const events = [...h.events];
  h.click("端末の記録を開く");
  assert.equal(inspections, 1); assert.deepEqual(h.events, events);
  assert.equal(h.posts.length, 0); assert.equal(h.installs.length, 0);
  unchanged(h, original); assert.deepEqual(h.remote, remote);
  h.render({ unavailable: true });
  assert.equal(h.button("端末の記録を開く").props.disabled, true);
  h.render({ userId: B, familyId: "other-family", eligible: false });
  assert.equal(h.button("端末の記録を開く"), undefined);
  assert.equal(h.status(), ""); h.unmount();
});

for (const kind of ["source-person", "source-diary", "saved-person", "saved-diary"]) {
  await test(`pending deletion of ${kind} stops reconciliation`, async () => {
    const h = harness(); const original = plain(h.local); await h.ready();
    const late = kind.startsWith("saved");
    const gate = late ? h.block("read:3") : null;
    if (late) { h.click(labels.submit); await h.at(gate); }
    if (kind === "source-person") h.blockedPeople.add(SOURCE);
    if (kind === "source-diary") h.blockedDiaries.add(`${SOURCE}:source-entry`);
    if (kind === "saved-person") h.blockedPeople.add(TARGET);
    if (kind === "saved-diary") h.blockedDiaries.add(`${TARGET}:remote-existing-entry`);
    if (late) gate.resolve(); else h.click(labels.submit);
    await h.drain(); assert.equal(h.posts.length, late ? 1 : 0); assert.equal(h.installs.length, 0);
    unchanged(h, original); assert.match(h.status(), /削除確認中/); h.unmount();
  });
}

await test("unavailable UI cannot preview or submit even via a stale click", async () => {
  const h = harness(); h.render({ unavailable: true });
  assert.equal(h.button(labels.preview).props.disabled, true);
  h.click(labels.preview, { force: true }); await h.drain(); assert.equal(h.sessionCount, 0);
  h.render({ unavailable: false }); await h.ready(); h.render({ unavailable: true });
  assert.equal(h.button(labels.submit).props.disabled, true);
  h.click(labels.submit, { force: true }); await h.drain(); assert.equal(h.posts.length, 0);
  h.unmount();
});

await test("archive button is scoped to its account and rechecks on click", async () => {
  const h = harness({ installOK: false }); await h.ready(); h.click(labels.submit); await h.drain();
  assert.ok(h.button(labels.archive));
  h.click(labels.archive); await h.drain(); assert.equal(h.downloads.length, 1);
  h.archive.destination.authUserId = B;
  h.click(labels.archive); await h.drain(); assert.equal(h.downloads.length, 1, "stale button must not download another account's source");
  h.render({ userId: B, familyId: "other-family", eligible: false });
  assert.equal(h.button(labels.archive), undefined); assert.equal(h.button(labels.submit), undefined);
  assert.equal(h.nodes()[0].props.hidden, true); h.unmount();
});

await test("preview download rechecks session and exports only the unchanged original", async () => {
  const h = harness(); const original = plain(h.local); await h.preview();
  h.click(labels.source); await h.drain();
  assert.equal(h.sessionCount, 2, "every download independently verifies the actual session");
  assert.equal(h.downloads.length, 1);
  assert.deepEqual(JSON.parse(await h.downloads[0].text()), original);
  assert.equal(h.posts.length, 0); assert.equal(h.installs.length, 0); h.unmount();
});

const beforeDownloadChanges = {
  source_deleted: (h) => h.blockedPeople.add(SOURCE),
  target_deleted: (h) => h.blockedPeople.add(TARGET),
  source_diary_deleted: (h) => h.blockedDiaries.add(`${SOURCE}:source-entry`),
  target_diary_deleted: (h) => h.blockedDiaries.add(`${TARGET}:remote-existing-entry`),
  source_changed: (h) => { h.local.diaryEntries[0].body = "別タブで編集済みの仮の記録"; },
  source_removed: (h) => { h.local.diaryEntries = []; },
  auth_changed_without_event: (h) => h.changeSession(B, false),
  signed_out_without_event: (h) => h.changeSession(null, false)
};
for (const [reason, change] of Object.entries(beforeDownloadChanges)) {
  await test(`preview download refuses ${reason}`, async () => {
    const h = harness(); await h.preview(); change(h);
    h.click(labels.source); await h.drain();
    assert.equal(h.downloads.length, 0); assert.equal(h.posts.length, 0); assert.equal(h.installs.length, 0);
    h.unmount();
  });
}

for (const [reason, change] of Object.entries({
  auth_changed: (h) => h.changeSession(B),
  unmounted: (h) => h.unmount(),
  source_deleted: beforeDownloadChanges.source_deleted,
  target_deleted: beforeDownloadChanges.target_deleted,
  source_changed: beforeDownloadChanges.source_changed,
  account_props_changed: (h) => h.render({ userId: B }),
  family_props_changed: (h) => h.render({ familyId: "other-family" })
})) {
  for (const mode of ["preview", "archive"]) {
    // An archive is intentionally a historical snapshot: newer local edits
    // must not prevent downloading that explicitly labeled original backup.
    if (mode === "archive" && reason === "source_changed") continue;
    await test(`${mode} download stops ${reason} while session verification awaits`, async () => {
      const h = harness();
      if (mode === "preview") await h.preview();
      else {
        await h.ready(); h.click(labels.submit); await h.drain();
        h.render({ eligible: false });
      }
      const gate = h.block(`session:${h.sessionCount + 1}`);
      h.click(mode === "preview" ? labels.source : labels.archive); await h.at(gate);
      change(h); gate.resolve(); await h.drain();
      assert.equal(h.downloads.length, 0);
      if (h.active) h.unmount();
    });
  }
}

await test("completed archive downloads remain available to their verified owner", async () => {
  const h = harness(); const original = plain(h.local);
  await h.ready(); h.click(labels.submit); await h.drain(); h.render({ eligible: false });
  h.click(labels.archive); await h.drain();
  assert.equal(h.downloads.length, 1);
  assert.deepEqual(JSON.parse(await h.downloads[0].text()), original);
  assert.equal(h.local.cases[0].id, TARGET, "downloading never restores the backup");
  h.unmount();
});

console.log(`Notebook reconciliation UI runtime: ${checks} scenarios passed (mock React/Auth/storage/HTTP; no external calls).`);
