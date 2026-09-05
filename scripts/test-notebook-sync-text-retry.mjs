import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Execute the actual home sync function, autosync effect/dependencies and store
// revision handling. Auth, HTTP and browser timers/storage are synthetic only.
// This does not execute React, a server route, SQL, network or real storage.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("apps/web/app/home/page.tsx");
const ast = ts.createSourceFile("home.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
visit(ast);
function functionSource(name) {
  const found = nodes.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(found.length, 1, `exactly one real function ${name} must exist`);
  return found[0].getText(ast);
}
const constants = ["NOTEBOOK_CLOUD_SYNC_BATCH_SIZE", "NOTEBOOK_CLOUD_SYNC_RETRY_DELAYS"].map((name) => {
  const found = nodes.filter((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === name);
  assert.equal(found.length, 1, `real constant ${name} must exist`);
  return `const ${found[0].getText(ast)};`;
});
const autoEffects = nodes.filter((node) => ts.isCallExpression(node)
  && node.expression.getText(ast) === "useEffect"
  && node.arguments[0]?.getText(ast).includes("const signature = notebookPayloadSignature(payload);")
  && node.arguments[0]?.getText(ast).includes("autoSyncTimerRef.current = window.setTimeout"));
assert.equal(autoEffects.length, 1, "extract the actual autosync effect and its actual dependencies");
assert.ok(ts.isArrayLiteralExpression(autoEffects[0].arguments[1]));
const syncSource = [
  ...constants,
  ...["notebookPayloadSignature", "attachmentForNotebookSync", "diaryEntryForNotebookSync",
    "diaryEntriesForNotebookSync", "diaryEntriesAllowedForCloudSync", "allDiaryEntriesForSync",
    "notebookSyncPayload", "syncNotebookToCloud"].map(functionSource),
  `export const runAutoSyncEffect = ${autoEffects[0].arguments[0].getText(ast)};`,
  `export function autoSyncDependencies() { return ${autoEffects[0].arguments[1].getText(ast)}; }`,
  "export { syncNotebookToCloud, notebookSyncPayload, notebookPayloadSignature, NOTEBOOK_CLOUD_SYNC_RETRY_DELAYS };"
].join("\n");

function evaluate(code, sandbox) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  sandbox.module = module;
  sandbox.exports = module.exports;
  vm.runInNewContext(compiled, sandbox);
  return module.exports;
}

const caseId = "synthetic-case";
const familyId = "synthetic-family";
const userId = "synthetic-user";
const email = "sync-retry@example.test";
const createdAt = "2026-09-05T00:00:00.000Z";
const originalBody = "\r\n  仮の同期記録🙂\n二行目の本文\n\n";
const ref = (current) => ({ current });

function scenario(status) {
  const storage = new Map();
  const store = evaluate(read("apps/web/lib/store.ts"), {
    window: { localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    } },
    crypto: webcrypto, Date, DOMException,
    require(name) {
      if (name === "@/lib/funnel") return { trackFunnel() {} };
      if (name === "@/lib/date") return { japanDateInputValue: () => "2026-09-05" };
      if (name === "@/lib/caseOwnership") return { ANONYMOUS_CASE_TOKEN_PATTERN: /^anon_[a-f0-9]{64}$/i };
      if (name === "@oyano/shared") return {
        buildDiagnosisResult: () => ({ summary: "", tasks: [] }), canCreateNotebook: () => true,
        createHandoffToken: () => "synthetic-handoff", NOTEBOOK_LIMIT_MESSAGE: "limit",
        SENSITIVE_INFO_CONSENT_VERSION: "test", statusLabel: () => "準備"
      };
      throw new Error(`Unexpected store dependency: ${name}`);
    }
  });
  const seeded = store.overwriteLocalNotebook({
    cases: [{ id: caseId, selectedStatus: "preparing", answers: { selectedStatus: "preparing" },
      personProfile: { displayName: "仮の対象者" }, status: "result_ready", createdAt,
      updatedAt: createdAt, result: { summary: "仮の手帳", tasks: [] }, supportPackStatus: "none" }],
    diaryEntries: [{ id: "synthetic-diary", caseId, date: "2026-09-05", mood: "stable",
      body: originalBody, attachments: [], createdAt, updatedAt: createdAt,
      cloudRevision: 1, cloudHash: "a".repeat(64) }]
  });
  assert.equal(seeded.persisted, true);
  assert.equal(store.writeNotebookCloudBinding({ version: 1, authUserId: userId, familyId, email }), true);
  const timers = new Map();
  const scheduledDelays = [];
  const requests = [];
  const appliedRevisions = [];
  const messages = [];
  let timerId = 0;
  let requestId = 0;
  let tokenCalls = 0;
  let effectRuns = 0;
  let effectDependencies;
  let effectCleanup;
  const context = {
    ...store, Date, console,
    loaded: true, reconciliationBusy: false,
    cloudUserId: userId, cloudUserEmail: email, cloudFamilyId: familyId, cloudIdentityStatus: "ready",
    cases: store.listLocalCases(), diaryEntries: { [caseId]: store.listDiaryEntries(caseId) },
    cloudAuthGenerationRef: ref(1), diaryCloudDeletionInFlightRef: ref(false),
    personNotebookDeletionInFlightRef: ref(false), pendingAutoSyncPayloadRef: ref(null),
    cloudSyncRetryTimerRef: ref(null), cloudSyncRetrySignatureRef: ref(""),
    cloudSyncRetryCountRef: ref(0), cloudSyncInFlightRef: ref(false), lastSyncedPayloadRef: ref(""),
    firstCloudLoadDoneRef: ref(true), cloudRestoringRef: ref(false), autoSyncTimerRef: ref(null),
    blockedCloudDiarySyncKeysRef: ref(new Set()), blockedCloudCaseSyncIdsRef: ref(new Set()),
    window: {
      setTimeout(callback, delay) {
        const id = ++timerId;
        timers.set(id, callback);
        scheduledDelays.push(delay);
        return id;
      },
      clearTimeout(id) { timers.delete(id); }
    },
    getAccessToken: async () => { tokenCalls++; return "synthetic-token"; },
    createLocalId: () => `synthetic-request-${++requestId}`,
    setCloudAutoStatus: (value) => { context.cloudAutoStatus = value; },
    setCloudStatus: (value) => { context.cloudStatus = value; },
    setCloudIdentityStatus: (value) => { context.cloudIdentityStatus = value; },
    setCloudFamilyId: (value) => { context.cloudFamilyId = value; },
    setCloudMemberRole: (value) => { context.cloudMemberRole = value; },
    setLastCloudSyncedAt: (value) => { context.lastCloudSyncedAt = value; },
    setCloudMessage: (value) => { messages.push(value); },
    applyFamilyBillingState() {}, markMonitorActivity() {},
    applyNotebookCloudRevisions(result, payload) {
      const applied = store.applyNotebookCloudRevisions(result, payload);
      appliedRevisions.push(applied);
      return applied;
    },
    reloadNotebookState(cases, diaryEntries) {
      context.cases = cases;
      context.diaryEntries = Object.fromEntries(cases.map((record) => [record.id,
        diaryEntries.filter((entry) => entry.caseId === record.id)]));
    },
    async fetch(url, options) {
      assert.equal(url, "/api/notebook/sync", "only the mocked sync endpoint is allowed");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer synthetic-token");
      const payload = JSON.parse(options.body);
      assert.equal(payload.familyId, familyId);
      assert.equal(payload.createFamily, false);
      assert.equal(payload.diaryEntries[0].body, originalBody, "every request preserves the original whitespace and Unicode");
      requests.push(payload);
      // Model a second save request queued while this first request is in flight.
      // Both success and conflict must drain it without repeating identical text.
      if (requests.length === 1 && status !== 503) {
        context.pendingAutoSyncPayloadRef.current = runtime.notebookSyncPayload();
      }
      if (status === 409) {
        const oldCloudBody = originalBody.trim();
        assert.notEqual(payload.diaryEntries[0].body, oldCloudBody);
        return { ok: false, status, json: async () => ({ error: "notebook_conflict", message: "仮の本文競合" }) };
      }
      if (status === 503) return { ok: false, status, json: async () => ({ error: "temporary_failure" }) };
      assert.equal(status, 200);
      return { ok: true, status, json: async () => ({
        familyId, memberRole: "owner", plan: "free", syncedEntries: 1, syncedPeople: 1,
        caseRevisions: [{ localCaseId: caseId, personId: "synthetic-person", cloudRevision: 2, cloudHash: "b".repeat(64) }],
        taskRevisions: [],
        diaryRevisions: [{ localCaseId: caseId, localDiaryId: "synthetic-diary", cloudRevision: 2, cloudHash: "c".repeat(64) }]
      }) };
    }
  };
  const runtime = evaluate(syncSource, context);
  function render() {
    const dependencies = runtime.autoSyncDependencies();
    if (effectDependencies && dependencies.every((item, index) => Object.is(item, effectDependencies[index]))) return;
    effectCleanup?.();
    effectDependencies = [...dependencies];
    effectRuns++;
    effectCleanup = runtime.runAutoSyncEffect();
  }
  async function drain() {
    for (let i = 0; timers.size > 0; i++) {
      assert.ok(i < 10, "autosync/retry timers must terminate; an endless retry fails this test");
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
      // All async work uses already-resolved mocks. One event-loop turn flushes
      // their promises; no timer delay, real HTTP or user filesystem is used.
      await setImmediate();
      assert.equal(context.cloudSyncInFlightRef.current, false);
      render();
    }
  }
  return { context, runtime, store, requests, timers, scheduledDelays, appliedRevisions, messages,
    render, drain, tokenCalls: () => tokenCalls, effectRuns: () => effectRuns };
}

