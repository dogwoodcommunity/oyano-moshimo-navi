# 本番化チェックリスト

## 2026-09-05 終了条件の再整理

無料Web正式版（Stage A）を先に完成させる。有料受付（Stage B）・ストア公開（Stage C）は別段階。
DBの4件は本番適用・構造検査済み。Web更新と正式公開の残条件は別。最新の実行記録は `SESSION_HANDOFF.md` 追記335を参照。

- [x] 前回の限定commit `35bc7a9` をGitHubへpushしCI成功を確認（run `33954325618`）。deploy workflowのdeploy jobはskipであり、本番反映ではない
- [x] 本番照合で判明した月次ACL/相談UUID修正とlint設定を含む `539c359` をpushしCI成功を確認（run `33955341444`）。対応deploy jobもskip。Vercel CLI再ログインも必要
- [x] 本番の家族権限・家族管理RPC・原子的な1日1回相談RPCをread-onlyで検査し、**不足を確認したものだけ**承認後にDB-first適用。2026-09-05、適用直前の再照合・家族role補正0件guard・適用後検査を実施
- [x] 月次通知関数の旧alias/明示EXECUTE残存を確認して修正版を適用。関数本文のソース一致とservice-onlyを読み取り確認。通知生成・送信の試験実行はしていない
- [ ] 確定済みの運営者・責任者・問い合わせ先・返信目安4値を本番へ設定してWebを反映。施行日は公開日確定まで未設定のまま、準備中と表示
- [ ] 新しい読み取り専用「アクセス権限を確認する」で本人sessionの5 API応答を確認。コード・疑似テストのPASSを本人認証の実測に代用しない
- [ ] 専用テストアカウントで保存・別端末復元・家族の閲覧/編集境界・写真・削除を実機で完走
- [ ] DB/Auth・Storage別バックアップと隔離復旧、問い合わせ受信/返信、障害通知の実受信を確認
- [ ] 法務最終確認、正式公開日、運用担当・連絡方法を確定して最終判定

`node scripts/test-stage-a-local.mjs` はソース/runtime・lint・型・隔離DB・buildをまとめて検査する。
ESLint設定と依存、pnpm 9.15.9固定を追加し、2026-09-05に全38項目のLOCAL_PASSを確認した。
本番DBで不足していた家族権限helper・家族管理5 RPC・日次相談3 RPCと月次通知修正は、
2026-09-05の直前承認後に適用した。10関数の正規化本文が承認済みソースと一致し、
`verify_stage_a_release.sql` の12項目がすべてok。Web反映はVercel再ログイン待ち。
このローカル合格や `--source-only` / `--sql-only` の
部分PASSや、2つの疑似端末による同期試験だけで正式公開・実機復元を完了扱いにしない。

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
- [x] `claim_due_scheduled_notifications` が `verify_compact.sql` でtrueになることを確認
  - 履歴整合: 2026-07-09の `SESSION_HANDOFF.md` 追記35でtrueを確認済み。現在の配信成功・メール実受信の証明とは別。
- [x] `supabase/task_notification_generation.sql` を実行
- [x] `supabase/monthly_checkin_notifications.sql` を実行
  - 2026-09-05: profiles.idへの相関修正とanon/authenticatedの明示EXECUTE剥奪版をtransaction内で適用。service-only・unique index・本文一致を確認。通知の生成/送信は未実行。
- [ ] `supabase/notification_email_delivery.sql` を実行
- [x] 既存本番DB向け一括SQL `supabase/production_pending_hardening.sql` を実行
  - 履歴整合: 2026-07-09の引き継ぎ追記34で成功、追記35で主要項目true。現在の新規migrationまで適用済みという意味ではない。
- [ ] 個別実行する場合のみ `supabase/person_notebook_hardening.sql` を実行
- [ ] 個別実行する場合のみ `supabase/handoff_security_hardening.sql` を実行
- [x] 個別実行する場合のみ `supabase/handoff_consume_rpc.sql` を実行
  - 2026-09-03確認: security hotfix版を本番へ再適用し、`service_role=true`、`public/anon/authenticated=false` を確認。
- [x] Web更新前に `supabase/anonymous_diagnosis_rpc.sql` を実行
  - 2026-09-03確認: 本番へ新規適用し、両handoff RPCの存在・service-onlyと全security check trueを確認。
