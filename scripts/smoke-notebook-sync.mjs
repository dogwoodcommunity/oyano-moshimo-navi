// クラウド控え（/api/notebook/sync）の疎通確認。
//
// 使い方:
//   WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app \
//   NOTEBOOK_ACCESS_TOKEN=<Supabaseのaccess token> \
//   node scripts/smoke-notebook-sync.mjs
//
// access token の取り方:
//   1. 本番の /home でメール確認（マジックリンク）を済ませる。
//   2. ブラウザのコンソールで次を実行し、表示された access_token を使う。
//      Object.keys(localStorage).filter((k) => k.includes("auth-token"))
//        .map((k) => JSON.parse(localStorage.getItem(k))?.access_token)
//
// 既定では読み取りだけを確認する。--write を付けた場合のみ、確認用の手帳を
// 1件書き込んで往復を検証する。本番に対して --write を使うと、確認用の対象者が
// 残るので注意すること（削除方法は最後に表示する）。

const baseUrl = (process.argv.find((arg) => arg.startsWith("http")) ?? process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const accessToken = process.env.NOTEBOOK_ACCESS_TOKEN ?? "";
const allowWrite = process.argv.includes("--write");

const results = [];

function record(label, ok, detail = "") {
  results.push({ label, ok, detail });
  const mark = ok ? "ok  " : "FAIL";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function call(method, body) {
  const response = await fetch(`${baseUrl}/api/notebook/sync`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function callWithoutAuth() {
  const response = await fetch(`${baseUrl}/api/notebook/sync`);
  return response.status;
}

function buildSampleNotebook(stamp) {
  const caseId = `smoke-${stamp}`;
  return {
    caseId,
    payload: {
      cases: [
        {
          id: caseId,
          selectedStatus: "hospitalized",
          answers: { selectedStatus: "hospitalized", targetRelationship: "mother", targetName: "動作確認" },
          personProfile: {
            displayName: "【動作確認】削除してください",
            relationship: "母",
            careStatus: "入院中"
          },
          status: "result_ready",
          createdAt: new Date().toISOString(),
          supportPackStatus: "none",
          result: {
            summary: "クラウド控えの動作確認用データです。",
            tasks: [
              {
                title: `動作確認タスク ${stamp}`,
                description: "確認後に削除してください。",
                dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                priority: 2,
                category: "notebook",
                requiresProfessional: false
              }
            ],
            familyQuestions: [],
            registryItems: [],
            providerCategories: [],
            warnings: []
          }
        }
      ],
      diaryEntries: [
        {
          id: `smoke-diary-${stamp}`,
          caseId,
          date: new Date().toISOString().slice(0, 10),
          mood: "changed",
          body: `動作確認の記録 ${stamp}`,
          attachments: [],
          createdAt: new Date().toISOString()
        }
      ]
    }
  };
}

async function main() {
  console.log(`base url: ${baseUrl}`);
  console.log(`mode: ${allowWrite ? "read + write" : "read only（--write で往復確認）"}`);
  console.log("");

  const unauthStatus = await callWithoutAuth();
  record("トークン無しのGETが401", unauthStatus === 401, `status ${unauthStatus}`);

  if (!accessToken) {
    console.log("");
    console.log("NOTEBOOK_ACCESS_TOKEN が未設定のため、ここまでで終了します。");
    console.log("本人確認済みのトークンを渡すと、クラウド控えの読み取りまで確認します。");
    process.exit(results.some((item) => !item.ok) ? 1 : 0);
  }

  const before = await call("GET");
  record("トークン付きのGETが200", before.status === 200, `status ${before.status}`);
  record(
    "GETがcasesとdiaryEntriesを返す",
    Array.isArray(before.json?.cases) && Array.isArray(before.json?.diaryEntries),
    `cases ${before.json?.cases?.length ?? "-"} / diaryEntries ${before.json?.diaryEntries?.length ?? "-"}`
  );

  if (!allowWrite) {
    console.log("");
    console.log("往復まで確認する場合は --write を付けて実行してください。");
    finish();
  }

  const stamp = Date.now().toString(36);
  const { caseId, payload } = buildSampleNotebook(stamp);

  const posted = await call("POST", payload);
  record("POSTが200", posted.status === 200, `status ${posted.status}`);
  record(
    "POSTが同期件数を返す",
    posted.json?.ok === true && posted.json?.syncedPeople >= 1,
    `people ${posted.json?.syncedPeople} / tasks ${posted.json?.syncedTasks} / entries ${posted.json?.syncedEntries}`
  );

  const after = await call("GET");
  const restoredCase = after.json?.cases?.find((item) => item.id === caseId);
  const restoredEntry = after.json?.diaryEntries?.find((item) => item.caseId === caseId);

  record("書き込んだ手帳がGETで戻る", Boolean(restoredCase), restoredCase ? `id ${restoredCase.id}` : "見つからない");
  record(
    "対象者のプロフィールが戻る",
    restoredCase?.personProfile?.relationship === "母",
    `relationship ${restoredCase?.personProfile?.relationship ?? "-"}`
  );
  record(
    "確認リストが戻る",
    Boolean(restoredCase?.result?.tasks?.some((task) => task.title === `動作確認タスク ${stamp}`)),
    `tasks ${restoredCase?.result?.tasks?.length ?? 0}`
  );
  record("日記が戻る", Boolean(restoredEntry), restoredEntry ? `mood ${restoredEntry.mood}` : "見つからない");
  record(
    "日記の本文が一致する",
    restoredEntry?.body === `動作確認の記録 ${stamp}`,
    restoredEntry?.body ?? "-"
  );

  // 2回目のPOSTで重複が増えないこと（同じlocalCaseId / localDiaryIdは更新される）
  await call("POST", payload);
  const again = await call("GET");
  const casesForId = (again.json?.cases ?? []).filter((item) => item.id === caseId).length;
  const entriesForId = (again.json?.diaryEntries ?? []).filter((item) => item.id === `smoke-diary-${stamp}`).length;
  record("2回目のPOSTで対象者が増えない", casesForId === 1, `${casesForId}件`);
  record("2回目のPOSTで日記が増えない", entriesForId === 1, `${entriesForId}件`);

  console.log("");
  console.log(`確認用データを書き込みました。対象者の表示名は「【動作確認】削除してください」です。`);
  console.log(`本番で実行した場合は、管理画面またはSupabaseから people / tasks / timeline_events の該当行を削除してください。`);
  console.log(`目印: profile->>localCaseId = ${caseId}`);

  finish();
}

function finish() {
  const failed = results.filter((item) => !item.ok);
  console.log("");
  console.log(`${results.length - failed.length}/${results.length} 件が成功`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("smoke failed:", error);
  process.exit(1);
});
