# 本番化チェックリスト

## 1. GitHub

- [x] GitHub repoを作成
- [x] `git remote add origin <repo-url>`
- [x] `git push -u origin main`
- [x] Repository: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`

## 2. Supabase

- [x] Production Projectを作成
- [x] Region: Northeast Asia (Tokyo)
- [x] `supabase/schema.sql` を実行
- [x] `supabase/task_template_seed.sql` を実行
- [x] `supabase/task_generation.sql` を実行
- [x] `supabase/notification_delivery_hardening.sql` を実行
- [x] `supabase/task_notification_generation.sql` を実行
- [x] `supabase/monthly_checkin_notifications.sql` を実行
- [ ] 既存本番DB向け一括SQL `supabase/production_pending_hardening.sql` を実行
- [ ] 個別実行する場合のみ `supabase/handoff_security_hardening.sql` を実行
- [ ] 個別実行する場合のみ `supabase/sensitive_info_consent_hardening.sql` を実行
- [ ] `pnpm smoke:production-consent https://oyano-moshimo-navi.vercel.app` で同意ログ保存を確認
- [x] `supabase/product_seed.sql` を実行
- [x] `supabase/indexes.sql` を実行
- [x] `supabase/production_rls.sql` を実行
- [x] `supabase/family_invite_rpc.sql` を実行
- [x] `supabase/storage_setup.sql` を実行
- [x] `supabase/verify_setup.sql` / `verify_compact.sql` で主要項目trueを確認
- [x] `supabase/api_grants.sql` を実行
- [x] Project URL / publishable key / service role keyをローカルenvに設定
- [ ] Auth Email Magic Linkの本番Redirect URL最終確認
- [x] `home-photos` bucket確認

## 3. Vercel

- [x] GitHub repoをimport
- [x] `vercel.json` の設定でbuildできることを確認
- [x] 環境変数を設定
- [x] `/admin/env` で設定漏れを確認
- [x] `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` を実行
- [x] `/start -> /diagnosis -> /result/[caseId]` を確認
- [x] `/admin` を確認
- [x] `/api/cron/send-due-notifications` をdeploy対象に含める
- [ ] Stripe関連env 3項目を設定

## 4. Stripe

- [ ] Stripeアカウント作成
- [ ] 発動サポートパック商品を作成
- [ ] Price IDを `STRIPE_SUPPORT_PACK_PRICE_ID` に設定
- [ ] Webhook endpoint `/api/stripe/webhook` を登録
- [ ] `checkout.session.completed` を購読
- [ ] テスト決済で `support_packs` が `paid` になることを確認

## 5. Expo

- [x] Expoアカウント作成
- [x] EAS project作成
- [x] `EXPO_PUBLIC_SUPABASE_URL` 設定
- [x] `EXPO_PUBLIC_SUPABASE_ANON_KEY` 設定
- [x] Push通知を使う場合は `EXPO_PUBLIC_EAS_PROJECT_ID` 設定
- [ ] Magic Linkログイン確認
- [ ] dashboard/person/tasksがSupabaseデータを読むことを確認
- [ ] Push token保存確認
- [x] EASログイン確認
- [x] `pnpm run eas:mobile:init`
- [x] `pnpm run eas:mobile:set-project-id -- <Expo Project ID>`
- [x] Android preview buildを作成
- [x] Android preview build 4回目 `c761577d-79b9-4740-ab98-fc664c106561` 成功。Install URL: `https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi/builds/c761577d-79b9-4740-ab98-fc664c106561`
- [ ] iOS preview buildを作成

## 6. セキュリティ

- [x] `SUPABASE_SERVICE_ROLE_KEY` がブラウザ/Expoに出ていない
- [x] `ADMIN_ACCESS_TOKEN` を本番に設定
- [x] RLSが全主要テーブルで有効
- [x] 銀行暗証番号・パスワード・マイナンバー画像を保存しない表示が残っている
- [x] Web診断で要配慮情報の理解・最小限入力への同意を必須化
- [ ] 本番DBで `consent_to_sensitive_info` と `consent_logs` の保存を実弾確認
- [x] アプリ内に外部Web決済CTAがない

## 7. 公開前

- [x] 利用規約の叩き台
- [x] プライバシーポリシーの叩き台
- [x] 特定商取引法表示の叩き台
- [ ] 事業者名、代表者、住所、電話番号、問い合わせ先の正式情報
- [x] 法律/税務判断の免責
- [ ] 弁護士による最終確認
