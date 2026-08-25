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
  require: requireFromWeb,
  window: undefined,
  Date,
  JSON,
  Math,
  Set
});

const { monitorPeriodStatus, monitorProgress } = module.exports;

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
