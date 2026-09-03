import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const storeSource = fs.readFileSync(path.join(repoRoot, "apps/web/lib/store.ts"), "utf8");
const compiledStore = ts.transpileModule(storeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  }
}).outputText;

function memoryStorage({ failNotebookWrites = false } = {}) {
  const values = new Map();
  let shouldFailNotebookWrites = failNotebookWrites;
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (shouldFailNotebookWrites && key.startsWith("oyano_")) throw new DOMException("quota", "QuotaExceededError");
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    setFailNotebookWrites(value) {
      shouldFailNotebookWrites = Boolean(value);
    }
  };
}

function loadStore(storage = memoryStorage()) {
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    window: { localStorage: storage },
    crypto: webcrypto,
    DOMException,
    Date,
    Math,
    JSON,
    console,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  const requireStub = (specifier) => {
    if (specifier === "@/lib/funnel") return { trackFunnel() {} };
    if (specifier === "@/lib/date") return { japanDateInputValue: () => "2026-09-01" };
    if (specifier === "@oyano/shared") {
      return {
        buildDiagnosisResult: () => ({ summary: "", tasks: [] }),
        canCreateNotebook: () => true,
        createHandoffToken: (id) => `handoff-${id}`,
        NOTEBOOK_LIMIT_MESSAGE: "limit",
        SENSITIVE_INFO_CONSENT_VERSION: "test",
        statusLabel: () => "準備"
      };
    }
    throw new Error(`unexpected require: ${specifier}`);
  };
  vm.runInNewContext(`(function(require,module,exports){${compiledStore}\n})(require,module,exports);`, {
    ...sandbox,
    require: requireStub
  });
  return module.exports;
}

function sampleCase(overrides = {}) {
  return {
    id: "case-a",
    selectedStatus: "preparing",
    answers: { selectedStatus: "preparing" },
    personProfile: { displayName: "母", relationship: "母", updatedAt: "2026-09-01T00:00:00.000Z" },
    status: "result_ready",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    result: { summary: "準備", tasks: [] },
    supportPackStatus: "none",
    ...overrides
  };
}

{
  const store = loadStore();
  const binding = { version: 1, authUserId: "user-a", familyId: "family-a" };
  assert.equal(store.notebookCloudBindingMatches(binding, "user-a", "family-a"), true);
  assert.equal(store.notebookCloudBindingMatches(binding, "user-b", "family-a"), false);
  assert.equal(store.notebookCloudBindingMatches(binding, "user-a", "family-b"), false);
}

{
  const store = loadStore();
  const initial = sampleCase();
  store.overwriteLocalNotebook({ cases: [initial], diaryEntries: [] });
  store.addDiaryEntry({
    caseId: initial.id,
    date: "2026-09-01",
    mood: "stable",
    body: "水分を取れた",
    attachments: []
  });
  assert.equal(store.getLocalCase(initial.id).updatedAt, initial.updatedAt, "diary writes must not acquire profile authority");
}

{
  const store = loadStore();
  const local = sampleCase({
    cloudRevision: 1,
    cloudHash: "a".repeat(64),
    cloudSyncedUpdatedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    personProfile: { displayName: "母", relationship: "母", careStatus: "端末で変更" }
  });
  const remote = sampleCase({
    cloudRevision: 2,
    cloudHash: "b".repeat(64),
    cloudSyncedUpdatedAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    personProfile: { displayName: "母", relationship: "母", careStatus: "別端末で変更" }
  });
  store.overwriteLocalNotebook({ cases: [local], diaryEntries: [] });
  const merged = store.replaceLocalNotebook({ cases: [remote], diaryEntries: [] });
  assert.equal(merged.conflicts.some((item) => item.kind === "profile"), true);
  assert.equal(merged.cases[0].personProfile.careStatus, "端末で変更", "conflict must not overwrite local content");
}

{
  const store = loadStore();
  const legacy = sampleCase();
  const remote = sampleCase({
    cloudPersonId: "00000000-0000-4000-8000-000000000001",
    cloudRevision: 1,
    cloudHash: "c".repeat(64),
    cloudSyncedUpdatedAt: "2026-09-01T00:00:00.000Z"
  });
  assert.equal(store.canAdoptNotebookCloudIdentity({ remoteCases: [remote], localCases: [legacy] }), true);
  store.overwriteLocalNotebook({ cases: [legacy], diaryEntries: [] });
  const merged = store.replaceLocalNotebook({ cases: [remote], diaryEntries: [] });
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.cases[0].cloudRevision, 1);
}

