// Supabaseの認証メール（SMTPと文面）を、画面を触らずに設定する。
//
// 画面から貼れないため用意した。Supabaseは独自SMTPが無いプロジェクトの
// テンプレート編集を止めているが、Management APIは同じ設定を受け付ける。
// SMTPと文面を1回のPATCHで同時に入れれば、その制限に引っかからない。
//
// 使い方（自分のパソコンのターミナルで）:
//   node scripts/setup-auth-email.mjs          設定する
//   node scripts/setup-auth-email.mjs --check  いまの状態を見るだけ
//
// アクセストークンは https://supabase.com/dashboard/account/tokens で作る。
// 入力した token と SMTP のパスワードは、画面に出さないし、保存もしない。

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const emails = join(root, "supabase", "auth-emails");

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "ypnuxyfirlvbsqujocuy";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const checkOnly = process.argv.includes("--check");

const CTRL_C = "\u0003";
const DELETE = "\u007f";
const BACKSPACE = "\u0008";

/** 入力した文字を画面に出さずに読む。パスワードを肩越しに見られないため。 */
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = Boolean(stdin.isRaw);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (chunk) => {
      const char = chunk.toString("utf8");
      if (char === "\n" || char === "\r") {
        if (stdin.isTTY) stdin.setRawMode(wasRaw);
        stdin.removeListener("data", onData);
        stdin.pause();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === CTRL_C) {
        if (stdin.isTTY) stdin.setRawMode(wasRaw);
        process.stdout.write("\n中止しました。\n");
        process.exit(130);
      }
      if (char === DELETE || char === BACKSPACE) {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.on("data", onData);
  });
}

function ask(question, fallback = "") {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

async function getToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  console.log("アクセストークンは https://supabase.com/dashboard/account/tokens で作れます。");
  console.log("画面には表示されません。貼り付けて Enter を押してください。");
  const token = await askHidden("アクセストークン (sbp_...): ");
  if (!token) {
    console.error("トークンが空です。");
    process.exit(1);
  }
  return token;
}

async function callApi(token, method, body) {
  const response = await fetch(API, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
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

function describe(config) {
  const host = config?.smtp_host;
  console.log("");
  console.log("いまのSupabaseの設定:");
  console.log(`  独自SMTP        ${host ? `設定あり（${host}:${config.smtp_port ?? "-"}）` : "なし（標準の送信のまま）"}`);
  if (host) {
    console.log(`  差出人          ${config.smtp_sender_name ?? "-"} <${config.smtp_admin_email ?? "-"}>`);
    console.log(`  ユーザー名      ${config.smtp_user ?? "-"}`);
  }
  console.log(`  初回の件名      ${config?.mailer_subjects_confirmation || "（既定）"}`);
  console.log(`  2回目以降の件名 ${config?.mailer_subjects_magic_link || "（既定）"}`);
  const body = config?.mailer_templates_magic_link_content ?? "";
  console.log(`  文面            ${body.includes("手帳をひらく") ? "日本語（適用済み）" : body ? "別の文面が入っている" : "既定（英語）"}`);
  if (!host) {
    console.log("");
    console.log("  独自SMTPが無い間は、組織のメンバー以外にメールが届きません。");
    console.log("  つまり、あなた以外はログインできません。");
  }
  console.log("");
}

async function main() {
  const subjects = JSON.parse(readFileSync(join(emails, "subjects.json"), "utf8"));
  const confirmation = readFileSync(join(emails, "confirmation.html"), "utf8");
  const magicLink = readFileSync(join(emails, "magic_link.html"), "utf8");

  const token = await getToken();

  const before = await callApi(token, "GET");
  if (before.status === 401 || before.status === 403) {
    console.error("トークンが受け付けられませんでした。作り直して、もう一度試してください。");
    process.exit(1);
  }
  if (before.status !== 200) {
    console.error(`設定を読めませんでした (${before.status})`);
    console.error(before.text.slice(0, 400));
    process.exit(1);
  }
  describe(before.json);

  if (checkOnly) return;

  console.log("SMTPの情報を入れてください。パスワードは画面に出ません。");
  console.log("（お名前.comのメールなら、サーバー名は mail○○.onamae.ne.jp の形です）");
  console.log("");

  const host = await ask("SMTPサーバー名: ");
  const port = await ask("ポート [587]: ", "587");
  const user = await ask("ユーザー名（メールアドレス）: ");
  const senderEmail = await ask(`差出人アドレス [${user}]: `, user);
  const senderName = await ask("差出人の表示名 [親のもしもナビ]: ", "親のもしもナビ");
  const pass = await askHidden("パスワード: ");

  if (!host || !user || !pass) {
    console.error("入力が足りません。中止しました。");
    process.exit(1);
  }

  console.log("");
  console.log("この内容で設定します:");
  console.log(`  ${senderName} <${senderEmail}>`);
  console.log(`  ${host}:${port}  ユーザー名 ${user}`);
  console.log(`  件名「${subjects.confirmation}」`);
  console.log("  文面 日本語（supabase/auth-emails/ の内容）");
  console.log("");
  const ok = await ask("進めますか [y/N]: ");
  if (ok.toLowerCase() !== "y") {
    console.log("中止しました。何も変えていません。");
    return;
  }

  const result = await callApi(token, "PATCH", {
    smtp_host: host,
    smtp_port: String(port),
    smtp_user: user,
    smtp_pass: pass,
    smtp_admin_email: senderEmail,
    smtp_sender_name: senderName,
    mailer_subjects_confirmation: subjects.confirmation,
    mailer_templates_confirmation_content: confirmation,
    mailer_subjects_magic_link: subjects.magic_link,
    mailer_templates_magic_link_content: magicLink
  });

  if (result.status !== 200) {
    console.error("");
    console.error(`設定できませんでした (${result.status})`);
    console.error(result.text.slice(0, 600));
    console.error("");
    console.error("SMTPの情報が違うと、ここで弾かれます。サーバー名とパスワードを確認してください。");
    process.exit(1);
  }

  console.log("");
  console.log("設定しました。");
  describe(result.json);
  console.log("確認: 本番の /home で自分のアドレスにログイン用のリンクを送ってください。");
  console.log(`件名が「${subjects.magic_link}」になっていれば成功です。`);
  console.log("そのあと、自分以外のアドレスでも試してください。そこが本当の確認です。");
}

main().catch((error) => {
  console.error("失敗しました:", error instanceof Error ? error.message : error);
  process.exit(1);
});
