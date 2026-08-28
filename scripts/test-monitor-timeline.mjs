import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

process.env.TZ = "Asia/Tokyo";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = requireFromWeb("typescript");
const source = readFileSync(new URL("../apps/web/lib/monitorSession.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module,
  exports: module.exports,
  require: (id) => id === "@/lib/monitorCampaign"
    ? { MONITOR_CAMPAIGN_ID: "crowdworks-2026-08" }
    : requireFromWeb(id),
  window: undefined,
  Date,
  JSON,
  Math,
  Set
});

const {
  buildMonitorProgressSyncPayload,
  monitorCalendarDayNumber,
  monitorPeriodStatus,
  monitorProgress,
  normalizeMonitorSession,
  shouldSyncMonitorProgress
} = module.exports;

function at(value) {
  return new Date(value);
}

function verifyJourney(label, startedAt, checkpoints) {
  const session = { startedAt: at(startedAt).toISOString() };
  checkpoints.forEach(({ now, day, remaining, due, status }) => {
    const progress = monitorProgress(session, at(now));
    assert.equal(progress.dayNumber, day, `${label} ${now}: dayNumber`);
    assert.equal(progress.daysRemaining, remaining, `${label} ${now}: daysRemaining`);
    assert.equal(progress.isReportDue, due, `${label} ${now}: isReportDue`);
    if (status) assert.equal(monitorPeriodStatus(progress), status, `${label} ${now}: status copy`);
  });
  console.log(`OK   ${label}`);
}

verifyJourney("朝に開始した通常の7日間", "2026-08-25T10:00:00+09:00", [
  { now: "2026-08-25T10:00:00+09:00", day: 1, remaining: 7, due: false, status: "今日を含めてあと7日です。" },
  { now: "2026-08-30T23:59:59+09:00", day: 6, remaining: 2, due: false, status: "今日を含めてあと2日です。" },
  { now: "2026-08-31T00:00:00+09:00", day: 7, remaining: 1, due: false, status: "今日が7日目（最終日）です。" },
  { now: "2026-08-31T23:59:59+09:00", day: 7, remaining: 1, due: false, status: "今日が7日目（最終日）です。" },
  { now: "2026-09-01T00:00:00+09:00", day: 7, remaining: 0, due: true, status: "7日間の記録期間は終了しました。" }
]);

verifyJourney("23時59分に開始しても開始日が1日目", "2026-08-25T23:59:30+09:00", [
  { now: "2026-08-25T23:59:30+09:00", day: 1, remaining: 7, due: false },
  { now: "2026-08-26T00:00:00+09:00", day: 2, remaining: 6, due: false },
  { now: "2026-09-01T00:00:00+09:00", day: 7, remaining: 0, due: true }
]);

verifyJourney("月またぎ", "2026-08-28T08:00:00+09:00", [
  { now: "2026-09-03T23:59:59+09:00", day: 7, remaining: 1, due: false },
  { now: "2026-09-04T00:00:00+09:00", day: 7, remaining: 0, due: true }
]);

verifyJourney("年またぎ", "2026-12-31T18:00:00+09:00", [
  { now: "2027-01-06T23:59:59+09:00", day: 7, remaining: 1, due: false },
  { now: "2027-01-07T00:00:00+09:00", day: 7, remaining: 0, due: true }
]);

console.log("OK   7日目終了から翌日0:00のアンケート開放境界");

const legacySessionId = "11111111-1111-4111-8111-111111111111";
const legacySession = normalizeMonitorSession(
  { startedAt: "2026-08-25T10:00:00+09:00" },
  () => legacySessionId
);
assert.deepEqual(
  JSON.parse(JSON.stringify(legacySession)),
  {
    session: {
      sessionId: legacySessionId,
      startedAt: "2026-08-25T10:00:00+09:00"
    },
    upgraded: true
  }
);
assert.equal(normalizeMonitorSession({ startedAt: "invalid" }, () => legacySessionId), null);
console.log("OK   既存モニター端末へ名前を含まないsession IDを追加");

function activityEvent(occurrences) {
  return {
    count: occurrences.length,
    firstAt: occurrences[0],
    lastAt: occurrences.at(-1),
    occurrences
  };
}

const progressPayload = buildMonitorProgressSyncPayload(
  legacySession.session,
  {
    appOpened: activityEvent([
      "2026-08-25T10:05:00+09:00",
      "2026-08-26T09:00:00+09:00"
    ]),
    dailyRecordSaved: activityEvent([
      "2026-08-25T10:15:00+09:00",
      "2026-08-27T20:00:00+09:00",
      "2026-09-01T00:05:00+09:00"
    ]),
    diaryHistoryOpened: activityEvent(["2026-08-26T09:05:00+09:00"]),
    checklistOpened: activityEvent(["2026-08-27T09:05:00+09:00"])
  },
  at("2026-08-28T12:00:00+09:00")
);

assert.deepEqual(Object.keys(progressPayload).sort(), [
  "campaignId",
  "dayNumber",
  "isReportDue",
  "lastSeenAt",
  "reportDueAt",
  "sessionId",
  "startedAt",
  "usageMetrics",
  "version"
].sort());
assert.equal(progressPayload.campaignId, "crowdworks-2026-08");
assert.equal(progressPayload.dayNumber, 4);
assert.equal(progressPayload.usageMetrics.appOpenCount, 2);
assert.equal(progressPayload.usageMetrics.appOpenDistinctDayCount, 2);
assert.equal(progressPayload.usageMetrics.manualRecordSaveCount, 2);
assert.equal(progressPayload.usageMetrics.manualRecordDistinctDayCount, 2);
assert.equal(progressPayload.usageMetrics.lastManualRecordDayNumber, 3);
assert.equal(progressPayload.usageMetrics.diaryHistoryOpened, true);
assert.equal(progressPayload.usageMetrics.checklistOpened, true);
assert.equal(progressPayload.usageMetrics.documentMemoSaved, false);
assert.equal(monitorCalendarDayNumber(legacySession.session.startedAt, "2026-08-27T20:00:00+09:00"), 3);
assert.equal(JSON.stringify(progressPayload).includes("記録本文"), false);
console.log("OK   名前なし途中経過は7日間内の回数・日数・機能到達だけを含む");

assert.equal(shouldSyncMonitorProgress(null, legacySessionId, at("2026-08-28T12:00:00+09:00")), true);
assert.equal(shouldSyncMonitorProgress(
  { sessionId: legacySessionId, lastAttemptAt: "2026-08-28T12:00:00+09:00" },
  legacySessionId,
  at("2026-08-28T12:00:14+09:00")
), false);
assert.equal(shouldSyncMonitorProgress(
  { sessionId: legacySessionId, lastAttemptAt: "2026-08-28T12:00:00+09:00" },
  legacySessionId,
  at("2026-08-28T12:00:15+09:00")
), true);
console.log("OK   名前なし途中経過の15秒間引き境界");