{
  const store = loadStore(memoryStorage({ failNotebookWrites: true }));
  const restored = store.overwriteLocalNotebook({ cases: [sampleCase()], diaryEntries: [] });
  assert.equal(restored.persisted, false, "quota failures must be reported, never shown as a durable restore");
}

{
  const store = loadStore(memoryStorage({ failNotebookWrites: true }));
  const result = store.addDiaryEntryWithStatus({
    caseId: "case-a",
    date: "2026-09-01",
    mood: "stable",
    body: "まだ保存できない記録",
    attachments: []
  });
  assert.equal(result.persisted, false, "diary save must expose storage failure to the UI");
  assert.equal(store.listDiaryEntries("case-a").length, 0, "failed diary writes must not remain as false saved entries");
  assert.match(store.consumeNotebookStorageWarning() ?? "", /保存容量/, "failed diary writes must retain a visible warning");
}

{
  const storage = memoryStorage();
  const store = loadStore(storage);
  store.overwriteLocalNotebook({ cases: [sampleCase()], diaryEntries: [] });
  storage.setFailNotebookWrites(true);
  const result = store.updateCaseProfileWithStatus("case-a", { documentLocationNote: "白い棚" });
  assert.equal(result.persisted, false, "profile save must expose storage failure to the UI");
  assert.equal(store.getLocalCase("case-a")?.personProfile?.documentLocationNote, undefined, "failed profile writes must not remain as false saved data");
  assert.match(store.consumeNotebookStorageWarning() ?? "", /保存容量/, "failed profile writes must retain a visible warning");
}

{
  const store = loadStore();
  store.overwriteLocalNotebook({
    cases: [sampleCase()],
    diaryEntries: [{
      id: "diary-a",
      caseId: "case-a",
      date: "2026-09-01",
      mood: "stable",
      body: "記録",
      attachments: [],
      createdAt: "2026-09-01T01:00:00.000Z",
      updatedAt: "2026-09-01T01:00:00.000Z"
    }]
  });
  const applied = store.applyNotebookCloudRevisions({
    caseRevisions: [{ localCaseId: "case-a", personId: "00000000-0000-4000-8000-000000000001", cloudRevision: 1, cloudHash: "d".repeat(64) }],
    diaryRevisions: [{ localCaseId: "case-a", localDiaryId: "diary-a", cloudRevision: 1, cloudHash: "e".repeat(64) }]
  });
  assert.equal(applied.persisted, true);
  assert.equal(applied.cases[0].cloudRevision, 1);
  assert.equal(applied.diaryEntries[0].cloudRevision, 1);
}

{
  const store = loadStore();
  const sentCase = sampleCase({
    cloudRevision: 1,
    cloudHash: "f".repeat(64),
    cloudSyncedUpdatedAt: "2026-09-01T00:00:00.000Z"
  });
  store.overwriteLocalNotebook({ cases: [sentCase], diaryEntries: [] });
  const edited = store.updateCaseProfile("case-a", { careStatus: "保存中に端末で追記" });
  const applied = store.applyNotebookCloudRevisions({
    caseRevisions: [{
      localCaseId: "case-a",
      personId: "00000000-0000-4000-8000-000000000001",
      cloudRevision: 2,
      cloudHash: "1".repeat(64),
      profileApplied: true
    }]
  }, { cases: [sentCase], diaryEntries: [] });
  assert.equal(applied.hasConcurrentChanges, true, "an edit made while a request is in flight must stay dirty");
  assert.equal(applied.cases[0].personProfile.careStatus, "保存中に端末で追記");
  assert.notEqual(
    applied.cases[0].cloudSyncedUpdatedAt,
    edited.updatedAt,
    "an unsent edit must never receive the saved marker"
  );
  assert.equal(applied.cases[0].cloudRevision, 2, "the next retry must use the new server revision as its base");
}

{
  const store = loadStore();
  const sentCase = sampleCase({ cloudRevision: 3, cloudHash: "2".repeat(64) });
  store.overwriteLocalNotebook({ cases: [sentCase], diaryEntries: [] });
  const applied = store.applyNotebookCloudRevisions({
    caseRevisions: [{
      localCaseId: "case-a",
      personId: "00000000-0000-4000-8000-000000000001",
      cloudRevision: 3,
      cloudHash: "2".repeat(64),
      profileApplied: false
    }]
  }, { cases: [sentCase], diaryEntries: [] });
  assert.deepEqual([...applied.rejectedProfileCaseIds], ["case-a"]);
  assert.equal(applied.cases[0].cloudSyncedUpdatedAt, sentCase.cloudSyncedUpdatedAt);
}

console.log("notebook sync runtime checks: ok");
