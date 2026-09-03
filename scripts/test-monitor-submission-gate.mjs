import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = requireFromWeb("typescript");

function compile(sourceUrl, requireImpl = requireFromWeb) {
  const source = readFileSync(sourceUrl, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
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
    Uint8Array
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
