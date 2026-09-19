import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The production helper executes against synthetic Auth/HTTP/storage only.
// This exercises ordering, guard failures and continuation checks, not live
// Supabase, browser persistence, AI, email or database behavior.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const source = fs.readFileSync(path.join(root, "apps/web/lib/consultNotebookPreparation.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const copy = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const uid = "00000000-0000-4000-8000-000000000101";
const fid = "00000000-0000-4000-8000-000000000102";
const pid = "00000000-0000-4000-8000-000000000103";
const caseId = "synthetic-case";
const bindingFor = (extra = {}) => ({ version: 1, authUserId: uid, familyId: fid, ...extra });
const sessionFor = (extra = {}) => ({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", user: { id: uid, is_anonymous: true, ...extra } });
function localCase(extra = {}) {
  return {
    id: caseId, selectedStatus: "preparing", answers: { selectedStatus: "preparing" },
    personProfile: { displayName: "合成の対象者" }, createdAt: "2026-09-19T00:00:00Z",
    updatedAt: "2026-09-19T00:00:00Z", result: { summary: "合成データ", tasks: [] }, ...extra
  };
}
function diary(index = 0, extra = {}) {
  return { id: `diary-${index}`, caseId, body: `合成の本文 ${index}`, date: "2026-09-19", mood: "stable", attachments: [], ...extra };
}
function scenario(options = {}) {
  const state = {
    session: options.noSession ? null : sessionFor(options.user),
    binding: options.binding === undefined ? bindingFor() : copy(options.binding),
    cases: copy(options.cases ?? [localCase()]),
    entries: copy(options.entries ?? [diary()]),
    blockedPerson: false, blockedDiary: false, cancelled: false,
    bindingWrites: 0, applied: [], calls: [], authReads: 0
  };
  const auth = {
    getSession: async () => {
      state.authReads += 1;
      options.onAuthRead?.(state, state.authReads);
      return { data: { session: copy(state.session) }, error: null };
    },
    setSession: async (input) => {
      state.calls.push({ kind: "setSession" });
      assert.deepEqual(copy(input), { access_token: "synthetic-new-access", refresh_token: "synthetic-new-refresh" });
      if (options.setSessionFails) return { data: { session: null }, error: { message: "synthetic failure" } };
      state.session = sessionFor();
      return { data: { session: copy(state.session) }, error: null };
    }
  };
  const store = {
    readNotebookCloudBinding: () => copy(state.binding),
    writeNotebookCloudBinding: (value) => {
      state.bindingWrites += 1;
      state.calls.push({ kind: "binding", value: copy(value) });
      if (options.bindingWriteFailureAt === state.bindingWrites) return false;
      state.binding = copy(value);
      return true;
    },
    listLocalCases: () => copy(state.cases),
    listDiaryEntries: (id) => copy(state.entries.filter((entry) => entry.caseId === id)),
    isPersonNotebookCloudSyncBlocked: () => state.blockedPerson,
    isDiaryEntryCloudSyncBlocked: () => state.blockedDiary,
    createLocalId: () => `synthetic-request-${state.calls.length}`,
    applyNotebookCloudRevisions: (result, sent) => {
      state.calls.push({ kind: "apply" });
      state.applied.push({ result: copy(result), sent: copy(sent) });
      for (const revision of result.caseRevisions) {
        const record = state.cases.find((item) => item.id === revision.localCaseId);
        if (record) Object.assign(record, { cloudPersonId: revision.personId, cloudRevision: revision.cloudRevision, cloudHash: revision.cloudHash });
      }
      for (const revision of result.diaryRevisions) {
        const entry = state.entries.find((item) => item.id === revision.localDiaryId && item.caseId === revision.localCaseId);
        if (entry) Object.assign(entry, { cloudRevision: revision.cloudRevision, cloudHash: revision.cloudHash });
      }
      options.onApply?.(state);
      return { persisted: options.revisionsPersisted !== false, rejectedProfileCaseIds: options.rejectProfile ? [caseId] : [], hasConcurrentChanges: false };
    }
  };
  const fetch = async (url, init = {}) => {
    const kind = url === "/api/consult/guest" ? "guest" : init.method === "POST" ? "sync" : "read";
    const payload = init.body ? JSON.parse(init.body) : null;
    const call = { kind, url, payload, headers: copy(init.headers) };
    state.calls.push(call);
    options.onFetch?.(state, kind, call);
    if (kind === "guest") return {
      ok: options.guestOk !== false,
      json: async () => options.guestResult ?? { access_token: "synthetic-new-access", refresh_token: "synthetic-new-refresh" }
    };
    if (kind === "read") return {
      ok: options.readOk !== false,
      json: async () => copy({ authUserId: uid, familyId: fid, memberRole: "owner", cases: [], diaryEntriesTotal: 0, ...options.remote })
    };
    return {
      ok: options.syncOk !== false,
      json: async () => copy({
        familyId: fid,
        caseRevisions: [{ localCaseId: caseId, personId: pid, cloudRevision: 1, cloudHash: "a".repeat(64) }],
        taskRevisions: [],
        diaryRevisions: payload.diaryEntries.map((entry) => ({ localCaseId: caseId, localDiaryId: entry.id, cloudRevision: 1, cloudHash: "b".repeat(64) })),
        ...options.syncResult
      })
    };
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, URLSearchParams, fetch,
    require(name) {
      if (name === "./browserSupabase") return { getBrowserSupabase: () => options.noClient ? null : { auth } };
      if (name === "./store") return store;
      throw new Error(`Unexpected dependency: ${name}`);
    }
  });
  const run = (overrides = {}) => module.exports.prepareConsultNotebook({
    caseId, allowCreate: true, captchaToken: "synthetic-captcha",
    assertCurrent: () => { if (state.cancelled) throw new Error("active target changed"); },
    ...overrides
  });
  return { state, run };
}
const mutations = (fixture) => fixture.state.calls.filter((call) => ["guest", "setSession", "sync", "binding", "apply"].includes(call.kind));
let scenarios = 0;
async function check(name, work) {
  try { await work(); scenarios += 1; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}

await check("existing bound guest", async () => {
  const fixture = scenario();
  const prepared = await fixture.run({ allowCreate: false, captchaToken: undefined });
  assert.equal(prepared.guest, true);
  assert.equal(prepared.authUserId, uid);
  assert.equal(prepared.caseRecord.cloudPersonId, pid);
  assert.equal(fixture.state.calls[0].kind, "read");
  assert.equal(new URL(fixture.state.calls[0].url, "https://example.test").searchParams.get("familyId"), fid);
  assert.deepEqual(fixture.state.calls.filter((call) => ["read", "sync"].includes(call.kind)).map((call) => call.kind), ["read", "sync"]);
  assert.equal(fixture.state.calls.some((call) => call.kind === "guest"), false);
  await prepared.assertIdentity();
});
await check("new guest after explicit action", async () => {
  const fixture = scenario({ noSession: true, binding: null, remote: { familyId: null } });
  await fixture.run();
  assert.deepEqual(fixture.state.calls.filter((call) => ["guest", "setSession", "read", "sync"].includes(call.kind)).map((call) => call.kind), ["guest", "setSession", "read", "sync"]);
  assert.deepEqual(fixture.state.calls[0].payload, { captchaToken: "synthetic-captcha" });
  const firstSync = fixture.state.calls.find((call) => call.kind === "sync");
  assert.equal(firstSync.payload.createFamily, true);
  assert.equal(firstSync.payload.familyId, null);
  assert.equal(fixture.state.binding.authUserId, uid);
  assert.equal(fixture.state.binding.familyId, fid);
  assert.deepEqual(fixture.state.binding.caseIds, [caseId], "first consent binds only the selected person");
});
await check("registered former guest cannot add a new person without consent", async () => {
  const fixture = scenario({ binding: bindingFor({ caseIds: ["previously-consented"] }), user: { is_anonymous: false, email: "registered@example.test" } });
  await assert.rejects(fixture.run({ allowCreate: false }));
  assert.equal(mutations(fixture).length, 0);
});
await check("explicit consent extends selected-person scope", async () => {
  const fixture = scenario({ binding: bindingFor({ caseIds: ["previously-consented"] }) });
  await fixture.run({ allowCreate: true });
  assert.deepEqual(fixture.state.binding.caseIds, ["previously-consented", caseId]);
});
await check("legacy registered unrestricted binding stays unrestricted", async () => {
  const fixture = scenario({ user: { is_anonymous: false, email: "registered@example.test" } });
  await fixture.run({ allowCreate: false });
  assert.equal(fixture.state.binding.caseIds, undefined);
});
for (const overrides of [{ captchaToken: undefined }, { allowCreate: false }]) {
  await check("new guest needs explicit create and captcha", async () => {
    const fixture = scenario({ noSession: true, binding: null });
    await assert.rejects(fixture.run(overrides));
    assert.equal(fixture.state.calls.length, 0);
  });
}
for (const options of [
  { noClient: true }, { noSession: true },
  { noSession: true, binding: null, cases: [localCase({ cloudPersonId: pid })] },
  { binding: bindingFor({ authUserId: "other-user" }) }
]) {
  await check("unknown or expired ownership blocks guest creation", async () => {
    const fixture = scenario(options);
    await assert.rejects(fixture.run());
    assert.equal(mutations(fixture).length, 0);
  });
}
for (const mutate of [
  (state) => { state.session = sessionFor({ id: "other-user" }); },
  (state) => { state.binding = bindingFor({ authUserId: "other-user" }); },
  (state) => { state.cancelled = true; }
]) {
  await check("guest request cannot replace an intervening identity or active target", async () => {
    const fixture = scenario({ noSession: true, binding: null, onFetch: (state, kind) => { if (kind === "guest") mutate(state); } });
    await assert.rejects(fixture.run());
    assert.equal(fixture.state.calls.some((call) => ["setSession", "read", "sync", "binding"].includes(call.kind)), false);
  });
}
for (const options of [{ guestOk: false }, { guestResult: {} }, { setSessionFails: true }]) {
  await check("guest API and install failures stop before notebook access", async () => {
    const fixture = scenario({ noSession: true, binding: null, ...options });
    await assert.rejects(fixture.run());
    assert.equal(fixture.state.calls.some((call) => ["read", "sync", "binding"].includes(call.kind)), false);
  });
}
for (const options of [
  { readOk: false }, { remote: { authUserId: "other-user" } },
  { remote: { familyId: "other-family" } }, { remote: { memberRole: "viewer" } },
  { remote: { cases: null } }, { binding: null, remote: { cases: [localCase({ cloudPersonId: pid })] } },
  { binding: null, remote: { diaryEntriesTotal: 1 } },
  { binding: null, cases: [localCase({ cloudPersonId: pid })] }
]) {
  await check("cloud identity and ownership preflight", async () => {
    const fixture = scenario(options);
    await assert.rejects(fixture.run());
    assert.equal(mutations(fixture).length, 0, "GET must validate before binding or POST");
  });
}
await check("unbound session still requires explicit adoption", async () => {
  const fixture = scenario({ binding: null });
  await assert.rejects(fixture.run({ allowCreate: false }));
  assert.equal(mutations(fixture).length, 0);
});
for (const mutate of [
  (state) => { state.session = sessionFor({ id: "other-user" }); },
  (state) => { state.binding.familyId = "other-family"; },
  (state) => { state.binding.caseIds = []; },
  (state) => { state.cases[0].personProfile.displayName = "変更済み"; },
  (state) => { state.cases[0].cloudPersonId = "other-person"; },
  (state) => { state.entries[0].body = "変更済み"; },
  (state) => { state.cases = []; },
  (state) => { state.blockedPerson = true; },
  (state) => { state.blockedDiary = true; },
  (state) => { state.cancelled = true; }
]) {
  for (const during of ["read", "sync"]) {
    await check(`identity and snapshot guards after ${during}`, async () => {
      const fixture = scenario({ onFetch: (state, kind) => { if (kind === during) mutate(state); } });
      await assert.rejects(fixture.run());
      assert.equal(fixture.state.applied.length, 0);
      if (during === "read") assert.equal(mutations(fixture).length, 0);
    });
  }
}
await check("501 entries batch and photo bytes stay local", async () => {
  const fixture = scenario({
    cases: [localCase(), localCase({ id: "unselected-case", personProfile: { displayName: "別の合成人物" } })],
    entries: [...Array.from({ length: 501 }, (_, index) => diary(index, { attachments: [{
      id: `photo-${index}`, name: "synthetic.jpg", type: "image/jpeg", size: 4,
      previewUrl: "data:image/jpeg;base64,c3ludGhldGlj", storageBucket: "home-photos", storagePath: `synthetic/${index}`
    }] })), diary(999, { caseId: "unselected-case", body: "他の人の本文" })]
  });
  await fixture.run();
  const posts = fixture.state.calls.filter((call) => call.kind === "sync");
  assert.deepEqual(posts.map((call) => call.payload.diaryEntries.length), [500, 1]);
  assert.deepEqual(posts.map((call) => call.payload.cases.map((item) => item.id)), [[caseId], [caseId]]);
  assert.equal(JSON.stringify(posts).includes("previewUrl"), false);
  assert.equal(JSON.stringify(posts).includes("data:image"), false);
  assert.equal(JSON.stringify(posts).includes("他の人の本文"), false);
  assert.equal(posts[0].payload.diaryEntries[0].attachments[0].storagePath, "synthetic/0");
  assert.equal(fixture.state.applied.length, 2);
  assert.deepEqual(fixture.state.applied.map((item) => item.sent.diaryEntries.length), [500, 1]);
});
await check("empty diary still syncs person once", async () => {
  const fixture = scenario({ entries: [] });
  await fixture.run();
  assert.equal(fixture.state.calls.filter((call) => call.kind === "sync").length, 1);
});
for (const options of [
  { bindingWriteFailureAt: 1 }, { bindingWriteFailureAt: 2 },
  { revisionsPersisted: false }, { rejectProfile: true }, { syncOk: false, syncResult: { message: "synthetic conflict" } },
  { syncResult: { familyId: "other-family" } }, { syncResult: { caseRevisions: [] } },
  { cases: [localCase({ cloudPersonId: "expected-person" })] }
]) {
  await check("sync and local persistence failures do not produce a continuation", async () => {
    const fixture = scenario(options);
    await assert.rejects(fixture.run());
    if (options.bindingWriteFailureAt === 1) assert.equal(fixture.state.calls.some((call) => call.kind === "sync"), false);
    if (options.bindingWriteFailureAt === 2 || options.syncOk === false || options.syncResult) assert.equal(fixture.state.applied.length, 0);
  });
}
for (const mutate of [
  (state) => { state.session = sessionFor({ id: "other-user" }); },
  (state) => { state.session = null; },
  (state) => { state.binding.familyId = "other-family"; },
  (state) => { state.binding.caseIds = []; },
  (state) => { state.binding = null; },
  (state) => { state.cases[0].cloudPersonId = "other-person"; },
  (state) => { state.cases[0].personProfile.displayName = "変更済み"; },
  (state) => { state.entries[0].body = "変更済み"; },
  (state) => { state.cases = []; },
  (state) => { state.blockedPerson = true; },
  (state) => { state.blockedDiary = true; },
  (state) => { state.cancelled = true; }
]) {
  await check("returned continuation rechecks auth, binding, target, deletion and content", async () => {
    const fixture = scenario();
    const prepared = await fixture.run();
    const requestCount = fixture.state.calls.length;
    mutate(fixture.state);
    await assert.rejects(prepared.assertIdentity());
    assert.equal(fixture.state.calls.length, requestCount, "continuation failure must not trigger another write");
  });
}
await check("registered session retains user ID and email", async () => {
  const fixture = scenario({ user: { is_anonymous: false, email: "synthetic@example.test" } });
  const prepared = await fixture.run();
  assert.equal(prepared.guest, false);
  assert.equal(fixture.state.binding.email, "synthetic@example.test");
});
await check("pending email is still a guest", async () => {
  const fixture = scenario({ user: { is_anonymous: true, email: "pending@example.test" } });
  assert.equal((await fixture.run()).guest, true);
});
console.log(`consult preparation checks: ${scenarios} synthetic scenarios passed (no external calls)`);
