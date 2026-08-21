// SupabaseのSQLを、画面を開かずにターミナルから流す。
//
//   printf "トークン: "; read -s SUPABASE_ACCESS_TOKEN; echo
//   export SUPABASE_ACCESS_TOKEN
//   node scripts/run-sql.mjs supabase/free_plan_member_limit.sql
//
// 何を流すかを先に表示して、y を押すまで実行しない。
// --check を付けると、無料プランの人数上限がいくつになっているかだけを見る。
//
// トークンは https://supabase.com/dashboard/account/tokens で作る。
// 画面には出さないし、保存もしない。

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "ypnuxyfirlvbsqujocuy";
const API_BASE = process.env.SUPABASE_API_URL ?? "https://api.supabase.com";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const skipConfirm = args.includes("--yes");
const file = args.find((a) => a.endsWith(".sql"));

function confirm(question) {
  if (skipConfirm) return Promise.resolve(true);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

async function runQuery(token, query, readOnly) {
  const url = `${API_BASE}/v1/projects/${PROJECT_REF}/database/query${readOnly ? "/read-only" : ""}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query })
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

/**
 * いま本番の関数に書かれている上限を、関数の中身から読み取る。
 * 流したあとに「本当に変わったか」を目で確かめるため。
 */
const INSPECT = `
select
  p.proname as name,
  case
    when pg_get_functiondef(p.oid) like '%else 1 end%' then '1'
    when pg_get_functiondef(p.oid) like '%else 2 end%' then '2'
    else '-'
  end as invite_limit,
  case
    when pg_get_functiondef(p.oid) like '%) < 1%' then '1'
    when pg_get_functiondef(p.oid) like '%) < 2%' then '2'
    else '-'
  end as accept_limit
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_family_invite', 'accept_family_invite')
order by p.proname;
`;

async function showLimits(token) {
  const result = await runQuery(token, INSPECT, true);
  if (result.status !== 200) {
    console.error(`いまの状態を読めませんでした (${result.status})`);
    console.error(result.text.slice(0, 300));
    return null;
  }
  console.log("");
  console.log("いま本番に入っている無料プランの人数上限:");
  for (const row of Array.isArray(result.json) ? result.json : []) {
    const value = row.name === "create_family_invite" ? row.invite_limit : row.accept_limit;
    console.log(`  ${String(row.name).padEnd(22)} ${value === "-" ? "読み取れず" : `${value}人`}`);
  }
  console.log("");
  return result.json;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN が設定されていません。");
    console.error("");
    console.error('  printf "トークン: "; read -s SUPABASE_ACCESS_TOKEN; echo');
    console.error("  export SUPABASE_ACCESS_TOKEN");
    process.exit(1);
  }

  await showLimits(token);
  if (checkOnly) return;

  if (!file) {
    console.error("流すSQLファイルを指定してください。");
    console.error("  node scripts/run-sql.mjs supabase/free_plan_member_limit.sql");
    process.exit(1);
  }

  const sql = readFileSync(file, "utf8");
  const statements = sql.split("\n").filter((line) => line.trim() && !line.trim().startsWith("--")).length;
  console.log(`流すファイル: ${file}`);
  console.log(`  ${sql.split("\n").length}行（コメントを除くと約${statements}行）`);
  console.log("");

  if (!(await confirm("流しますか [y/N]: "))) {
    console.log("中止しました。何も変えていません。");
    return;
  }

  const result = await runQuery(token, sql, false);
  if (result.status !== 200 && result.status !== 201) {
    console.error("");
    console.error(`失敗しました (${result.status})`);
    console.error(result.text.slice(0, 800));
    process.exit(1);
  }

  console.log("");
  console.log("流しました。");
  await showLimits(token);
}

main().catch((error) => {
  console.error("失敗しました:", error instanceof Error ? error.message : error);
  process.exit(1);
});
