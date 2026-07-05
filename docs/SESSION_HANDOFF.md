# セッション引き継ぎメモ

このファイルは、チャットが切れたり新しいチャットに移った場合でも作業を復元できるように、毎ステップ更新する。

## 現在の目的

「親のもしもナビ v0.3」を本番環境まで持っていく。

方針:

- Web入口: Next.js
- 継続アプリ: Expo
- DB/Auth/Storage: Supabase共通
- 発動サポートパック: Web/Stripe前提
- Expoアプリ内には外部Web決済CTAを置かない
- Family Plus等のアプリ内デジタル課金はIAP余地を残す

## 現在地

Step 1: 現状棚卸し 完了。

Step 2に入る前に、GitHubへ上げる準備中。

GitHub準備の進捗:

- `git init` 完了。
- 初回commit完了。
- commit: `47f6f57 Initial oyano moshimo v0.3 monorepo`
- `.env.example` をWeb/Mobileに追加済み。
- `.env`, `.env.local`, `node_modules`, `.next`, `.expo` はgit管理対象外。
- ユーザー判断でGitHub repo作成は後回し。
- GitHubなしでも進められる本番化作業を先に進める。
- ユーザーが「他の先進めれる？」と確認。
- Supabaseアカウント作成待ちの間、Stripe Checkout/Webhookの土台を先に実装する。

作成・更新済み:

- `docs/PRODUCTION_ROADMAP.md`
- `README.md`
- `docs/SESSION_HANDOFF.md`
- `apps/web/.env.example`
- `apps/mobile/.env.example`

確認済み:

- Web typecheck OK
- Mobile typecheck OK
- Next.js build OK
- Web dev server起動確認済み
- Expo Metro起動確認済み

## 実装済みの主な導線

Web:

- `/`
- `/start`
- `/diagnosis`
- `/result/[caseId]`
- `/result/[caseId]/share`
- `/support-pack`
- `/providers`
- `/admin`
- `/admin/cases`
- `/admin/cases/[id]`
- `/admin/support-packs`

Expo:

- `/(auth)/welcome`
- `/(tabs)/dashboard`
- `/people/[id]`
- `/people/[id]/tasks`
- `/people/[id]/status`
- `/people/[id]/assets`
- `/people/[id]/timeline`
- `/people/[id]/home`
- `/people/[id]/family`
- `/notifications`
- `/account/plan`

## 本番前に残っている重要課題

- WebはNext.js API経由でSupabase保存する構造に変更済み。ただしSupabase環境変数未設定時はlocalStorageフォールバック。
- Mobileはまだ `apps/mobile/lib/demoData.ts` のデモデータ表示。
- Supabase Authの実ログイン未接続。
- AdminはSupabase API読み取り優先に変更済み。`ADMIN_ACCESS_TOKEN` による簡易API保護は追加済み。本格的なSupabase Auth管理者権限は未接続。
- Supabase RLS policy SQLは作成済み。実プロジェクトへの適用は未実施。
- Stripe Checkout/Webhook API土台は実装済み。Stripeアカウント/環境変数/商品Price作成は未実施。
- Push通知送信ジョブ未実装。
- Supabase Storage写真アップロード未実装。

## 次にやること

まずGitHub準備。ただしユーザーが「とりあえず後でつくるから先進めてくれ」と言ったため、GitHub pushは保留。

現在分かっていること:

- このディレクトリはまだgit repositoryではなかった。
- 現在はgit repository化済み。
- GitHub CLI `gh` は入っているが、`dogwoodcommunity` のtokenがinvalid。
- そのため、ローカルgit初期化と初回commitまではCodex側で進められる。
- GitHubへのrepo作成/pushには、ユーザー側のGitHub再ログインが必要。

GitHubが必要な理由:

- VercelでNext.jsを本番公開する時、GitHub連携が最も安定する。
- 本番デプロイ履歴、rollback、環境変数管理、共同作業がしやすい。
- SupabaseやStripe接続後の変更履歴を安全に残せる。

現在の次作業:

- Web保存をNext.js API経由に変更する。完了。
- Supabase service role keyをサーバー側だけで使える構造にする。完了。
- Supabase本番用RLS SQLを準備する。完了。
- Supabase task template seed SQLを準備する。完了。
- `supabase/README.md` にSQL実行順と環境変数メモを追加。完了。
- Stripe Checkout/Webhookの土台を追加する。完了。
- Stripe SDK追加はpnpm storeの問題で一旦避け、Stripe REST API直叩きで実装。
- Stripe接続に必要なenvは `STRIPE_SECRET_KEY`, `STRIPE_SUPPORT_PACK_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`。
- AdminをSupabase API読み取り優先に変更。完了。
- Admin APIは `ADMIN_ACCESS_TOKEN` 設定時に `x-admin-token` が必要。
- Admin UIはlocalStorage `oyano_admin_token` をヘッダーに使う。未設定時はlocalStorageデモ表示にフォールバック。
- Admin API追加済み:
  - `GET /api/admin/cases`
  - `GET /api/admin/cases/[caseId]`
  - `GET /api/admin/support-packs`
