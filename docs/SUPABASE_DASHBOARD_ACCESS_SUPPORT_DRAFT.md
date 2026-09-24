# Supabase管理画面の本人確認 — 問い合わせ記録（送信済み）

2026-09-19。本人が問い合わせと送信元アドレスを承認し、Gmailから1通送信済み。
Gmailの「メッセージを送信しました」を確認。22:16 JSTの受付メールでticket `SU-478850`を確認。
担当者による復旧手順の回答・本人確認完了/復旧は未確認。
受付メールには、直接メールは有料組織に紐づかずFree扱い・回答保証なし、契約に応じた優先対応は
Dashboardのsupport form経由と記載。実契約がFreeであるという証拠ではない。追加契約/再送信はしていない。
Supabase登録メールは未確認と本文に明示。以下は問い合わせ本文の記録（個人の送信元表記は省略）。
認証コード・パスワード・APIキー・手帳データは添付しない。

宛先: support@supabase.com

件名: Unable to complete Dashboard MFA — project ypnuxyfirlvbsqujocuy

本文:

Hello Supabase Support,

I can complete the GitHub sign-in step, but the Supabase Dashboard then asks for a TOTP code from a factor named "Supabase TENSHOKU（iPhone）".

I cannot find an identifiable Supabase/TENSHOKU entry in Google Authenticator after checking my multiple Google accounts, or in Apple Passwords on my iPhone. I do not know which app was used when this factor was enrolled.

The project I need to manage is `ypnuxyfirlvbsqujocuy` (oyano-moshimo-navi).

I have not yet confirmed the email address associated with the GitHub-based Supabase account. Please advise what information you need to verify the account/project ownership and what legitimate access-recovery options are available.

Please do not delete or recreate the project or change any production data. I understand that recovery may not be possible if all second factors have been lost. I am requesting guidance, not a bypass of MFA.

Thank you.

## 根拠と限界

- [登録した認証方法が分からない場合の公式案内](https://supabase.com/docs/guides/troubleshooting/lost-accessforgot-the-mfa-device-nAPT-7)
- [ログインできない場合の公式問い合わせメール案内](https://supabase.com/docs/guides/troubleshooting/i-am-not-receiving-password-reset-emails-for-supabase-dashboard--cO5yf)
- 画面のfactor名は確認できたが、利用した認証アプリや全認証要素の喪失は断定していない。
- アプリ内の削除管理者MFAとSupabase Dashboard MFAは別。アプリ用コードを流用しない。
- 既存のSupabase管理アカウントの登録メールは未確認。別サービスのメールやCLI認証から推定しない。
