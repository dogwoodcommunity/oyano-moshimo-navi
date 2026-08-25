const baseUrl = (process.argv[2] ?? process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const runLiveAi = process.argv.includes("--live-ai") || process.env.RUN_LIVE_AI === "1";

let failed = false;

function ok(label, detail = "") {
  console.log(`OK   ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, detail = "") {
  failed = true;
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

async function read(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return { response, text };
}

const monitor = await read("/monitor");
if (monitor.response.ok
  && monitor.text.includes("7日間のテストを始める")
  && !monitor.text.includes("最終日の結果を報告する")) {
  ok("開始時に最終報告ボタンを表示しない", monitor.response.status);
} else {
  fail("開始時に最終報告ボタンを表示しない", monitor.response.status);
}

const report = await read("/monitor/report");
if (report.response.ok && !report.text.includes("7日間の検証結果を送信する")) {
  ok("開始前・期間中は最終報告フォームを表示しない", report.response.status);
} else {
  fail("開始前・期間中は最終報告フォームを表示しない", report.response.status);
}

const start = await read("/start?monitor=1");
if (start.response.ok
  && start.text.includes("呼び名")
  && start.text.includes("都道府県")) {
  ok("モニター用の初期登録画面", start.response.status);
} else {
  fail("モニター用の初期登録画面", start.response.status);
}

const consultAccess = await read("/api/consult");
let consultAccessBody = {};
try {
  consultAccessBody = JSON.parse(consultAccess.text);
} catch {
  // The failure below includes the HTTP status without echoing response details.
}
if (consultAccess.response.ok && typeof consultAccessBody.canConsult === "boolean") {
  ok("AI相談の利用状況API", `${consultAccess.response.status} canConsult=${consultAccessBody.canConsult}`);
} else {
  fail("AI相談の利用状況API", consultAccess.response.status);
}

const invalidFeedback = await read("/api/monitor-feedback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}"
});
if ([400, 503].includes(invalidFeedback.response.status)) {
  ok(
    invalidFeedback.response.status === 400
      ? "未入力の最終報告を拒否"
      : "許可名未設定時は最終回答の受付を停止",
    invalidFeedback.response.status
  );
} else {
  fail("未入力の最終報告を拒否", invalidFeedback.response.status);
}

const invalidScreenshot = await read("/api/monitor-feedback/screenshot", {
  method: "POST",
  body: new FormData()
});
if (invalidScreenshot.response.status === 400) {
  ok("画像なしの添付を拒否", invalidScreenshot.response.status);
} else {
  fail("画像なしの添付を拒否", invalidScreenshot.response.status);
}

const unsignedSync = await read("/api/notebook/sync");
if ([401, 501, 503].includes(unsignedSync.response.status)) {
  ok("未認証のクラウド同期を拒否", unsignedSync.response.status);
} else {
  fail("未認証のクラウド同期を拒否", unsignedSync.response.status);
}

if (!runLiveAi) {
  console.log("SKIP AI実回答と初回無料境界: --live-ai または RUN_LIVE_AI=1 で実行");
} else {
  const requestBody = {
    question: "退院後に家で過ごす準備は、何から確認すればよいですか？",
    person: {
      relationship: "母",
      careStatus: "退院後の在宅",
      birthDate: "70代"
    },
    entries: [
      {
        date: new Date().toISOString().slice(0, 10),
        mood: "changed",
        body: "退院の話が出ました。家で暮らす準備と、家族で確認することを整理したいです。"
      }
    ],
    tasks: [],
    history: []
  };
  const firstConsult = await read("/api/consult", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  let firstBody = {};
  try {
    firstBody = JSON.parse(firstConsult.text);
  } catch {
    // Handled by the structured-response assertion below.
  }
  const structuredAnswer = firstBody?.answer;
  if (firstConsult.response.ok
    && typeof structuredAnswer?.situation === "string"
    && Array.isArray(structuredAnswer?.nextChecks)
    && structuredAnswer.nextChecks.length > 0) {
    ok("AI相談が実回答を返す", `${firstConsult.response.status} nextChecks=${structuredAnswer.nextChecks.length}`);
  } else {
    fail("AI相談が実回答を返す", `${firstConsult.response.status} ${firstBody?.error ?? "invalid_response"}`);
  }

  const trialCookie = firstConsult.response.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (firstConsult.response.ok && trialCookie) {
    const secondConsult = await read("/api/consult", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: trialCookie
      },
      body: JSON.stringify({ ...requestBody, question: "続けて、家族への頼み方も教えてください。" })
    });
    if (secondConsult.response.status === 402) {
      ok("初回無料後はFamily Plus境界を返す", secondConsult.response.status);
    } else {
      fail("初回無料後はFamily Plus境界を返す", secondConsult.response.status);
    }
  } else if (firstConsult.response.ok) {
    fail("初回無料の利用済みCookieを発行", "set-cookie missing");
  }
}

if (failed) process.exit(1);