for (const status of [200, 409, 503]) {
  const test = scenario(status);
  const initialSignature = test.runtime.notebookPayloadSignature(test.runtime.notebookSyncPayload());
  test.render();
  assert.equal(test.timers.size, 1, "an unsaved payload schedules the actual autosync effect");
  await test.drain();
  assert.equal(test.store.listDiaryEntries(caseId)[0].body, originalBody, "no outcome rewrites local text");
  assert.equal(test.context.pendingAutoSyncPayloadRef.current, null);
  assert.equal(test.context.cloudSyncRetryTimerRef.current, null);
  assert.equal(test.context.autoSyncTimerRef.current, null);
  if (status === 200) {
    assert.equal(test.requests.length, 1, "a successful save must not resend the same text");
    assert.equal(test.context.cloudStatus, "synced");
    assert.equal(test.appliedRevisions.length, 1);
    assert.equal(test.appliedRevisions[0].hasConcurrentChanges, false);
    assert.equal(test.store.listDiaryEntries(caseId)[0].cloudRevision, 2);
    const savedSignature = test.runtime.notebookPayloadSignature(test.runtime.notebookSyncPayload());
    assert.notEqual(savedSignature, initialSignature, "server revisions must actually change the saved payload signature");
    assert.equal(test.context.lastSyncedPayloadRef.current, savedSignature);
    assert.equal(test.effectRuns(), 2, "revision application reruns the effect using the updated payload");
    assert.deepEqual(test.scheduledDelays, [1200], "neither the pending duplicate nor effect rerender schedules a resend");
    // Also run the callback explicitly with unchanged data to exercise its
    // signature guard independently of React's dependency comparison.
    test.runtime.runAutoSyncEffect();
    assert.equal(test.timers.size, 0);
  } else if (status === 409) {
    assert.equal(test.requests.length, 1, "a conflict is terminal even with an identical pending save");
    assert.equal(test.context.cloudStatus, "error");
    assert.equal(test.appliedRevisions.length, 0, "conflicts do not apply revisions or mark the original text saved");
    assert.equal(test.context.lastSyncedPayloadRef.current, "");
    assert.equal(test.context.cloudSyncRetryCountRef.current, 0);
    assert.equal(test.effectRuns(), 1, "error/status updates do not change the actual autosync dependencies");
    assert.deepEqual(test.scheduledDelays, [1200]);
    assert.equal(test.messages.at(-1), "仮の本文競合");
  } else {
    const delays = [...test.runtime.NOTEBOOK_CLOUD_SYNC_RETRY_DELAYS];
    assert.deepEqual(delays, [1000, 3000, 10000], "retain the existing bounded retry policy");
    assert.equal(test.requests.length, 1 + delays.length, "503 stops after the initial call and the existing three retries");
    assert.deepEqual(test.scheduledDelays, [1200, ...delays]);
    assert.equal(test.context.cloudSyncRetryCountRef.current, delays.length);
    assert.equal(test.appliedRevisions.length, 0);
    assert.equal(test.context.lastSyncedPayloadRef.current, "");
    assert.match(test.messages.at(-1), /複数回試しましたが完了しませんでした/);
  }
  const finalCount = test.requests.length;
  for (let i = 0; i < 3; i++) test.render();
  await test.drain();
  assert.equal(test.requests.length, finalCount, "stable state rerenders must not restart terminated work");
  assert.equal(test.tokenCalls(), finalCount, "each mock request goes through the token boundary");
}

console.log("Notebook sync text retry: ok (200 saved-signature stop, 409 conflict stop, 503 three-retry cap; actual AST/store, fake HTTP/timers/storage only)");
