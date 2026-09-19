# Supabase管理画面の本人確認 — 問い合わせ下書き

2026-09-19。未送信。登録アカウント/送信元を確認し、本人承認後に送る。
認証コード・パスワード・APIキー・手帳データは添付しない。

宛先: support@supabase.com

件名: Unable to complete Dashboard MFA — guidance on available access recovery options

本文:

Hello Supabase Support,

I can complete the GitHub sign-in step, but the Supabase Dashboard then asks for a TOTP code from a factor named "Supabase TENSHOKU（iPhone）".

I cannot locate this factor in my authenticator app or in Apple Passwords on my iPhone. I am not sure which app was used during enrollment. Could you advise what legitimate account-access or ownership-verification options are available in this situation?

The project I need to manage is `ypnuxyfirlvbsqujocuy` (oyano-moshimo-navi).

Please do not delete or recreate the project or change any production data. I understand that recovery may not be possible if all second factors have been lost. I am requesting guidance, not a bypass of MFA.

Thank you.

## 根拠と限界

- [登録した認証方法が分からない場合の公式案内](https://supabase.com/docs/guides/troubleshooting/lost-accessforgot-the-mfa-device-nAPT-7)
- [ログインできない場合の公式問い合わせメール案内](https://supabase.com/docs/guides/troubleshooting/i-am-not-receiving-password-reset-emails-for-supabase-dashboard--cO5yf)
- 画面のfactor名は確認できたが、利用した認証アプリや全認証要素の喪失は断定していない。
- アプリ内の削除管理者MFAとSupabase Dashboard MFAは別。アプリ用コードを流用しない。
- 既存のSupabase管理アカウントの登録メールは未確認。別サービスのメールやCLI認証から推定しない。
