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
- [ ] `claim_due_scheduled_notifications` が `verify_compact.sql` でtrueになることを確認
- [x] `supabase/task_notification_generation.sql` を実行
- [x] `supabase/monthly_checkin_notifications.sql` を実行
- [ ] `supabase/notification_email_delivery.sql` を実行
- [ ] 既存本番DB向け一括SQL `supabase/production_pending_hardening.sql` を実行
- [ ] 個別実行する場合のみ `supabase/person_notebook_hardening.sql` を実行
- [ ] 個別実行する場合のみ `supabase/handoff_security_hardening.sql` を実行
- [x] 個別実行する場合のみ `supabase/handoff_consume_rpc.sql` を実行
  - 2026-09-03確認: security hotfix版を本番へ再適用し、`service_role=true`、`public/anon/authenticated=false` を確認。
- [x] Web更新前に `supabase/anonymous_diagnosis_rpc.sql` を実行
  - 2026-09-03確認: 本番へ新規適用し、両handoff RPCの存在・service-onlyと全security check trueを確認。
- [ ] アプリ単体開始用 `supabase/create_initial_family_person.sql` を実行
- [ ] 個別実行する場合のみ `supabase/sensitive_info_consent_hardening.sql` を実行
- [ ] 個別実行する場合のみ `supabase/home_photo_security_hardening.sql` を実行
- [ ] `pnpm smoke:production-consent https://oyano-moshimo-navi.vercel.app` で同意ログ保存を確認
  - 2026-07-09確認: 本番診断case作成は成功。ただし `cases.consent_to_sensitive_info` が本番DBに未作成のため、DB検証で失敗。`production_pending_hardening.sql` または `sensitive_info_consent_hardening.sql` の投入が必要。
- [x] `supabase/product_seed.sql` を実行
- [x] `supabase/indexes.sql` を実行
- [x] `supabase/production_rls.sql` を実行
- [x] `supabase/family_invite_rpc.sql` を実行
- [x] `supabase/admin_auth_hardening.sql` を実行
- [ ] `supabase/family_owner_succession.sql` を実行
- [ ] `supabase/account_deletion_pipeline.sql` を実行
  - 先に `supabase/notebook_diary_delete.sql`、`supabase/consult_daily_claim.sql`、`supabase/notebook_person_delete.sql` を適用し、実行後 `account_erasure_jobs`、server-only RPC、Storage/共有写真race guardを `verify_compact.sql` で確認する。
  - 共有家族に対象user名義の写真pathが残る依頼は `shared_photo_transfer_required` で停止する。自動引継ぎ機能が完成するまでは手動で完了にしない。
  - 破棄DBの `pnpm run test:account-erasure:sql`、管理者メールログイン、所有権移管の運用確認が終わるまで `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持する。
- [ ] Web更新前に `supabase/consult_daily_claim.sql` を実行し、`verify_compact.sql` で台帳・3 RPC・service-only ACLを確認
- [ ] Web更新前に `supabase/notebook_diary_delete.sql` を実行し、単一日記receipt・Storage cleanup job・復活防止guard・service-only ACLを確認
- [ ] Web更新前に `supabase/notebook_person_delete.sql` を実行し、対象者削除receipt・Storage cleanup job・復活防止guard・service-only ACLを確認
- [ ] `supabase/public_api_rate_limits.sql` を実行
- [ ] `supabase/anonymous_case_retention.sql` を実行
- [x] `supabase/storage_setup.sql` を実行
- [x] `supabase/verify_setup.sql` / `verify_compact.sql` で主要項目trueを確認
- [x] `supabase/api_grants.sql` を実行
- [x] Project URL / publishable key / service role keyをローカルenvに設定
- [ ] Auth Email Magic Linkの本番Redirect URL最終確認
- [x] `home-photos` bucket確認

## 3. Vercel

- [x] GitHub repoをimport
- [x] `vercel.json` の設定でbuildできることを確認
- [x] 2026-09-03 security hotfixをVercel productionへ反映
  - deployment `dpl_Ee9pXkdFrSD5RtyFVUXgGj6pe5ac`、公開alias `https://oyano-moshimo-navi.vercel.app`、READYを確認。
- [x] 環境変数を設定
- [x] `/admin/env` で設定漏れを確認
- [x] `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` を実行
- [x] `/start -> /diagnosis -> /result/[caseId]` を確認
- [x] `/admin` を確認
- [ ] `/admin/delete-requests` で、共有家族ownerは完全削除が停止し、所有権移管後のみ再開できることを2アカウントで確認
- [ ] 単独テストアカウントでAuth・DB・Storageの削除と再実行時の冪等性を確認後、削除運用を開始
- [x] app_admin個別アカウントを作成し、Admin APIをBearer認証で確認
  - 2026-07-09監査対応: Admin判定は `family_members` から `app_admins` 専用テーブルへ変更。
  - 2026-07-09再確認: `scripts/smoke-admin-bearer.mjs` で一時 `app_admins` 行を作成し、`/api/admin/env-check` がBearer認証を受け付けることを確認。確認後、一時データは削除済み。