- [ ] アプリ単体開始用 `supabase/create_initial_family_person.sql` を実行
- [ ] 個別実行する場合のみ `supabase/sensitive_info_consent_hardening.sql` を実行
- [ ] 個別実行する場合のみ `supabase/home_photo_security_hardening.sql` を実行
- [x] `pnpm smoke:production-consent https://oyano-moshimo-navi.vercel.app` で同意ログ保存を確認
  - 履歴整合: 2026-07-09の初回失敗は追記36のWeb再反映後に解消。診断、case同意列、consent_logsの3項目が成功した。今回の新規実行ではない。
- [x] `supabase/product_seed.sql` を実行
- [x] `supabase/indexes.sql` を実行
- [x] `supabase/production_rls.sql` を実行
- [x] `supabase/family_invite_rpc.sql` を実行
- [x] `supabase/family_role_hardening_20260904.sql` を実行
  - 2026-09-05: editor helper・public 6 policy・Storage 2 policyを適用し、USING/WITH CHECK・RLSの構造照合を含む本番verifierでokを確認。実機の家族権限操作試験は別の未完了条件。
- [x] `supabase/family_management_rpc.sql` を実行
  - 2026-09-05: 5 RPC・直接書込権限閉鎖を適用。補正対象0件をlock/guard下で再確認。初回は転送不一致をsource guardが検知してROLLBACKし、未反映確認後に承認済み本文へ修正して成功。5関数の本文一致・ACLを再確認。
- [x] `supabase/admin_auth_hardening.sql` を実行
- [x] `supabase/account_delete_executor_role.sql` を実行
  - 2026-09-04確認: 本番へ適用し、migration単体ではユーザー作成・権限付与をせず、`account_delete_executors` のRLS/ACL、認可helperを含む読み取り専用13項目を確認。
- [x] `supabase/account_delete_identity_ledger.sql` を1回だけ実行し、DB owner専用・追記専用・API role権限なしを確認
  - 2026-09-05確認: 本番へ1回限り適用。migration適用直後はprivate台帳0件、全ownerが`postgres`、FORCE RLS、owner以外のACLなし、API 3 roleの権限なし、制約6・列9・非internal trigger 2をread-only検査し、全項目PASS。既存データへの変更・削除なし。