- MobileにSupabaseデータ取得サービス `apps/mobile/lib/mobileData.ts` を追加。完了。
- Mobile dashboard/person/tasks はSupabaseがあれば実データ、なければdemoDataにフォールバック。
- Mobile Magic Link送信をSupabase Auth `signInWithOtp` に接続。Supabase未設定時はデモログインにフォールバック。
- Vercel設定 `vercel.json` を追加。Cronは `/api/cron/send-due-notifications` を30分ごとに叩く想定。
- Expo EAS設定 `apps/mobile/eas.json` を追加。
- デプロイ手順 `docs/DEPLOYMENT.md` を追加。
- Supabase Storage setup SQL `supabase/storage_setup.sql` を追加。
- Web API `POST /api/storage/home-photo-upload-url` を追加。
- Mobile写真アップロードservice `apps/mobile/lib/photoUpload.ts` を追加。
- Vercel Cron用API `GET /api/cron/send-due-notifications` を追加。Expo Push APIへ送信し、`scheduled_notifications` を `sent` に更新する。
- 本番化チェックリスト `docs/PRODUCTION_CHECKLIST.md` を追加。
- Web法務ページのひな形を追加:
  - `/legal/privacy`
  - `/legal/terms`
  - `/legal/tokushoho`
  - `/legal/disclaimer`
- Health check API `GET /api/health` を追加。
- Admin env確認 `GET /api/admin/env-check` と `/admin/env` を追加。
- GitHub Actions CI `.github/workflows/ci.yml` を追加。
- Supabase product seed `supabase/product_seed.sql` を追加。
- Supabase indexes `supabase/indexes.sql` を追加。
- Web handoff consume API `POST /api/handoff/consume` を追加。case_result tokenを検証し、family/person/tasksを生成してcaseをconvertedにする。
- Mobile `consumeWebHandoff` を追加し、welcome画面からWeb診断引き継ぎAPIを呼ぶ。
- 環境変数マトリクス `docs/ENVIRONMENT_MATRIX.md` を追加。
- Supabase task generation trigger `supabase/task_generation.sql` を追加。`person_status_events` 追加時に `task_templates` から未作成taskを生成し、`people.current_status` も同期する。
- Web Admin token保存UI `apps/web/components/AdminTokenControl.tsx` を追加。`ADMIN_ACCESS_TOKEN` 設定後、ブラウザlocalStorageに `oyano_admin_token` として保存し、Admin APIへ `x-admin-token` で送る。
- Web production smoke script `scripts/smoke-web.mjs` を追加。Vercel URLまたは `WEB_BASE_URL` を指定して主要ページ/APIの疎通確認ができる。
- GitHub Actions CIにWeb smoke stepを追加。build後にNext serverを起動して `scripts/smoke-web.mjs` を実行する。
- Mobile status画面を実person id対応に更新。`apps/mobile/lib/mobileData.ts` の `updatePersonStatus` から `person_status_events` に保存し、DB triggerでtasks生成につなぐ。
- Mobile tasks画面から `tasks.status` を更新できるようにした。完了時は `completed_at` と `updated_at` も保存する。
- Supabase task notification trigger `supabase/task_notification_generation.sql` を追加。task due_dateから前日9:00 JSTの `scheduled_notifications` を作成する。`scheduled_notifications` RLSも本人のall操作に更新。
- ローカル開発手順 `docs/LOCAL_DEVELOPMENT.md` と `scripts/local-doctor.mjs` を追加。`pnpm run doctor:local` で主要ファイル・env example・依存の存在を確認できる。
- Web Adminにローカルデモcase生成UI `apps/web/components/AdminLocalTools.tsx` を追加。Supabase未設定でも `/admin` からlocalStorage caseを作って詳細確認できる。
- Webデザインを刷新。生成画像 `apps/web/public/images/family-documents-hero.png` を追加し、トップをフルブリードヒーローに変更。`/start` のステータスカードと `/result/[caseId]` の結果・タスク・引き継ぎ表示もプロダクトUI寄りに再設計。
- Web `/diagnosis` を再設計。進捗レール、5つの入力セクション、ステップ番号、固定感のある送信エリアを追加し、フォーム単体感を減らした。

その後に Step 2: Supabase本番準備。

ユーザーにお願いしている作業:

1. GitHub CLI再ログインが必要になったら、ブラウザ認証を完了する
2. その後、Supabaseへログイン
3. 新規Project作成画面へ進む
4. Project名は `oyano-moshimo-prod` 推奨
5. Regionは `Northeast Asia / Tokyo` があればそれ、なければ近いアジアリージョン
6. 作成できたらユーザーが「作った」と返す

その後にやること:

1. `supabase/schema.sql` をSQL Editorで実行
2. `supabase/task_template_seed.sql` をSQL Editorで実行
3. `supabase/task_generation.sql` をSQL Editorで実行
4. `supabase/task_notification_generation.sql` をSQL Editorで実行
5. `supabase/product_seed.sql` をSQL Editorで実行
6. `supabase/indexes.sql` をSQL Editorで実行
7. `supabase/production_rls.sql` をSQL Editorで実行
8. `supabase/storage_setup.sql` をSQL Editorで実行
9. Auth Email Magic Link設定
10. 環境変数取得
11. WebからSupabase保存確認

## 運用ルール

- これ以降、各ステップの完了時にこのファイルを更新する。
- チャットが切れた場合、新チャットではまずこのファイルを読む。
- 判断や未決事項もここに残す。
