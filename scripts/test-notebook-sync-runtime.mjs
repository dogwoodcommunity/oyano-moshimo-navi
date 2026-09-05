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

function loadStore(storage = memoryStorage(), StoreDate = Date) {
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    window: { localStorage: storage },
    crypto: webcrypto,
    DOMException,
    Date: StoreDate,
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
    if (specifier === "@/lib/caseOwnership") {
      return { ANONYMOUS_CASE_TOKEN_PATTERN: /^anon_[a-f0-9]{64}$/i };
    }
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
  store.overwriteLocalNotebook({
    cases: [sampleCase()],
    diaryEntries: [{
      id: "diary-edit-failure",
      caseId: "case-a",
      date: "2026-09-01",
      mood: "stable",
      body: "保存済みの記録",
      attachments: [],
      createdAt: "2026-09-01T01:00:00.000Z",
      updatedAt: "2026-09-01T01:00:00.000Z"
    }]
  });
  storage.setFailNotebookWrites(true);
  const result = store.updateDiaryEntry("diary-edit-failure", { body: "保存できない変更" });
  assert.equal(result?.persisted, false, "diary edits must expose storage failure to the UI");
  assert.equal(
    store.listDiaryEntries("case-a")[0]?.body,
    "保存済みの記録",
    "failed diary edits must roll back the in-memory change instead of looking saved"
  );
  assert.match(store.consumeNotebookStorageWarning() ?? "", /保存容量/, "failed diary edits must retain a visible warning");
}

{
  const store = loadStore();
  store.overwriteLocalNotebook({
    cases: [sampleCase()],
    diaryEntries: [{
      id: "diary-edit-success",
      caseId: "case-a",
      date: "2026-09-01",
      mood: "stable",
      body: "変更前",
      attachments: [],
      createdAt: "2026-09-01T01:00:00.000Z",
      updatedAt: "2026-09-01T01:00:00.000Z"
    }]
  });
  const result = store.updateDiaryEntry("diary-edit-success", { body: "変更後", mood: "changed" });
  assert.equal(result?.persisted, true, "successful diary edits must report durable storage");
  assert.equal(result?.entry.body, "変更後");
  assert.equal(store.listDiaryEntries("case-a")[0]?.mood, "changed");
}

{
  const store = loadStore();
  store.overwriteLocalNotebook({
    cases: [sampleCase(), sampleCase({ id: "case-b" })],
    diaryEntries: [
      {
        id: "diary-delete-success",
        caseId: "case-a",
        date: "2026-09-01",
        mood: "stable",
        body: "削除する記録",
        attachments: [],
        createdAt: "2026-09-01T01:00:00.000Z",
        updatedAt: "2026-09-01T01:00:00.000Z",
        cloudRevision: 2,
        cloudHash: "a".repeat(64)
      },
      {
        id: "diary-delete-success",
        caseId: "case-b",
        date: "2026-09-02",
        mood: "stable",
        body: "別の対象者の同名ID",
        attachments: [],
        createdAt: "2026-09-02T01:00:00.000Z",
        updatedAt: "2026-09-02T01:00:00.000Z"
      }
    ]
  });
  const result = store.deleteDiaryEntryWithStatus({ caseId: "case-a", entryId: "diary-delete-success" });
  assert.equal(result.persisted, true, "diary deletion must be persisted before the UI removes the card");
  assert.equal(result.deleted, true);
  assert.equal(store.listDiaryEntries("case-a").length, 0);
  assert.equal(store.listDiaryEntries("case-b").length, 1, "case identity must scope local diary deletion");
  const restored = store.replaceLocalNotebook({ cases: [sampleCase()], diaryEntries: [] });
  assert.equal(restored.diaryEntries.some((entry) => entry.caseId === "case-a"), false, "a persisted local deletion must not reappear on the next restore merge");
}