- [x] `/api/cron/send-due-notifications` をdeploy対象に含める
- [ ] Resend送信ドメインを認証し、`RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` を設定
- [ ] 期限通知メールと月1確認メールをテスト受信し、通知OFF後は送られないことを確認
- [x] `/api/cron/purge-anonymous-cases` をdeploy対象に含める
- [ ] `/api/cron/cleanup-notebook-storage` と `/api/cron/cleanup-person-notebook-storage` をdeploy対象に含め、本番の登録・直近成功・失敗通知を確認
- [ ] Stripe関連env 3項目を設定

## 4. Stripe

- [ ] Stripeアカウント作成
- [ ] 発動サポートパック商品を作成
- [ ] Price IDを `STRIPE_SUPPORT_PACK_PRICE_ID` に設定
- [ ] Webhook endpoint `/api/stripe/webhook` を登録
- [ ] `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` を購読
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
- [x] 実家写真のアップロードURL発行を認証・家族権限チェック付きに変更
- [ ] 本番DBで `consent_to_sensitive_info` と `consent_logs` の保存を実弾確認
- [ ] 更新済み `handoff_consume_rpc.sql` → `anonymous_diagnosis_rpc.sql` の順に適用し、変換済みcaseの再診断・owner追加拒否を確認
- [x] アプリ内に外部Web決済CTAがない
- [x] 公開APIにレート制限を追加
- [ ] 本番DBで `public_api_rate_limits.sql` を投入し、DB側レート制限を有効化
- [ ] 本番DBで `anonymous_case_retention.sql` を投入し、匿名診断の保持期限削除を有効化
- [ ] 破棄DBで `test:diary-deletion:sql`、`test:person-deletion:sql`、`test:account-erasure:sql` を通し、本番では2端末から削除済み記録が復活しないことを確認
- [ ] Supabase DB/AuthとStorage object本体を別々にバックアップし、隔離環境で復元を完走

## 7. 公開前

- [x] 利用規約の叩き台
- [x] プライバシーポリシーの叩き台
- [x] 特定商取引法表示の叩き台
- [x] 公開する運営者名を `株式会社BEECH` と確定し、`LEGAL_BUSINESS_NAME` の設定値として記録
- [x] 公開する責任者を `代表取締役 池田哲也` と確定し、`LEGAL_RESPONSIBLE_PERSON` の設定値として記録
- [x] 利用者向け問い合わせ先を `info@bee-ch.co.jp` と確定し、`LEGAL_CONTACT` の設定値として記録
- [x] 問い合わせ対応を「メール受付：24時間／原則3営業日以内に返信」と確定
- [x] 利用規約の施行日は正式公開日と同日にする方針を確定
- [x] プライバシーポリシーの施行日は正式公開日と同日にする方針を確定
- [x] アカウント削除対応の主担当を `代表取締役 池田哲也` と確定
- [x] アカウント削除対応の代行者名を `池田知也` と確定
- [x] 代行者 `池田知也` の会社・運用上の役職を `システム責任者` と確定
- [x] アカウント削除対応の代行者の責任範囲を「主担当不在時に削除依頼の受付・本人確認・実行担当への引継ぎを代行。本番削除は登録済みapp_adminと別確認者の二者で実施」と確定
- [ ] アカウント削除対応の主担当・代行者の内部連絡手段を制限付き運用台帳へ記録
- [ ] 削除実行者の本人確認済みSupabase Auth／`app_admins` 登録と、削除ごとの別確認者・二者確認手順を確定
- [x] 障害対応の主責任者を `代表取締役 池田哲也` と確定
- [x] 障害対応の代行者名を `池田知也` と確定
- [x] 障害対応代行者の責任範囲を「主責任者不在時の連絡・初動判断の代行。本番操作は別途権限を持つ担当者が実施」と確定
- [x] 障害対応代行者の役職を `システム責任者` と確定
- [ ] 障害対応の内部連絡手段・緊急連絡網を制限付き運用台帳へ記録
- [ ] Vercel・Supabase・Cron・外部uptime監視の通知先とエスカレーション経路を設定し、テスト通知を確認
- [ ] 平日・夜間・休日の当番時間と対応範囲を確定し、ack目標を演習で確認
- [ ] Vercel・Supabase・GitHub・Resend等の本番実行者、権限範囲、MFA、二者確認、緊急時アクセス回復方法を制限付き運用台帳へ記録
- [ ] 障害時の最終承認者と、主責任者不在時に代行者が承認できる範囲を確定
- [ ] 正式公開日が決まり次第、`LEGAL_TERMS_EFFECTIVE_DATE` に日本時間の実日付を入力
- [ ] 正式公開日が決まり次第、`LEGAL_PRIVACY_EFFECTIVE_DATE` に日本時間の実日付を入力
- [ ] 本番環境へ確定済みの事業者名・責任者・問い合わせ先・返信目安、規約・プライバシーの発効日を正式情報で設定
- [ ] 有料受付を開く前に、所在地、電話番号、税込価格、提供時期、解約・返金条件を正式情報で設定
- [ ] 公開フッターから問い合わせ窓口へ到達し、実際に受け付けられることを確認
- [x] 法律/税務判断の免責
- [ ] 弁護士による最終確認
