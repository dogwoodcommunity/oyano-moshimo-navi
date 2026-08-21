/**
 * Supabaseの認証エラーを、受け取る人に通じる日本語へ直す。
 *
 * これまでは error.message をそのまま画面に出していた。届くのは
 * "Email address cannot be used as it is not authorized" のような英語で、
 * 親が入院した直後の家族が読んで意味が取れるものではない。
 * 何が起きたのかも、次に何をすればいいのかも分からないまま終わってしまう。
 */

export type AuthErrorLike = {
  code?: string;
  status?: number;
  message?: string;
};

const FALLBACK = "確認メールを送れませんでした。少し時間をおいて、もう一度お試しください。";

/**
 * 独自SMTPを設定していないSupabaseプロジェクトは、
 * 組織のメンバーとして登録されたアドレスにしかメールを送れない。
 * それ以外の人が入れると、送信そのものが拒否される。
 *
 * つまり、この文言が出ている間は、開発者以外はログインできない。
 * 利用者に「あなたの入力が悪い」と読める文言を出してはいけないので、
 * こちら側の準備不足だと分かる書き方にする。
 */
const NOT_AUTHORIZED =
  "このメールアドレスにはまだお送りできません。準備中のため、いまは限られたアドレスにしか届きません。手帳への記録は、ログインしなくてもこれまで通り使えます。";

const RATE_LIMITED =
  "メールの送信が続いたため、少しの間おやすみしています。10分ほど待ってから、もう一度お試しください。";

const TOO_SOON = "続けて送ることはできません。少し待ってから、もう一度お試しください。";

const INVALID_EMAIL = "メールアドレスの形を確認してください。";

const SIGNUP_DISABLED = "いまは新しい登録を受け付けていません。手帳への記録はこれまで通り使えます。";

const OFFLINE = "通信できませんでした。電波の届くところで、もう一度お試しください。";

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return FALLBACK;

  const code = (error.code ?? "").toLowerCase();
  const text = (error.message ?? "").toLowerCase();

  // コードがある場合はそちらを優先する。文面はSupabase側の都合で変わりうる。
  if (code === "email_address_not_authorized") return NOT_AUTHORIZED;
  if (code === "over_email_send_rate_limit") return RATE_LIMITED;
  if (code === "over_request_rate_limit") return TOO_SOON;
  if (code === "otp_disabled" || code === "signup_disabled") return SIGNUP_DISABLED;
  if (code === "validation_failed" || code === "email_address_invalid") return INVALID_EMAIL;

  if (text.includes("not authorized")) return NOT_AUTHORIZED;
  if (text.includes("email rate limit") || text.includes("rate limit exceeded")) return RATE_LIMITED;
  // "For security purposes, you can only request this after 46 seconds."
  if (text.includes("for security purposes")) return TOO_SOON;
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) return SIGNUP_DISABLED;
  if (text.includes("invalid format") || text.includes("unable to validate email")) return INVALID_EMAIL;
  if (text.includes("failed to fetch") || text.includes("network")) return OFFLINE;

  if (error.status === 429) return TOO_SOON;

  return FALLBACK;
}
