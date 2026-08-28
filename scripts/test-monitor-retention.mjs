import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = requireFromWeb("typescript");
const source = readFileSync(new URL("../apps/web/lib/monitorRetention.ts", import.meta.url), "utf8");
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
  Date,
  Number,
  Set,
  Array,
  Object
});

const {
  isExpiredMonitorScreenshotMonth,
  isMonitorRetentionExpired,
  monitorFeedbackScreenshotPaths,
  monitorRetentionBatchLimit,
  monitorRetentionExpiresAt
} = module.exports;

const progress = {
  action: "monitor_progress_synced",
  metadata: { reportDueAt: "2026-01-31T12:34:56.000Z" },
  created_at: "2026-01-01T00:00:00.000Z"
};
assert.equal(monitorRetentionExpiresAt(progress).toISOString(), "2026-07-31T12:34:56.000Z");
assert.equal(isMonitorRetentionExpired(progress, new Date("2026-07-31T12:34:55.999Z")), false);
assert.equal(isMonitorRetentionExpired(progress, new Date("2026-07-31T12:34:56.000Z")), true);
console.log("OK   途中経過はreportDueAtから暦月6か月後に削除対象");

const feedback = {
  action: "monitor_feedback_submitted",
  metadata: {
    firstSubmittedAt: "2025-12-01T00:00:00.000Z",
    submittedAt: "2026-03-31T08:00:00.000Z"
  },
  created_at: "2025-12-01T00:00:00.000Z"
};
assert.equal(monitorRetentionExpiresAt(feedback).toISOString(), "2026-09-30T08:00:00.000Z");
assert.equal(isMonitorRetentionExpired(feedback, new Date("2026-09-30T08:00:00.000Z")), true);
console.log("OK   最終回答は最新submittedAtから暦月6か月後に削除対象");

const fallback = {
  action: "monitor_progress_synced",
  metadata: { reportDueAt: "invalid" },
  created_at: "2026-02-28T09:00:00.000Z"
};
assert.equal(monitorRetentionExpiresAt(fallback).toISOString(), "2026-08-28T09:00:00.000Z");
console.log("OK   基準日時がない場合はcreated_atへフォールバック");

assert.deepEqual(
  Array.from(monitorFeedbackScreenshotPaths({
    screenshotPaths: [
      "monitor-feedback/a.png",
      "other-bucket/b.png",
      "monitor-feedback/a.png",
      "monitor-feedback/c.png"
    ]
  })),
  ["monitor-feedback/a.png", "monitor-feedback/c.png"]
);
console.log("OK   削除対象画像は許可prefixだけを重複なく抽出");

assert.equal(monitorRetentionBatchLimit(undefined), 25);
assert.equal(monitorRetentionBatchLimit("0"), 1);
assert.equal(monitorRetentionBatchLimit("500"), 100);
console.log("OK   purge batchは既定25・最大100に制限");

assert.equal(isExpiredMonitorScreenshotMonth("2026-01", new Date("2026-08-28T00:00:00.000Z")), true);
assert.equal(isExpiredMonitorScreenshotMonth("2026-02", new Date("2026-08-28T00:00:00.000Z")), false);
assert.equal(isExpiredMonitorScreenshotMonth("e2e", new Date("2026-08-28T00:00:00.000Z")), false);
console.log("OK   未紐付け画像は月単位で6か月を過ぎてから削除対象");
