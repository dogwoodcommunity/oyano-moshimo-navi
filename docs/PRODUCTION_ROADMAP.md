# 本番化ロードマップ

## Step 1: 現状棚卸し

現在の実装は、Web/Expoの主要導線を確認できるMVPです。本番投入には、保存先・認証・管理権限・決済・通知を段階的に本番接続へ切り替える必要があります。

### そのまま活かせるもの

- Monorepo構成
  - `apps/web`: Next.js Web入口 + 管理画面
  - `apps/mobile`: Expo継続アプリ
  - `packages/shared`: 診断ロジック、ステータス、タスクテンプレート
  - `supabase/schema.sql`: DBスキーマ草案
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
  - 現状は `localStorage` が主で、Supabaseは環境変数がある場合だけ書き込みます。
  - 本番ではSupabase保存を主にし、localStorageは一時保存またはフォールバック扱いにします。
- Mobileデータ
  - 現状は `apps/mobile/lib/demoData.ts` のデモデータ表示です。
  - 本番ではログインユーザーの `families`, `people`, `tasks`, `timeline_events`, `homes` をSupabaseから取得します。
- Auth
  - Magic Link風の画面はありますが、実際のSupabase Authログイン処理は未接続です。
- Admin
  - 現状はブラウザlocalStorageのcase確認です。
  - 本番ではSupabaseからcase/support_packを読み、管理者だけが閲覧できる制御が必要です。
- RLS
  - `supabase/schema.sql` はテーブル定義中心で、RLS policyは未設定です。
  - 本番では全テーブルでRLSを有効にし、家族単位・管理者単位のpolicyを追加します。
- Stripe
  - 現状はCheckout開始の接続点だけです。
  - 本番ではCheckout Session作成API、Webhook、`purchases`/`support_packs`更新が必要です。
- Push通知
  - Expo push token保存と予定通知テーブルへの保存枠はあります。
  - 本番では通知送信ジョブ、timezone、再送、配信停止が必要です。
- Storage
  - 写真管理画面の入口はあります。
  - 本番ではSupabase Storage bucket、アップロード、署名URL、削除権限が必要です。

## Step 2: Supabase本番準備

次にやることはSupabaseプロジェクトを作り、DBスキーマを流し込むことです。

### 作業順

1. Supabaseで新規Projectを作成
2. SQL Editorで `supabase/schema.sql` を実行
3. SQL Editorで `supabase/task_template_seed.sql` を実行
4. SQL Editorで `supabase/production_rls.sql` を実行
5. AuthのEmail Magic Linkを有効化
6. WebとMobile用の環境変数を控える
7. Storage bucketを作成
8. ローカルWebからSupabaseへcaseが作成されるか確認

### このStepの完了条件

- Web `/start` で選んだcaseが `cases` に保存される
- Web `/diagnosis` の結果が `case_results` に保存される
- `/support-pack` の依頼が `support_packs` に保存される
- Supabase上で不要な公開読み取りができない
- `SUPABASE_SERVICE_ROLE_KEY` はNext.jsサーバー側だけで使い、ブラウザやExpoに出さない

## Step 3以降

- Step 3: WebをSupabase主保存に変更
- Step 4: AdminをSupabase読み取り + 管理者制限に変更
- Step 5: MobileをSupabase Auth + 実データ取得に変更
- Step 6: Stripe Checkout/Webhook実装
- Step 6補足: Checkout/Webhook APIの土台は追加済み。Stripeアカウント作成後に `STRIPE_SECRET_KEY`, `STRIPE_SUPPORT_PACK_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` を入れる。
- Step 7: Push通知ジョブ実装
- Step 8: Vercel/EAS/Store公開準備
