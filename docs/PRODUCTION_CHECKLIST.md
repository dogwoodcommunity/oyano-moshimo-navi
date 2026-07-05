# 本番化チェックリスト

## 1. GitHub

- [ ] GitHub private repoを作成
- [ ] `git remote add origin <repo-url>`
- [ ] `git push -u origin main`

## 2. Supabase

- [ ] Project `oyano-moshimo-prod` を作成
- [ ] `supabase/schema.sql` を実行
- [ ] `supabase/task_template_seed.sql` を実行
- [ ] `supabase/task_generation.sql` を実行
- [ ] `supabase/product_seed.sql` を実行
- [ ] `supabase/indexes.sql` を実行
- [ ] `supabase/production_rls.sql` を実行
- [ ] `supabase/storage_setup.sql` を実行
- [ ] Auth Email Magic Linkを有効化
- [ ] Site URL / Redirect URLにWeb/ExpoのURLを追加
- [ ] `docs/ENVIRONMENT_MATRIX.md` に沿って環境変数を設定
- [ ] `home-photos` bucket確認

## 3. Vercel

- [ ] GitHub repoをimport
- [ ] `vercel.json` の設定でbuildできることを確認
- [ ] 環境変数を設定
- [ ] `/admin/env` で設定漏れを確認
- [ ] `/start -> /diagnosis -> /result/[caseId]` を確認
- [ ] `/admin` を確認
- [ ] `/api/cron/send-due-notifications` を確認

## 4. Stripe

- [ ] Stripeアカウント作成
- [ ] 発動サポートパック商品を作成
- [ ] Price IDを `STRIPE_SUPPORT_PACK_PRICE_ID` に設定
- [ ] Webhook endpoint `/api/stripe/webhook` を登録
- [ ] `checkout.session.completed` を購読
- [ ] テスト決済で `support_packs` が `paid` になることを確認

## 5. Expo

- [ ] Expoアカウント作成
- [ ] EAS project作成
- [ ] `EXPO_PUBLIC_SUPABASE_URL` 設定
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` 設定
- [ ] Magic Linkログイン確認
- [ ] dashboard/person/tasksがSupabaseデータを読むことを確認
- [ ] Push token保存確認

## 6. セキュリティ

- [ ] `SUPABASE_SERVICE_ROLE_KEY` がブラウザ/Expoに出ていない
- [ ] `ADMIN_ACCESS_TOKEN` を本番に設定
- [ ] RLSが全主要テーブルで有効
- [ ] 銀行暗証番号・パスワード・マイナンバー画像を保存しない表示が残っている
- [ ] アプリ内に外部Web決済CTAがない

## 7. 公開前

- [ ] 利用規約
- [ ] プライバシーポリシー
- [ ] 特定商取引法表示
- [ ] 問い合わせ先
- [ ] 法律/税務判断の免責