- [ ] `supabase/family_owner_succession.sql` を実行
- [x] `supabase/account_deletion_pipeline.sql` を実行
  - 先に `supabase/notebook_diary_delete.sql`、`supabase/consult_daily_claim.sql`、`supabase/notebook_person_delete.sql`、`supabase/account_delete_executor_role.sql` を適用し、実行後 `account_erasure_jobs`、server-only RPC、Storage/共有写真race guardを `verify_compact.sql` で確認する。ここまでは既存pipelineの適用実績であり、DB owner one-shot control・1回限りgrantの本番適用実績ではない。
  - 共有家族に対象user名義の写真pathが残る依頼は `shared_photo_transfer_required` で停止する。自動引継ぎ機能が完成するまでは手動で完了にしない。
  - 破棄DBの `pnpm run test:account-erasure:sql`、削除専用認可回帰、個別メール/TOTPログイン、所有権移管の運用確認が終わるまで `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持する。
- [x] `supabase/account_erasure_execution_gate.sql` を既存pipelineの後にDB-firstで1回適用
  - 2026-09-05確認: 本番適用後の読み取り専用12項目PASS。v2 RPC存在/service-only、旧v1 service role権限失効、executor生table・private control/grant表・control開閉関数の全API role権限なし、private表FORCE RLSを確認。controlは1行・active 0件、grant・削除依頼・削除jobは各0件、有効な削除専用実行者は1件。同日に対応Webも本番反映済み。更新後の本人認証済み・AAL2・空一覧・一般Admin画面拒否は確認済み。HTTP数値の直接再採取、非空依頼の応答最小化、別確認者のAAL2と完全削除E2Eは未完了で、実行スイッチはOFFを維持する。
  - 対応Webより先に適用し、private `account_erasure_execution_control` / grant表と `open_account_erasure_execution_control_v1` / `close_account_erasure_execution_control_v1` がDB owner専用、`verify_account_delete_operator_v2` / `inspect_account_erasure_v2` / `prepare_account_erasure_v2` / `update_account_delete_request_status_v2` / `issue_account_erasure_execution_grant_v1` / `inspect_account_erasure_execution_grant_v1` / `execute_account_erasure_database_v2` がservice-only、`account_delete_executors` 生tableのSELECTと旧 `inspect_account_erasure_v1` / `prepare_account_erasure_v1` / `update_account_delete_request_status_v1` / 3引数 `execute_account_erasure_database_v1` がservice role実行不可であることをread-onlyで確認する。
  - v2 inspect/prepareはblockerを正規化codeと数値件数だけで返し、`familyId`、`familyName`、Storage object/prefixの生pathを応答に含めないことを破棄DBで確認する。
  - migration直後のcontrolがclosed、DB ownerだけが60〜900秒で開け、service/Web roleから開閉できないことを確認する。durable prepareは1時間で失効し、別確認者のgrantはrequest/target/job/hash/operatorとcontrol epochに固定した最大10分・1回限りで、grant期限がcontrol残時間を超えないことを確認する。
- [x] Web更新前に `supabase/consult_daily_claim.sql` を実行し、`verify_stage_a_release.sql` で台帳・3 RPC・service-only ACLを確認
  - 2026-09-05: native UUID対応版を適用し、3関数の本文一致も確認。本番で相談RPCを試験実行しておらず、実AI回答/保存の端末E2Eは未完了。
- [x] Web更新前に `supabase/notebook_diary_delete.sql` を実行し、単一日記receipt・Storage cleanup job・復活防止guard・service-only ACLを確認
- [x] Web更新前に `supabase/notebook_person_delete.sql` を実行し、対象者削除receipt・Storage cleanup job・復活防止guard・service-only ACLを確認
- [x] `supabase/public_api_rate_limits.sql` を実行
  - 履歴整合: 2026-09-01の引き継ぎ追記266の本番適用記録でtable/RLS/RPC/service-onlyを確認済み。
- [x] `supabase/anonymous_case_retention.sql` を実行
  - 履歴整合: 2026-09-01の引き継ぎ追記269で適用・ACL・既存件数不変を確認済み。cron直近成功とは別。
- [x] `supabase/storage_setup.sql` を実行
- [x] `supabase/verify_setup.sql` / `verify_compact.sql` で主要項目trueを確認
- [x] `supabase/api_grants.sql` を実行
- [x] Project URL / publishable key / service role keyをローカルenvに設定
- [x] Auth Email Magic Linkの本番Redirect URL最終確認
  - 2026-09-05確認: 登録済み削除専用実行者への本番Magic Linkが公開aliasの `/admin/delete-requests` へ戻り、本人セッションで認証済み表示と一覧GET 200を確認。
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
- [x] 登録済み削除専用実行者本人の個別セッションで `/admin/delete-requests` だけを利用でき、モニター回答・利用状況・本番設定APIは403になることを確認
  - 2026-09-05確認: deployment `dpl_HjCxNNBgixEqg4qrGPsKjJnzKgBB` で削除専用auth-statusと一覧GETが200、モニター回答・AI利用・本番設定APIが各403。削除依頼は0件で、PATCH・preflight・executeは未実行。
- [x] 対応Webを本番に反映し、deployment Ready・公開alias・smokeを確認
  - 2026-09-05確認: release `c1415b3b036fbdfa9977f0d870a808bb633c6467`、CI `33952555663` PASS（2分24秒）、deploy workflow `33952555613` skip後、CLIで `dpl_Hx7V71Pd9voYiMYgfmFFRxmo7MnA` を本番へ反映。公開alias `https://oyano-moshimo-navi.vercel.app` とReadyを確認。smokeは検査対象すべてPASS（Admin envは未認証401でskip）。削除APIの未認証401、未ログイン画面にCONTACT/REASON/HANDLED BY列がないこと、Vercel productionの実行スイッチ未登録（OFF）を確認。本人ログイン後のChrome画面確認は次項に記録し、HTTP数値の直接再採取・非空依頼の応答検証・別確認者のAAL2・削除E2Eは未確認。