{
  const storage = memoryStorage();
  const store = loadStore(storage);
  store.overwriteLocalNotebook({
    cases: [sampleCase()],
    diaryEntries: [{
      id: "diary-delete-failure",
      caseId: "case-a",
      date: "2026-09-01",
      mood: "stable",
      body: "削除に失敗する記録",
      attachments: [],
      createdAt: "2026-09-01T01:00:00.000Z",
      updatedAt: "2026-09-01T01:00:00.000Z"
    }]
  });
  storage.setFailNotebookWrites(true);
  const result = store.deleteDiaryEntryWithStatus({ caseId: "case-a", entryId: "diary-delete-failure" });
  assert.equal(result.persisted, false, "failed local deletion must be reported");
  assert.equal(result.deleted, false);
  assert.equal(store.listDiaryEntries("case-a").length, 1, "failed deletion must keep the local record for retry");
  assert.match(store.consumeNotebookStorageWarning() ?? "", /保存容量/);
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

{
  // Independent browser stores, with serialized snapshots standing in for the
  // already-verified server response. This checks client restore/merge behavior,
  // not live Auth, HTTP, Storage download, or real-device browser acceptance.
  let clock = Date.parse("2026-09-03T00:00:00.000Z");
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const deviceA = loadStore(memoryStorage(), TestDate);
  const deviceB = loadStore(memoryStorage(), TestDate);
  const initialDate = "2026-09-01T00:00:00.000Z";
  const cloudCase = sampleCase({
    cloudRevision: 1,
    cloudHash: "3".repeat(64),
    cloudSyncedUpdatedAt: initialDate,
    result: {
      summary: "準備",
      tasks: [{
        id: "task-two-stores", title: "書類の置き場所を確認", progress: "todo",
        status: "preparing", description: "仮の保管場所を記録する", defaultDueOffsetDays: 1,
        priority: 2, category: "documents", dueDate: "2026-09-02",
        updatedAt: initialDate, cloudSyncedUpdatedAt: initialDate,
        cloudRevision: 1, cloudHash: "4".repeat(64)
      }]
    }
  });
  const snapshot = {
    cases: [cloudCase],
    diaryEntries: [1, 2].map((number) => ({
      id: `diary-two-stores-${number}`, caseId: "case-a", date: `2026-09-0${number}`,
      mood: number === 1 ? "stable" : "changed", body: `端末間確認の記録${number}`,
      createdAt: initialDate, updatedAt: initialDate, cloudSyncedUpdatedAt: initialDate,
      cloudRevision: 1, cloudHash: String(number + 4).repeat(64),
      attachments: number === 1 ? [{
        id: "photo-two-stores", name: "test-fixture.jpg", type: "image/jpeg", size: 128,
        uploadStatus: "uploaded", uploadedAt: initialDate,
        storageBucket: "home-photos", storagePath: "fixture-family/notebook/fixture-photo.jpg"
      }] : []
    }))
  };
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const exported = (store) => copy({ cases: [store.getLocalCase("case-a")], diaryEntries: store.listDiaryEntries("case-a") });
  assert.equal(deviceA.replaceLocalNotebook(copy(snapshot)).persisted, true);
  assert.equal(deviceB.replaceLocalNotebook(copy(snapshot)).persisted, true);
  assert.deepEqual(exported(deviceB), exported(deviceA), "fresh second store must restore dates, bodies, tasks and photo references");

  deviceA.updateDiaryEntry("diary-two-stores-1", { body: "端末Aで追記した内容" });
  assert.equal(deviceB.listDiaryEntries("case-a").find((entry) => entry.id === "diary-two-stores-1").body,
    "端末間確認の記録1", "two independent stores must not accidentally share local memory");
  deviceA.applyNotebookCloudRevisions({ diaryRevisions: [{
    localCaseId: "case-a", localDiaryId: "diary-two-stores-1", cloudRevision: 2, cloudHash: "7".repeat(64)
  }] }, exported(deviceA));
  const latest = exported(deviceA);
  for (let round = 0; round < 3; round += 1) {
    const restored = deviceB.replaceLocalNotebook(copy(latest));
    assert.equal(restored.persisted, true);
    assert.equal(restored.conflicts.length, 0);
    assert.equal(restored.diaryEntries.length, 2, "repeat restores must not multiply records");
    assert.equal(restored.cases[0].result.tasks.length, 1, "repeat restores must not multiply checklist entries");
    assert.equal(restored.diaryEntries.find((entry) => entry.id === "diary-two-stores-1").attachments[0].storagePath,
      "fixture-family/notebook/fixture-photo.jpg", "serialized restore must preserve the photo reference");
  }
  assert.deepEqual(exported(deviceB), latest, "a saved A change must be visible after B restores");

  clock += 60_000;
  deviceB.updateDiaryEntry("diary-two-stores-1", { body: "端末Bの未送信の内容" });
  clock += 60_000;
  deviceA.updateDiaryEntry("diary-two-stores-1", { body: "端末Aの別の変更" });
  deviceA.applyNotebookCloudRevisions({ diaryRevisions: [{
    localCaseId: "case-a", localDiaryId: "diary-two-stores-1", cloudRevision: 3, cloudHash: "8".repeat(64)
  }] }, exported(deviceA));
  const conflicted = deviceB.replaceLocalNotebook(exported(deviceA));
  assert.ok(conflicted.conflicts.some((item) => item.kind === "diary" && item.id === "diary-two-stores-1"));
  assert.equal(deviceB.listDiaryEntries("case-a").find((entry) => entry.id === "diary-two-stores-1").body,
    "端末Bの未送信の内容", "restore must preserve B's unsent edit when A changed the same record");

  const emptyDevice = loadStore(memoryStorage());
  assert.equal(emptyDevice.replaceLocalNotebook(exported(deviceA)).persisted, true);
  assert.deepEqual(exported(emptyDevice), exported(deviceA), "another empty store must recover the latest complete snapshot");
}

console.log("notebook sync runtime checks: ok");
