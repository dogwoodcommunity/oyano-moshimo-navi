# 本番化ロードマップ

## Step 1: 現状棚卸し

現在の実装は、Web/Expoの主要導線を確認できるMVPです。本番投入には、保存先・認証・管理権限・決済・通知を段階的に本番接続へ切り替える必要があります。

### そのまま活かせるもの

- Monorepo構成
  - `apps/web`: Next.js Web入口 + 管理画面
  - `apps/mobile`: Expo継続アプリ
  - `packages/shared`: 診断ロジック、ステータス、タスクテンプレート
  - `supabase/schema.sql`: Web/App共通DBスキーマ
  - `supabase/production_rls.sql`: 本番向けRLS policy
- Web導線
  - `/start`
  - `/diagnosis`
  - `/result/[caseId]`
  - `/result/[caseId]/share`
  - `/support-pack`
  - `/admin`
- Expo導線
  - login
  - dashboard
  - person
  - tasks
  - status
  - assets
  - timeline
  - home
  - family
  - notifications
  - plan
- 決済方針
  - 発動サポートパックはWeb/Stripe前提
  - Expoアプリ内に外部Web決済CTAを置かない
  - Family Plus等のアプリ内デジタル課金はIAP余地を残す

### 本番前に必ず直すもの

- Web保存
  - Next.js API経由でSupabase保存する実装済みです。
  - 本番環境変数未設定時だけlocalStorageフォールバックします。本番では `/admin/env` で未設定を潰します。
- Mobileデータ
  - dashboard/person/tasks/statusはSupabaseがあれば実データを読み、未設定時はdemoDataへフォールバックします。
  - timeline/home/family/assetsは画面土台あり。次はSupabase実データの読み書き範囲を増やします。
- Auth
  - Expo側はSupabase Auth `signInWithOtp` に接続済みです。
  - 本番ではSupabase Auth Redirect URLとEAS環境変数を設定して実機確認します。
- Admin
  - Admin APIはSupabaseのcase/support_packを読みます。`ADMIN_ACCESS_TOKEN` 設定時は `x-admin-token` が必要です。
  - 未設定時はlocalStorageデモ表示へフォールバックします。本番では必ず管理トークンを設定します。
- RLS
  - `supabase/production_rls.sql` を追加済みです。
  - 本番Project作成後にSQLを流し、主要テーブルで不要な公開読み取りができないことを確認します。
- Stripe
  - Checkout Session作成API、Webhook、`purchases`/`support_packs`更新の土台は実装済みです。
  - 本番ではStripe商品/Price/Webhook Secretを作り、テスト決済で `support_packs.status` が更新されることを確認します。
- Push通知
  - Expo push token保存、task due dates保存、通知送信Cron APIの土台は実装済みです。
  - 本番ではVercel Cron、timezone、再送、配信停止を確認します。
- Storage
  - Supabase Storage bucket作成SQL、アップロードURL API、Expo写真管理入口は実装済みです。
  - 本番では `home-photos` bucket、署名URL、削除権限を実データで確認します。

## Step 2: Supabase本番準備

次にやることはSupabaseプロジェクトを作り、DBスキーマを流し込むことです。

### 作業順

1. Supabaseで新規Projectを作成
2. SQL Editorで `supabase/schema.sql` を実行
3. SQL Editorで `supabase/task_template_seed.sql` を実行
4. SQL Editorで `supabase/task_generation.sql` を実行
5. SQL Editorで `supabase/task_notification_generation.sql` を実行
6. SQL Editorで `supabase/product_seed.sql` を実行
7. SQL Editorで `supabase/indexes.sql` を実行
8. SQL Editorで `supabase/production_rls.sql` を実行
9. SQL Editorで `supabase/storage_setup.sql` を実行
10. SQL Editorで `supabase/verify_setup.sql` を実行し、`ok=false` がないことを確認
11. AuthのEmail Magic Linkを有効化
12. WebとMobile用の環境変数を控える
13. ローカルWebからSupabaseへcaseが作成されるか確認

### このStepの完了条件

- Web `/start` で選んだcaseが `cases` に保存される
- Web `/diagnosis` の結果が `case_results` に保存される
- `/support-pack` からStripe Checkoutへ進み、決済前の `requested` と決済後の `paid` が `support_packs` に保存される
- Supabase上で不要な公開読み取りができない
- `SUPABASE_SERVICE_ROLE_KEY` はNext.jsサーバー側だけで使い、ブラウザやExpoに出さない

## Step 3以降

- Step 3: Supabase本番ProjectへSQL投入、Auth/Storage設定、環境変数取得
- Step 4: ローカルWeb/Appを本番Supabaseへ接続して `/start -> /diagnosis -> /result/[caseId]` とアプリ引き継ぎを確認
- Step 5: Stripe商品/Price/Webhookを作成し、テスト決済で `support_packs` とAdmin表示を確認
- Step 6: VercelへWeb deploy、`/admin/env` と `scripts/smoke-web.mjs <URL>` で本番疎通確認
- Step 7: EAS preview buildでMagic Link、dashboard/person/tasks、push token保存を実機確認
- Step 8: 法務表記、問い合わせ先、特商法表示、ストア提出情報を確定