- [x] 更新後の登録済み削除専用実行者のChrome画面で、本人認証済み・AAL2確認済み・削除依頼0件・CONTACT/REASON/HANDLED BY列なしを確認。同じ本人sessionのモニター回答・AI利用・env画面で管理権限拒否とデータ非表示を確認した。前2画面は `Admin authorization is forbidden` を表示し、ソース上の403応答と一致するが、HTTP数値は直接採取していない。token・request headerは参照していない。
- [ ] 本人sessionの削除専用auth-status・一覧200と一般Admin API 403のHTTP数値を直接再採取し、非空の依頼で削除専用実行者の一覧クエリがSELECT段階から連絡先・自由記載の理由・処理メモ・担当者メール/user IDを取得せず、対応日時と非識別の認証方式名だけを状態証跡として返すことを確認
- [ ] 対応Webの削除認可が `verify_account_delete_operator_v2` だけを呼び、生の `account_delete_executors` をSELECTしないこと、旧deploymentは認可時点でfail closedになり一覧・実行handlerへ進まないことを確認
- [ ] 一覧が `requested` / `reviewing` / `needs_followup` をページ取得で全件含め、`completed` だけを作成日の新しい順の直近100件に限ることを、未完了1,000件超・完了100件超の破棄データで確認
- [ ] 依頼状態と処理メモのPATCHが現routeのAAL2 app_admin確認後に `update_account_delete_request_status_v2` だけを呼び、DBでも正確なoperator user IDをapp adminとして再確認することを確認する。AAL1 app_adminとAAL2削除専用実行者は403、旧v1を呼ぶAAL1の旧deploymentはDB権限拒否になることも確認
- [ ] Webのpreflight/prepareが `inspect_account_erasure_v2` / `prepare_account_erasure_v2` だけを呼び、blocker応答がcode/数値件数に限られ、`familyId` / `familyName` / Storage生pathがブラウザへ返らないことを確認
- [ ] AAL1ではread-onlyの削除前確認だけ、削除専用実行者のAAL2でだけdurable prepareと実行、当該実行者の `activation_approved` eventに登録された別のAAL2 app adminでだけ10分間grant発行が可能なことを確認
- [ ] 対象確定後、実行前にjob ID・manifest hash・object/prefix件数・1時間の期限が表示され、別確認者が同じ値を再入力できることを確認
- [ ] DB ownerがprepare後に最大15分のone-shot controlを開き、別AAL2 app adminのgrant期限がcontrol残時間内となり、executorのgrant-status/executeだけが同じepochを使用することを確認
- [ ] controlなし・closed・期限切れ・消費済み、grantなし・期限切れ・使用済み・別epoch、異なるrequest/target/job/hash/operator、未登録の別app admin、prepare後の範囲変化がDB削除前に停止することを確認
- [ ] 単独テストアカウントでpreflight→AAL2 prepare→DB owner control open→別AAL2 app admin承認→executor grant-status/execute→Auth/DB/Storage不在確認を完走し、DB削除成功と同じtransactionでgrant/controlが両方consumeされ、2件目を実行できないことを確認
- [ ] 放棄時にDB ownerが `close_account_erasure_execution_control_v1` を実行すると同epochの未使用grantが取消されることを確認
- [ ] DB削除済みの `database_erased` だけは、env OFFへ戻した後も、最初のDB削除を実行した本人と同じ削除専用実行者が現在も有効かつAAL2で、正確なrequest/target/job/manifest hash、同じjobの消費済み・未取消しgrant、現在の実行者hash＝grantの `operator_user_hash` をDB v2が検証した場合だけAuth/Storage不在確認と最終化を再開できることを確認する。DB未削除、値不一致、grant未消費・取消済み、無効な実行者、AAL1、別の有効な削除専用実行者は拒否され、新規削除のenv OFF bypassにならないことも確認
- [ ] 本番ON deploymentと公開aliasを記録し、処理後にactive control/grant 0件、`ACCOUNT_ERASURE_EXECUTION_ENABLED=false` deploymentへのalias移動、ON deploymentの削除または保護を確認する。旧ON直接URLでもDB controlなしで新規のexecute v2が拒否され、旧v1 inspect/prepare/status update/executeもservice role権限なしであることを確認する。DB削除済みの途中回復は前項の限定条件だけで扱う
- [x] app_admin個別アカウントを作成し、Admin APIをBearer認証で確認
  - 2026-07-09監査対応: Admin判定は `family_members` から `app_admins` 専用テーブルへ変更。
  - 2026-07-09再確認: `scripts/smoke-admin-bearer.mjs` で一時 `app_admins` 行を作成し、`/api/admin/env-check` がBearer認証を受け付けることを確認。確認後、一時データは削除済み。
