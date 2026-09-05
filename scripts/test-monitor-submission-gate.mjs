import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = requireFromWeb("typescript");

function compile(sourceUrl, requireImpl = requireFromWeb, globals = {}) {
  const source = readFileSync(sourceUrl, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourceUrl.pathname
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: requireImpl,
    Date,
    File,
    FormData,
    Number,
    Object,
    Uint8Array,
    ...globals
  });
  return { exports: module.exports, source };
}

class MockNextResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
  }

  static json(body, init = {}) {
    return new MockNextResponse(body, init.status ?? 200);
  }

  async json() {
    return this.body;
  }
}

const compiledCampaign = compile(new URL("../apps/web/lib/monitorCampaign.ts", import.meta.url));
const campaign = compiledCampaign.exports;
assert.equal(campaign.MONITOR_CAMPAIGN_ID, "crowdworks-2026-08");
assert.equal(campaign.MONITOR_CAMPAIGN_SUBMISSION_STATE, "closed");
assert.equal(campaign.isMonitorCampaignSubmissionOpen(), false);
assert.equal(campaign.resolveMonitorCampaignEntryState(), "closed");
assert.equal(campaign.resolveMonitorCampaignEntryState({ reportSubmitted: true }), "submitted");
assert.equal(campaign.resolveMonitorCampaignEntryState({ previewRequested: true }), "preview");
assert.equal(
  campaign.resolveMonitorCampaignEntryState({ previewRequested: true, reportSubmitted: true }),
  "preview"
);
assert.doesNotMatch(compiledCampaign.source, /process\.env|Date\s*\(/);
console.log("OK   現campaignと開始・回答画面はソース管理されたclosed状態");

let rateLimitCalls = 0;
let supabaseCalls = 0;
const routeRequire = (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/monitorCampaign") return campaign;
  if (specifier === "@/lib/publicRateLimit") {
    return {
      checkPublicRateLimit: async () => {
        rateLimitCalls += 1;
        return null;
      }
    };
  }
  if (specifier === "@/lib/serverSupabase") {
    return {
      getServerSupabase: () => {
        supabaseCalls += 1;
        throw new Error("closed campaign must not initialize Supabase");
      }
    };
  }
  return requireFromWeb(specifier);
};

const feedbackRoute = compile(
  new URL("../apps/web/app/api/monitor-feedback/route.ts", import.meta.url),
  routeRequire
).exports;
let jsonReads = 0;
const feedbackResponse = await feedbackRoute.POST({
  async json() {
    jsonReads += 1;
    throw new Error("closed campaign must not read the request body");
  }
});
assert.equal(feedbackResponse.status, 410);
assert.equal((await feedbackResponse.json()).code, "monitor_campaign_closed");
assert.equal(jsonReads, 0);
assert.equal(rateLimitCalls, 0);
assert.equal(supabaseCalls, 0);
console.log("OK   最終回答POSTはbody・rate limit・DBより前に410で停止");

const screenshotRoute = compile(
  new URL("../apps/web/app/api/monitor-feedback/screenshot/route.ts", import.meta.url),
  routeRequire
).exports;
let formReads = 0;
const screenshotResponse = await screenshotRoute.POST({
  async formData() {
    formReads += 1;
    throw new Error("closed campaign must not read uploaded bytes");
  }
});
assert.equal(screenshotResponse.status, 410);
assert.equal((await screenshotResponse.json()).code, "monitor_campaign_closed");
assert.equal(formReads, 0);
assert.equal(rateLimitCalls, 0);
assert.equal(supabaseCalls, 0);
console.log("OK   画像POSTはmultipart読込・rate limit・Storageより前に410で停止");

const progressRoute = compile(
  new URL("../apps/web/app/api/monitor-progress/route.ts", import.meta.url),
  routeRequire
).exports;
let progressHeaderReads = 0;
let progressBodyReads = 0;
const progressResponse = await progressRoute.POST({
  headers: {
    get() {
      progressHeaderReads += 1;
      throw new Error("closed campaign must not inspect progress headers");
    }
  },
  async text() {
    progressBodyReads += 1;
    throw new Error("closed campaign must not read progress data");
  }
});
assert.equal(progressResponse.status, 410);
assert.equal((await progressResponse.json()).code, "monitor_campaign_closed");
assert.equal(progressHeaderReads, 0);
assert.equal(progressBodyReads, 0);
assert.equal(rateLimitCalls, 0);
assert.equal(supabaseCalls, 0);
console.log("OK   途中経過POSTもheader・body・rate limit・DBより前に410で停止");

const adminSource = readFileSync(
  new URL("../apps/web/app/api/admin/monitor-feedback/route.ts", import.meta.url),
  "utf8"
);
assert.match(adminSource, /export async function GET\(/);
assert.doesNotMatch(adminSource, /isMonitorCampaignSubmissionOpen/);
console.log("OK   既存回答の管理GETは受付停止gateの対象外");

const monitorStartSource = readFileSync(
  new URL("../apps/web/app/monitor/MonitorStart.tsx", import.meta.url),
  "utf8"
);
assert.match(monitorStartSource, /if \(!campaignOpen\)/);
assert.match(monitorStartSource, /このモニターテストの受付は終了しました/);
assert.match(monitorStartSource, /親のもしもナビへ戻る/);
console.log("OK   開始画面は新規開始ボタンではなく受付終了を案内");

const monitorReportSource = readFileSync(
  new URL("../apps/web/app/monitor/report/MonitorReportForm.tsx", import.meta.url),
  "utf8"
);
assert.match(monitorReportSource, /entryState === "submitted"/);
assert.match(monitorReportSource, /entryState === "closed"/);
assert.match(monitorReportSource, /このモニターの回答受付は終了しました/);
assert.match(monitorReportSource, /新しい回答やスクリーンショットの追加送信はできません/);
console.log("OK   回答画面は送信済み表示を保ち、未送信端末へ受付終了を案内");

const startPageSource = readFileSync(
  new URL("../apps/web/app/start/page.tsx", import.meta.url),
  "utf8"
);
const closedStartGuard = startPageSource.indexOf("isMonitor && !isMonitorCampaignSubmissionOpen()");
const localReset = startPageSource.indexOf("resetLocalNotebookData()");
assert.ok(closedStartGuard >= 0, "an old direct monitor start URL must be redirected after closure");
assert.ok(
  closedStartGuard < localReset,
  "the closed-campaign guard must run before an old reset URL can erase local notebook data"
);
console.log("OK   古いモニター開始URLでも手帳を消す前に受付終了へ戻す");

// Execute the real client module with isolated in-memory storage and timers.
// Never load a browser, credentials, existing notebook data or a real fetch.
const sessionSourceUrl = new URL("../apps/web/lib/monitorSession.ts", import.meta.url);
const reminderSourceUrl = new URL("../apps/web/components/MonitorTestReminder.tsx", import.meta.url);
const fixedNow = new Date("2026-09-06T03:00:00.000Z");
const pastSession = {
  sessionId: "12345678-1234-4234-8234-123456789abc",
  startedAt: "2026-08-25T03:00:00.000Z"
};
const pastActivity = {
  appOpened: { count: 2, firstAt: pastSession.startedAt, lastAt: "2026-08-26T03:00:00.000Z",
    occurrences: [pastSession.startedAt, "2026-08-26T03:00:00.000Z"] }
};
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow.getTime()])); }
  static now() { return fixedNow.getTime(); }
}
function clientHarness({ session = pastSession, consent = "granted", open = false, mutableCampaign = false,
  lastAttemptAt = pastSession.startedAt } = {}) {
  let campaignOpen = open;
  assert.ok(!open || mutableCampaign, "opening a campaign is only a local test stub");
  const campaignModule = mutableCampaign
    ? { ...campaign, isMonitorCampaignSubmissionOpen: () => campaignOpen }
    : campaign;
  const storage = new Map([
    ["oyano_monitor_activity_v01", JSON.stringify(pastActivity)],
    ["oyano_monitor_progress_sync_v01", JSON.stringify({ sessionId: pastSession.sessionId, lastAttemptAt })],
    ["oyano_notebook_cases_v1", '{"fixture":"unrelated notebook data must remain unchanged"}']
  ]);
  if (session) storage.set("oyano_monitor_session_v01", JSON.stringify(session));
  if (consent !== null) storage.set("oyano_monitor_progress_consent_v01", consent);
  const events = { reads: [], writes: [], removes: [], fetches: [], scheduled: [], cleared: [] };
  const timers = new Map();
  let nextTimerId = 1;
  const windowMock = {
    localStorage: {
      getItem(key) { events.reads.push(key); return storage.get(key) ?? null; },
      setItem(key, value) { events.writes.push([key, value]); storage.set(key, String(value)); },
      removeItem(key) { events.removes.push(key); storage.delete(key); }
    },
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      events.scheduled.push([id, delay]); timers.set(id, callback); return id;
    },
    clearTimeout(id) { events.cleared.push(id); timers.delete(id); }
  };
  const module = compile(sessionSourceUrl, (specifier) => {
    assert.equal(specifier, "@/lib/monitorCampaign", "session must use the explicit campaign dependency");
    return campaignModule;
  }, {
    window: windowMock, Date: FixedDate,
    crypto: { randomUUID: () => "23456789-1234-4234-8234-123456789abc" },
    fetch: async (url, init) => { events.fetches.push({ url, init }); return { ok: true }; }
  }).exports;
  return {
    module, campaignModule, events, timers, windowMock,
    snapshot: () => [...storage.entries()],
    setOpen(value) { assert.ok(mutableCampaign); campaignOpen = value; }
  };
}
const flushMicrotasks = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function assertNoClientWork(client, before) {
  assert.deepEqual(client.snapshot(), before, "closure must preserve exact stored session/activity/consent/sync/notebook bytes");
  assert.equal(client.events.reads.length, 0, "guard must precede legacy session normalization and storage reads");
  assert.equal(client.events.writes.length, 0);
  assert.equal(client.events.removes.length, 0);
  assert.equal(client.events.fetches.length, 0);
  assert.equal(client.events.scheduled.length, 0);
  assert.equal(client.timers.size, 0);
}
const closedOperations = [
  ["activity", (module) => module.markMonitorActivity("dailyRecordSaved", fixedNow)],
  ["schedule", (module, options) => module.scheduleMonitorProgressSync(options)],
  ["direct", (module, options) => module.syncMonitorProgress(options)],
  ["consent", (module) => module.grantMonitorProgressConsent()]
];
let closedScenarios = 0;
for (const session of [pastSession, { startedAt: pastSession.startedAt },
  { ...pastSession, reportSubmittedAt: "2026-09-01T03:00:00.000Z" }, null]) {
  for (const consent of ["granted", "declined", null]) {
    for (const force of [false, true]) {
      for (const [operation, invoke] of closedOperations) {
        const client = clientHarness({ session, consent });
        const before = client.snapshot();
        const result = await invoke(client.module, { force, now: fixedNow });
        await flushMicrotasks();
        if (operation === "direct" || operation === "consent") assert.equal(result, false);
        assertNoClientWork(client, before);
        closedScenarios++;
      }
    }
  }
}
assert.equal(closedScenarios, 96);
console.log("OK   closed端末96条件で活動記録・予約・直接送信・同意再設定が停止し、過去データはbyte不変");

