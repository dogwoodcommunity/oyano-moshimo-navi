# 初回メール登録なしのAI相談 — 実装と公開条件

2026-09-19。開発ブランチで実装・合成データ検証済み。本番未反映、既定OFF。

## 利用者の操作

1. 相談を書く →「AIに相談する」。この段階ではアカウント作成・保存・AI送信をしない。
2. 初回だけ、同じ画面で保存と外部AI送信への同意を選び「同意してAIに相談する」。
3. 安全確認後、識別可能なゲスト本人の保存先を作り、選択中の手帳を同期し、長期記憶を確認して相談する。
4. 回答は下に表示。次回は同じ保存先の記録・相談履歴を利用する。メール登録は後から任意で行える。

日記1件または既存の必要なプロフィール情報、同意、対象者/家族の権限、利用枠は引き続き確認する。
匿名のその場限りのAI回答には戻さない。保存や本人照合に失敗したらAI送信を止め、入力を残す。
POST後に結果が不明になった場合は再送を促さず、元の保存先で相談履歴を確認するよう案内する。

## 保存範囲と制限

- 初回同意した対象者だけを保存。別の手帳を勝手に追加しない。端末のbindingにcaseIdsを残し、
  Homeの同期と、メール登録後の同じユーザーの同期にも範囲を引き継ぐ。
- 写真の画像データは初回準備で送らない。既存のクラウド参照・メタデータは日記に含まれる。
- ゲストは家族招待の作成/参加・新たな写真アップロードを利用できない。API/RPC/Storageで拒否する。
- 未登録のままブラウザの保存データを消したり端末を変えたりすると、元の手帳を復元できない。
  クラウドにあることと、本人が再アクセスできることは別。画面にも説明する。
- メール追加は同じゲストuserIdへのupdateUser。別アカウントへの自動ログイン・自動統合はしない。
  登録済みメールとの競合、リンク先の本人不一致、期限切れは元の記録を置き換えず停止する。
- 既存のログインが失効した手帳に新しいゲストを上書きしない。複数タブの本人/保存先/記録/削除の変更を
  保存前後とAI送信前後に確認する。本人認証はサーバーgetUser、対象者/家族権限は既存APIで検証する。

## 本番有効化を止めている条件

**環境変数をtrueにするだけでは公開不可。既存Web/MobileログインへのCAPTCHA対応が未実装。**

SupabaseのCAPTCHAは匿名signupだけでなくOTP・magic-linkにも適用される。
現在のWebのsendMagicLink/sendAdminMagicLink、MobileのsignInWithOtpはcaptchaToken未対応。
このままプロジェクト全体でCAPTCHAを有効にすると、今の利用者のログインも失敗し得る。

公開前に必要なソース側の追加対応:

- WebのHome・家族・招待・プラン・退会・管理ログイン・MFA設定で共通の安全確認とトークン送信を実装。
- Mobileのwelcome・invite・handoffも対応。Webだけの検証で同じSupabaseプロジェクトを切り替えない。
- 使い切りトークンの再取得、期限切れ/拒否/広告ブロック/通信失敗時の再試行と入力保持を検証する。

一次資料（2026-09-19確認）:
[Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)、
[匿名認証](https://supabase.com/docs/guides/auth/auth-anonymous)、
[Authルーティング](https://github.com/supabase/auth/blob/master/internal/api/api.go)、
[CAPTCHA middleware](https://github.com/supabase/auth/blob/master/internal/api/middleware.go)。

## 承認後の環境設定・受入手順

本ターンでは以下を実行していない。対象プロジェクト・費用/利用枠・既存ログインへの影響を確認し、
設定変更と実送信の承認を得てから行う。現在の利用者データを検証用に使わない。

1. 上記のWeb/Mobile対応と回帰を完了する。
2. 既存の原子的レート制限RPC check_public_api_rate_limit と長期記憶/同意のSQLを確認。
   更新版 supabase/family_invite_rpc.sql → supabase/consult_guest_restrictions.sql を適用し、制限を確認する。
   admin_auth_hardening.sql/free_plan_member_limit.sqlの招待関数もゲスト拒否を維持した最新版を使う。
3. Cloudflare Turnstileのサイト/許可hostnameと、Supabaseの匿名認証・CAPTCHA等の必要設定を整える。
   本人昇格は実際の設定で同じuserIdになることを確認する。管理者APIによるCAPTCHA迂回をしない。
4. CONSULT_GUEST_ENABLED=falseのまま配信・既存ログイン回帰を先に確認する。
   NEXT_PUBLIC_TURNSTILE_SITE_KEY、既存Supabase設定、信頼できるプロキシのIPヘッダー上書きを確認。
5. 合成の新規本人で同意→安全確認→保存→相談→再読込→同じuserIdへのメール追加→復元/削除を確認。
   実メール1件/AI1回など実施範囲を先に定める。失敗・日次上限・他人の手帳拒否も確認する。
6. 受入後にCONSULT_GUEST_ENABLED=trueとする。公開URL、ログイン済み/未ログイン、新旧Web/Mobileを確認。

ゲスト作成APIは同一origin・小さなJSONのみ受け付け、IPハッシュ単位3件/日、API全体50件/日をDBで制限。
DB/ヘッダー不備では拒否し、ローカルメモリの制限へfallbackしない。UAを変えてもIP制限は同じ。
ただし公開Supabase Auth APIへの直接signupはこのAPI上限を通らない。
**50件はSupabaseプロジェクト全体の作成上限ではない。** プロバイダー側CAPTCHA・レート制限・
濫用監視/費用上限も必要。既存の無料相談1日1回やサービス全体のAI上限は変更しない。

OFFへ戻すと新規ゲスト作成は停止するが、既存ゲストの認証・記録・相談を一括停止/削除する機能ではない。
ロールバック時も利用者データやゲスト本人を一括削除しない。登録なし本人のデータ削除/保持方針と
セッションを失った場合の対応も、実運用の受入に含める。

## 今回の検証境界

- source-only 45項目、Web型・対象lint・production build成功。lint既存警告あり。
- scripts/test-consult-preparation.mjs: 実helperの70シナリオ（500件分割、範囲維持、本人/保存先/削除競合等）。
- scripts/test-consult-entry.mjs: 実TSX/handler、明示同意・連打・保存失敗・送信後不明時の履歴案内。
- scripts/test-guest-home-identity.mjs: 実Home/helperの本人照合、同じ本人へのメール追加、scope維持。
- scripts/test-consult-guest-route.mjs: 作成API/レート制限の合成検証。実Authを呼んでいない。
- 隔離Chrome320/390/1280px: 同意→相談→回答→再読込の履歴維持、保存失敗時の本文保持、
  横溢れなし・pageerror 0。Supabase/API/Turnstileは代替応答、外部通信0。
- 隔離PostgreSQL17: 招待作成/参加・Storage INSERT/UPDATEのゲスト拒否、登録済み互換性、
  別bucket不変更、3種類の招待SQLと制限SQL再適用を確認。既存CI SQL runnerへ回帰を追加。
- 実プロバイダーの安全確認・匿名認証・メール追加・実AI・本番DB・実スマホの受入は未実施。
  データ/課金/環境設定は変更していない。ローカル成功を本番の完了と扱わない。