- [x] `/api/cron/send-due-notifications` をdeploy対象に含める
- [ ] Resend送信ドメインを認証し、`RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` を設定
- [ ] 期限通知メールと月1確認メールをテスト受信し、通知OFF後は送られないことを確認
- [x] `/api/cron/purge-anonymous-cases` をdeploy対象に含める
- [x] `/api/cron/cleanup-notebook-storage` と `/api/cron/cleanup-person-notebook-storage` を `vercel.json` のdeploy対象に含める
- [ ] 上記Storage cleanup 2 cronの本番登録・直近成功・失敗通知を確認
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
- [x] 本番DBで `consent_to_sensitive_info` と `consent_logs` の保存を実弾確認（2026-07-09引き継ぎ追記36の履歴。今回の再実行ではない）
- [ ] 更新済み `handoff_consume_rpc.sql` → `anonymous_diagnosis_rpc.sql` の順に適用し、変換済みcaseの再診断・owner追加拒否を確認
- [x] アプリ内に外部Web決済CTAがない
- [x] 公開APIにレート制限を追加
- [x] 本番DBで `public_api_rate_limits.sql` を投入し、DB側レート制限を有効化（上記Supabase欄の適用履歴）
- [x] 本番DBで `anonymous_case_retention.sql` を投入し、匿名診断の保持期限削除を有効化（上記Supabase欄の適用履歴。cron実運用確認は別）
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
- [x] アカウント削除対応の代行者の責任範囲を「主担当不在時に削除依頼の受付・本人確認・実行担当への引継ぎを代行。本番削除は登録済み実行者と別確認者の二者で実施」と確定
- [x] メールによるアカウント削除依頼を `info@bee-ch.co.jp` の共有受信箱で受け、主担当・代行者の双方へ通知する運用方針を確定
- [x] アプリ内削除依頼は `/admin/delete-requests` のDBキューへ入り、現行実装では自動メール通知しない境界を記録
- [ ] `info@bee-ch.co.jp` を共有パスワード方式にせず両名へ委任・転送し、外部テストメールの受信と返信を確認
- [ ] テスト用アプリ内削除依頼がDBキューへ表示され、割り当てた監視・通知方法で両名が認知できることを確認
- [x] アカウント完全削除の実行予定者を `システム責任者 池田知也` と確定（別確認者承認付きで有効化済み・実行スイッチOFF）
- [x] 池田知也本人用の個別Supabase Auth招待を受諾し、メール確認済みであることを本番で確認（個人メール・user IDはGitへ記録しない）
- [x] `/admin/delete-requests/setup` でverified TOTP 1件と現在のAAL2を本人端末で確認し、Supabase側もverified 1件・unverified 0件を確認
- [x] 本人画面で選んだ正確な実行者Auth user IDをprivate台帳へ記録し、監査用の最小profileと `active=false` のexecutor行をfamily所有・所属・一般Adminなしで同一transactionにより作成
  - 2026-09-05確認: 実行直前のread-only検査で確認済みAuth 1件、TOTP総数1件・verified 1件・unverified 0件、既存profile・family所有/所属・一般Admin・executor・本人確認event各0件を確認。本人確認event 1件、最小profile 1件、無効executor 1件だけを同一transactionで作成し、事後検査は全項目PASS。有効executorと承認eventは0件で、既存データの更新・削除なし。
- [x] 一般Admin APIへ広がらない削除専用role、Bearer限定認証、実削除時AAL2、原子的な状態更新・監査を実装・ローカル検証
- [x] 本番へ削除専用roleと更新済み削除pipelineをmigrationし、読み取り専用13項目を確認
- [x] 上記の無効なexecutor行を、別確認者のAuth・profileと承認記録を照合した後だけ有効化し、削除対象本人とは別人であることを確認
  - 2026-09-05確認: 実行直前のread-only検査で本人確認event 1件、無効executor 1件、承認event 0件、有効executor 0件と安全条件を再照合。別確認者の `activation_approved` event 1件と同じexecutorの有効化を1 transactionで実行し、台帳総数2件、executor総数1件・有効1件、family所有/所属・一般Admin・削除job各0件、認可method一致を事後確認した。`ACCOUNT_ERASURE_EXECUTION_ENABLED` は未登録のためOFF。
- [x] 削除実行者とは別の確認者を `代表取締役 池田哲也` と指名し、確認済みAuthと一致profileを本番で読み取り確認し、別操作で `activation_approved` eventを作成
- [x] 初回の削除実行権限有効化では、実行者の本人確認eventと別確認者の `activation_approved` eventを分離して記録する手順を確定
- [x] 実際の削除1件ごとに、request ID・target user ID・operator user IDを二人で照合し、確認者を運用台帳へ残す手順を確定（初回有効化eventとは別）
- [ ] verified TOTP・実行者role・別のAAL2 app admin・execution gateの本番適用・単独テストアカウント完走後だけ、削除1件の実行時間帯に限定して `ACCOUNT_ERASURE_EXECUTION_ENABLED=true` を承認し、prepare後にDB ownerが最大15分のone-shot controlを開く
- [ ] 処理成功時はcontrol/grantの同時consume、放棄時はowner close、期限切れ時はactiveでないことを確認し、active control/grantを0件にする。環境変数OFFだけでなく過去のON deployment直接URLも閉じる
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
