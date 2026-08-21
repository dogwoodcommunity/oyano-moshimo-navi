// Supabaseの認証メール（SMTPと文面）を、画面を触らずに設定する。
//
// 画面から貼れないため用意した。Supabaseは独自SMTPが無いプロジェクトの
// テンプレート編集を止めているが、Management APIは同じ設定を受け付ける。
// SMTPと文面を1回のPATCHで同時に入れれば、その制限に引っかからない。
//
// 使い方は docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md を見ること。
//
//   node scripts/setup-auth-email.mjs --check           いまの状態を見るだけ
//   node scripts/setup-auth-email.mjs --templates-only   文面だけ入れる（SMTPは触らない）
//   node scripts/setup-auth-email.mjs --gmail --user あなた@gmail.com
//
// パスワードとトークンは、引数ではなく環境変数で受け取る。
// 引数に書くと、シェルの履歴と ps の出力に残ってしまうため。
//
//   printf "トークン: "; read -s SUPABASE_ACCESS_TOKEN; echo
//   printf "パスワード: "; read -s SMTP_PASS; echo
//   export SUPABASE_ACCESS_TOKEN SMTP_PASS
//
// 受け取った値は画面に出さないし、どこにも保存しない。

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const emails = join(here, "..", "supabase", "auth-emails");

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "ypnuxyfirlvbsqujocuy";
// 動作確認のときだけ、送り先を差し替えられるようにしてある。
const API_BASE = process.env.SUPABASE_API_URL ?? "https://api.supabase.com";
const API = `${API_BASE}/v1/projects/${PROJECT_REF}/config/auth`;

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const useGmail = args.includes("--gmail");
const skipConfirm = args.includes("--yes");
// すでに独自SMTPが入っている場合はこちら。送信の設定に触らず、文面だけ差し替える。
const templatesOnly = args.includes("--templates-only");

function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

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

function fail(...lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
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

function smtpSettings() {
  const pass = process.env.SMTP_PASS ?? "";
  if (!pass) {
    fail(
      "SMTP_PASS が設定されていません。次のように渡してください。",
      "",
      '  printf "パスワード: "; read -s SMTP_PASS; echo',
      "  export SMTP_PASS",
      "",
      "引数ではなく環境変数にするのは、シェルの履歴に残さないためです。"
    );
  }

  const senderName = process.env.SMTP_SENDER_NAME ?? argValue("--name", "親のもしもナビ");

  if (useGmail) {
    const user = process.env.SMTP_USER ?? argValue("--user");
    if (!user) {
      fail("Gmailのアドレスが要ります。 --user あなたのアドレス@gmail.com を付けてください。");
    }
    // Googleはアプリパスワードを "abcd efgh ijkl mnop" と空白入りで表示する。
    // そのまま貼られることが多いので、こちらで空白を落とす。
    const cleaned = pass.replace(/\s+/g, "");
    if (cleaned.length !== 16) {
      console.log(`※ アプリパスワードは16桁のはずですが、${cleaned.length}桁でした。`);
      console.log("  ふだんのGoogleのパスワードでは通りません。");
      console.log("  https://myaccount.google.com/apppasswords で作ったものを使ってください。");
      console.log("");
    }
    return {
      host: "smtp.gmail.com",
      port: "465",
      user,
      pass: cleaned,
      senderEmail: process.env.SMTP_SENDER_EMAIL ?? user,
      senderName
    };
  }

  const host = process.env.SMTP_HOST ?? argValue("--host");
  const user = process.env.SMTP_USER ?? argValue("--user");
  if (!host || !user) {
    fail("--host と --user が要ります。（例: --host mail01.onamae.ne.jp --user noreply@bee-ch.co.jp）");
  }
  return {
    host,
    port: process.env.SMTP_PORT ?? argValue("--port", "587"),
    user,
    pass,
    senderEmail: process.env.SMTP_SENDER_EMAIL ?? argValue("--from", user),
    senderName
  };
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    fail(
      "SUPABASE_ACCESS_TOKEN が設定されていません。",
      "トークンは https://supabase.com/dashboard/account/tokens で作れます。",
      "",
      '  printf "トークン: "; read -s SUPABASE_ACCESS_TOKEN; echo',
      "  export SUPABASE_ACCESS_TOKEN"
    );
  }

  const subjects = JSON.parse(readFileSync(join(emails, "subjects.json"), "utf8"));
  const confirmation = readFileSync(join(emails, "confirmation.html"), "utf8");
  const magicLink = readFileSync(join(emails, "magic_link.html"), "utf8");

  const before = await callApi(token, "GET");
  if (before.status === 401 || before.status === 403) {
    fail("トークンが受け付けられませんでした。作り直して、もう一度試してください。");
  }
  if (before.status !== 200) {
    fail(`設定を読めませんでした (${before.status})`, before.text.slice(0, 400));
  }
  describe(before.json);

  if (checkOnly) return;

  const smtp = templatesOnly ? null : smtpSettings();

  console.log("この内容で設定します:");
  if (smtp) {
    console.log(`  ${smtp.senderName} <${smtp.senderEmail}>`);
    console.log(`  ${smtp.host}:${smtp.port}  ユーザー名 ${smtp.user}`);
  } else {
    console.log("  送信の設定（SMTP）はそのまま。触りません。");
  }
  console.log(`  件名「${subjects.magic_link}」`);
  console.log("  文面 日本語（supabase/auth-emails/ の内容）");
  console.log("");

  if (templatesOnly && !before.json?.smtp_host) {
    console.log("※ 独自SMTPが入っていません。文面だけ入れても、届く相手が広がりません。");
    console.log("  --templates-only を外して、送信の設定も一緒に入れてください。");
    console.log("");
  }

  if (!(await confirm("進めますか [y/N]: "))) {
    console.log("中止しました。何も変えていません。");
    return;
  }

  const result = await callApi(token, "PATCH", {
    ...(smtp
      ? {
          smtp_host: smtp.host,
          smtp_port: String(smtp.port),
          smtp_user: smtp.user,
          smtp_pass: smtp.pass,
          smtp_admin_email: smtp.senderEmail,
          smtp_sender_name: smtp.senderName
        }
      : {}),
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
    if (templatesOnly) {
      console.error("文面だけの差し替えで弾かれています。トークンの権限を確認してください。");
    } else if (useGmail) {
      console.error("Gmailで弾かれる原因は、ほぼアプリパスワードです。");
      console.error("ふだんのGoogleのパスワードでは通りません。");
      console.error("https://myaccount.google.com/apppasswords");
    } else {
      console.error("サーバー名・ユーザー名・パスワードを確認してください。");
    }
    process.exit(1);
  }

  console.log("");
  console.log("設定しました。");
  describe(result.json);
  console.log("確認のしかた:");
  console.log("  本番の /home で、自分のアドレスにログイン用のリンクを送る。");
  console.log(`  件名が「${subjects.magic_link}」になっていれば成功。`);
}

main().catch((error) => {
  console.error("失敗しました:", error instanceof Error ? error.message : error);
  process.exit(1);
});