// A callback already queued before closure must not bypass the new guard.
for (const [operation, invoke] of closedOperations) {
  const client = clientHarness({ open: true, mutableCampaign: true, lastAttemptAt: fixedNow.toISOString() });
  client.module.scheduleMonitorProgressSync({ now: fixedNow });
  assert.equal(client.timers.size, 1, "the open campaign fixture must actually queue a throttled retry");
  const [[timerId, staleCallback]] = [...client.timers.entries()];
  const before = client.snapshot();
  client.setOpen(false);
  await invoke(client.module, { force: true, now: fixedNow });
  assert.equal(client.timers.size, 0, `${operation} must cancel the pending retry when closed`);
  assert.deepEqual(client.events.cleared, [timerId]);
  // Simulate a timer callback already dequeued by the browser before cancellation.
  staleCallback();
  await flushMicrotasks();
  assert.equal(client.events.fetches.length, 0);
  assert.equal(client.events.scheduled.length, 1, "closure must not schedule a replacement timer");
  assert.equal(client.events.writes.length, 0);
  assert.equal(client.events.removes.length, 0);
  assert.deepEqual(client.snapshot(), before);
}
console.log("OK   終了前に予約済みのtimerも取消し、古いcallbackが動いても送信しない");

// The closure guard is additional to consent, not a replacement for it.
for (const consent of ["declined", null]) {
  for (const force of [false, true]) {
    const client = clientHarness({ consent, open: true, mutableCampaign: true });
    const before = client.snapshot();
    client.module.scheduleMonitorProgressSync({ force, now: fixedNow });
    assert.equal(await client.module.syncMonitorProgress({ force, now: fixedNow }), false);
    await flushMicrotasks();
    assert.equal(client.events.fetches.length, 0);
    assert.equal(client.events.scheduled.length, 0);
    assert.equal(client.events.writes.length, 0);
    assert.equal(client.events.removes.length, 0);
    assert.deepEqual(client.snapshot(), before);
  }
}
for (const force of [false, true]) {
  for (const operation of ["schedule", "direct"]) {
    const client = clientHarness({ open: true, mutableCampaign: true });
    if (operation === "direct") {
      assert.equal(await client.module.syncMonitorProgress({ force, now: fixedNow }), true);
    } else {
      client.module.scheduleMonitorProgressSync({ force, now: fixedNow });
      await flushMicrotasks();
    }
    assert.equal(client.events.fetches.length, 1, "an open campaign with explicit consent still sends progress");
    const { url, init } = client.events.fetches[0];
    assert.equal(url, "/api/monitor-progress");
    assert.equal(init.method, "POST");
    assert.equal(init.credentials, "same-origin");
    const payload = JSON.parse(init.body);
    assert.equal(payload.campaignId, campaign.MONITOR_CAMPAIGN_ID);
    assert.equal(payload.sessionId, pastSession.sessionId);
    assert.equal(payload.usageMetrics.appOpenCount, 2);
    assert.deepEqual(Object.keys(payload).sort(), ["version", "campaignId", "sessionId", "startedAt", "reportDueAt",
      "lastSeenAt", "dayNumber", "isReportDue", "usageMetrics"].sort(), "only the existing anonymous progress payload is sent");
    assert.deepEqual(client.events.writes.map(([key]) => key), [client.module.MONITOR_PROGRESS_SYNC_STORAGE_KEY]);
    assert.equal(client.events.removes.length, 0);
    assert.equal(client.timers.size, 0);
  }
}
console.log("OK   open stubでも同意なし/拒否はforceで迂回できず、明示同意ありのみ既存payloadを送信");

function reminderHarness(client, { hydrated = false, consent = null, session = pastSession } = {}) {
  let cursor = 0;
  const slots = hydrated ? [session, consent, new FixedDate()] : [];
  const effects = new Map();
  const pendingEffects = [];
  const cleanup = new Map();
  const intervals = new Map();
  const intervalEvents = [];
  const monitorCalls = [];
  let nextInterval = 1;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!effects.has(index) || dependencies.some((value, at) => !Object.is(value, effects.get(index)[at]))) {
        effects.set(index, dependencies);
        pendingEffects.push([index, callback]);
      }
    },
    useMemo(callback) { cursor++; return callback(); }
  };
  const observedModule = { ...client.module };
  for (const name of ["readMonitorSession", "readMonitorProgressConsent", "readMonitorActivity",
    "markMonitorActivity", "grantMonitorProgressConsent", "declineMonitorProgressConsent"]) {
    observedModule[name] = (...args) => { monitorCalls.push(name); return client.module[name](...args); };
  }
  const component = compile(reminderSourceUrl, (specifier) => {
    if (specifier === "react") return react;
    if (specifier === "react/jsx-runtime") return {
      jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props })
    };
    if (specifier === "next/link") return { __esModule: true, default: "a" };
    if (specifier === "@/lib/monitorSession") return observedModule;
    if (specifier === "@/lib/monitorCampaign") return client.campaignModule;
    assert.equal(specifier, "./MonitorTestReminder.module.css");
    return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  }, {
    Date: FixedDate,
    window: {
      ...client.windowMock,
      setInterval(callback, delay) {
        const id = nextInterval++;
        intervalEvents.push([id, delay]); intervals.set(id, callback); return id;
      },
      clearInterval(id) { intervals.delete(id); }
    }
  }).exports.MonitorTestReminder;
  return {
    monitorCalls, intervals, intervalEvents,
    render(props = { hasNotebook: true, hasRecordToday: false }) { cursor = 0; return component(props); },
    flushEffects() {
      for (const [index, callback] of pendingEffects.splice(0)) {
        cleanup.get(index)?.();
        const result = callback();
        if (typeof result === "function") cleanup.set(index, result);
        else cleanup.delete(index);
      }
    },
    unmount() { for (const callback of cleanup.values()) callback(); }
  };
}
function renderedText(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(renderedText).join("");
  if (typeof tree !== "object") return String(tree);
  return renderedText(tree.props?.children);
}
let reminderScenarios = 0;
for (const consent of ["granted", "declined", null]) {
  for (const hydrated of [false, true]) {
    for (const hasNotebook of [false, true]) {
      const client = clientHarness({ consent });
      const before = client.snapshot();
      const reminder = reminderHarness(client, { consent, hydrated });
      assert.equal(reminder.render({ hasNotebook, hasRecordToday: false }), null);
      reminder.flushEffects();
      assert.equal(reminder.render({ hasNotebook, hasRecordToday: true }), null, "closed guard must also hide previously hydrated reminders");
      reminder.flushEffects();
      reminder.unmount();
      await flushMicrotasks();
      assert.deepEqual(reminder.monitorCalls, [], "closed reminder must not read consent/session, count app opens or request sharing");
      assert.equal(reminder.intervals.size, 0);
      assert.equal(reminder.intervalEvents.length, 0);
      assertNoClientWork(client, before);
      reminderScenarios++;
    }
  }
}
assert.equal(reminderScenarios, 12);
// Positive mount controls prove the mocked effect actually executes app code.
for (const consent of ["granted", "declined", null]) {
  const client = clientHarness({ consent, open: true, mutableCampaign: true });
  const reminder = reminderHarness(client, { consent });
  assert.equal(reminder.render(), null);
  reminder.flushEffects();
  const view = reminder.render();
  assert.equal(view.type, "aside");
  assert.ok(reminder.monitorCalls.includes("readMonitorSession"));
  assert.ok(reminder.monitorCalls.includes("readMonitorProgressConsent"));
  assert.ok(reminder.monitorCalls.includes("markMonitorActivity"));
  assert.equal(reminder.intervals.size, 1);
  if (consent === null) assert.ok(renderedText(view).includes("同意して共有する"));
  else assert.ok(renderedText(view).includes("最終アンケートに回答する"));
  await flushMicrotasks();
  assert.equal(client.events.fetches.length, consent === "granted" ? 1 : 0);
  reminder.unmount();
  assert.equal(reminder.intervals.size, 0);
}
console.log("OK   reminder12条件で案内非表示・effect仕事0・過去データ保持、open時の同意案内とcleanupは維持");
