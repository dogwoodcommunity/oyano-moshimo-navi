# Supabase本番セットアップ

SQL Editorで以下の順に実行する。

2026-09-04以降に既存本番DBへ家族の閲覧専用ロールと家族管理を反映する場合は、`production_rls.sql` 全体を再実行せず、`notebook_atomic_sync_v2.sql`、`ai_consult_memory.sql`、`family_role_hardening_20260904.sql`、`family_management_rpc.sql` の順に実行し、最後に `verify_compact.sql` で確認する。`family_management_rpc.sql` は所有権移譲・メンバー削除・退出・招待取消をfamily単位で直列化し、ログイン利用者の `families` / `family_members` / `family_invites` 直接変更権限と旧書き込みpolicyを閉じるため、`api_grants.sql` や `production_rls.sql` より後に実行する。

既に初期セットアップ済みの本番DBへ後追いhardeningだけ入れる場合は、まず `production_pending_hardening.sql` と `admin_auth_hardening.sql` を実行する。`production_pending_hardening.sql` だけでは新しい匿名診断RPCは作成されない。匿名診断・アプリ引き継ぎの権限境界を更新する場合は、Webをデプロイする前に、`production_pending_hardening.sql`（未適用の場合）、更新済み `handoff_consume_rpc.sql`、`anonymous_diagnosis_rpc.sql` の3ファイルをこの順で実行し、`verify_compact.sql` で両関数を確認する。`production_pending_hardening.sql` を過去に適用済みの場合も、今回更新した後ろ2ファイルは必ず再実行する。先に `handoff_consume_rpc.sql` を入れることで、Web更新までの間も変換済みcaseから別アカウントをowner追加する経路を閉じる。
既存DBへ対象者ごとの長期AI記憶と安全な手帳同期を追加する場合は、既存の `is_family_member` 関数と従来RLSが入っていることを確認し、短時間のメンテナンス枠で `notebook_atomic_sync_v2.sql`、`ai_consult_memory.sql`、`consult_daily_claim.sql`、`verify_compact.sql` の順に実行する。先にDB移行を完了し、`verify_compact.sql` がすべて `ok=true` になってから対応するWebをデプロイする。`notebook_atomic_sync_v2.sql` は古いDBに不足する手帳用・都道府県用の最小列も同じトランザクションで追加し、既存IDを補完する。重複を検出した場合は削除せず、列追加を含む全体をロールバックする。この手順では `person_notebook_hardening.sql` や `regional_sponsor_data.sql` 全体を先に実行しない。`ai_consult_memory.sql` は新テーブルのgrant/revokeとRLSを含み、既存の手帳記録を変更・削除しない。`consult_daily_claim.sql` は無料AI相談を外部API呼出前に家族・日本時間の日単位で予約し、成功後だけ確定するserver-only RPCを追加する。既存DBでは現行の `api_grants.sql` や `production_rls.sql` 全体を再実行しない。従来ポリシーを含む全体SQLは既存DBへの再適用を前提としておらず、途中の既存ポリシーで停止するためである。

既存DBへ個別削除と検証済みアカウント削除を追加する場合は、先に `notebook_atomic_sync_v2.sql`、`ai_consult_memory.sql`、`consult_daily_claim.sql` が適用済みであることを確認し、`notebook_diary_delete.sql`、`notebook_person_delete.sql`、`admin_auth_hardening.sql`、`account_delete_executor_role.sql`、`account_deletion_pipeline.sql`、`verify_compact.sql` の順に実行する。`account_delete_executor_role.sql` は削除専用の空の許可表と非公開認可helperだけを作り、ユーザー作成・権限付与・既存記録変更は行わない。日記削除と対象者の手帳全体削除は、削除receiptとStorage cleanup jobを同じトランザクションで残し、古い端末からの再同期でも復活させない。アカウント削除は `account_erasure_jobs` に途中状態を残し、再実行できる。対象者が所有する家族に別メンバーがいる場合は所有権移管まで停止する。本人名義の写真が退会後も共有家族に残る場合も、家族側へ写真を引き継ぐ仕組みができるまでは安全停止し、完了扱いにしない。DB・Supabase Auth・Storageの全確認が揃うまで依頼は `completed` にならない。migration直後は `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` のままとし、破棄DB回帰試験、個別実行者のTOTP/AAL2、別確認者、単独テストアカウントの実運用試験後だけ明示的に開く。

1. `schema.sql`
2. `task_template_seed.sql`
3. `task_generation.sql`
4. `notification_delivery_hardening.sql`
5. `task_notification_generation.sql`
6. `monthly_checkin_notifications.sql`
7. `notification_email_delivery.sql`
8. `handoff_security_hardening.sql`
9. `handoff_consume_rpc.sql`
10. `anonymous_diagnosis_rpc.sql`
11. `create_initial_family_person.sql`
12. `sensitive_info_consent_hardening.sql`
13. `product_seed.sql`
14. `indexes.sql`
15. `api_grants.sql`
16. `production_rls.sql`
17. `notebook_atomic_sync_v2.sql`
18. `ai_consult_memory.sql`
19. `notebook_diary_delete.sql`
20. `consult_daily_claim.sql`
21. `notebook_person_delete.sql`
22. `family_invite_rpc.sql`
23. `admin_auth_hardening.sql`
24. `account_delete_executor_role.sql`
25. `family_owner_succession.sql`
26. `family_management_rpc.sql`
27. `account_deletion_pipeline.sql`
28. `public_api_rate_limits.sql`
29. `anonymous_case_retention.sql`
30. `storage_setup.sql`
31. `regional_sponsor_data.sql`

既存DBで個別hardeningする場合のみ:

- `home_photo_security_hardening.sql`
- `post_discharge_home_task_seed.sql`
  退院後・在宅療養ステータスを後から追加する場合に実行する。新規DBでは `task_template_seed.sql` に含まれる。
- `prefecture_usage_snapshot_cron.sql`
  地域スポンサー基盤を寝かせていても、都道府県別の月次確定値を貯めるために実行する。
  `regional_sponsor_data.sql` の後に1回だけ実行する。
  毎月1日 00:10 UTC（日本時間09:10）に `capture_prefecture_usage_snapshot()` を実行する。
  月途中の手動再実行は禁止。訂正時のみ理由を残して再実行する。

任意確認:

32. `verify_setup.sql`
33. `verify_compact.sql`

`notebook_atomic_sync_v2_regression.sql`、`ai_consult_memory_regression.sql`、`consult_daily_claim_regression.sql`、
`notebook_diary_delete_regression.sql`、`notebook_person_delete_regression.sql`、
`handoff_ownership_regression.sql`、`family_management_regression.sql` は破棄可能な
ローカルPostgreSQL専用で、本番SQL Editorでは実行しない。AI記憶の回帰SQLは `schema.sql`、
`api_grants.sql`、`production_rls.sql`、`ai_consult_memory.sql` を適用したテストDBで実行する。
Dockerを使える環境ではrepository rootで `pnpm run test:consult-memory:sql` を実行すると、専用の
PostgreSQL 16 containerを作成し、migrationを2回適用して回帰SQLを実行後、containerを自動削除する。
無料AI相談の並行予約・失敗時再試行・stale予約・RPC権限は `pnpm run test:consult-daily-claim:sql` で同様に確認する。
匿名診断と引き継ぎの権限回帰は `pnpm run test:handoff-security:sql` で同様に破棄専用containerへ実行する。
家族管理の所有者保護・別family拒否・退出・招待取消は `pnpm run test:family-management:sql` で確認する。
単一日記の削除・再同期拒否・写真cleanupは `pnpm run test:diary-deletion:sql`、対象者の手帳全体削除・CAS・再作成拒否は `pnpm run test:person-deletion:sql` で確認する。
削除専用Bearer認証がほかのAdmin APIへ広がらず、緊急用管理キーを拒否し、実削除だけAAL2を要求することは `pnpm run test:account-delete-executor` で確認する。Auth・DB・Storageのアカウント削除、専用実行者の認可、共有家族の停止、共有記録の保持、証跡の匿名化、RPC権限は `pnpm run test:account-erasure:sql` で確認する。

## 重要

- Webの匿名診断作成は、Next.js API routeから `SUPABASE_SERVICE_ROLE_KEY` を使って保存する。
- `SUPABASE_SERVICE_ROLE_KEY` はVercelなどのサーバー環境変数にだけ入れる。
- `SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_` や `EXPO_PUBLIC_` に入れない。
- Expoアプリは `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` のみを使う。
- 公開APIの連打対策は `public_api_rate_limits.sql` のRPCで制御する。SQL未投入時はWebサーバー内の簡易制限に落ちるが、本番では必ずSQLを投入する。
- 放置された匿名診断ケースは `anonymous_case_retention.sql` と Vercel Cron `/api/cron/purge-anonymous-cases` で削除する。
- 地域スポンサーの前月比は `prefecture_usage_snapshots` の月次確定値から出す。
  現在値から過去を再計算しない。月次確定値は `prefecture_usage_snapshot_cron.sql` で貯める。
- 対象者ごとのAI長期記憶は `person_ai_memories` に家族共有で保存する。AI生成の `long_term_summary` と家族が確認・訂正する `user_summary` を混ぜない。
- 無料AI相談は `claim_daily_free_consult` で外部AI呼出前に予約し、`persist_and_finalize_daily_free_consult` の1トランザクションで伏字済み相談履歴の保存と利用枠確定を行う。同じtokenの再実行は同じturnを返し、失敗時は同じtokenだけをreleaseするため、応答不明や並行送信でも二重の外部AI呼出・履歴作成・枠再開を起こさない。
- 手帳のクラウド保存は `sync_notebook_v2` だけで対象者・確認リスト・日記を1トランザクションに保存する。クライアント時刻で勝敗を決めず、サーバー版数とハッシュで競合を検出する。
- 単一日記と対象者の手帳全体は、画面で内容を再確認し、現在のサーバー版数・ハッシュが一致した時だけserver-only RPCで削除する。削除receiptが残るため、応答不明や古い端末からの同期でも同じ記録を作り直さない。
- PWAとMobileの直接書き込みは同じ安定ID・版数トリガーを共有する。`viewer` は閲覧のみ、`member` は確認リストと日記、`owner/admin` は基本情報も更新できる。
- 所有権移譲・メンバー削除・退出・招待取消は、画面で選んだ `familyId` を明示して `family_management_rpc.sql` のRPCだけを使う。`families.owner_user_id` や `family_members` をクライアントから直接変更しない。
- Stage CでMobileの共同管理者画面を、明示 `familyId` を必須にする新契約へ移行する。それまでは旧 `promote_family_member_to_owner(uuid)` をクライアントへ公開せず、Mobileも成功扱いにせずWeb版の所有権移譲へ案内する。
- AI相談履歴は `ai_consult_threads` / `ai_consult_turns` に保存する。対象者の家族メンバーであり、かつその相談スレッドを作った本人だけをWeb APIが許可し、RLSも同じ範囲へ制限する。
- 上記3テーブルと `ai_memory_consents` は、ログイン済みクライアントにも直接の追加・更新・削除権限を与えない。長期要約、根拠ID、相談履歴、同意状態の変更は、対象者と家族権限を再確認するWeb APIからservice roleでだけ行う。
- `excluded_event_ids` に入れた手帳記録は、再要約・関連記録検索の入力から必ず除外する。配列自体は外部キーではないため、アプリ側でも `timeline_events.person_id` との一致を検証する。
- 記憶の削除時は元の手帳記録を消さず、派生要約と参照IDを空にして `memory_reset_at` を更新する。再構築ではその時刻以前の記録を除外し、削除した記憶が直後に復活しないようにする。
- アカウント完全削除は、緊急用管理キーでは一覧・状態変更・事前確認・実行のいずれも行わない。登録済みapp_adminまたは有効な削除専用実行者が個別Bearerで入り、実削除時は登録済みTOTPでAAL2へ上げる。削除依頼IDと利用者IDを一致確認し、`prepare_account_erasure_v1` → DB削除 → Auth/Storage不在確認 → `finalize_account_erasure_v1` の順で行う。共有家族のownerは先に所有権を移管する。共有家族に本人名義の写真pathが残る場合は自動削除せず、写真の引継ぎ機能が整うまで `needs_followup` で停止する。完了証跡には件数とmanifest hashだけを残し、利用者ID・メール由来hash・連絡先・写真path・日記cleanupのraw identityは消す。

## SQL実行後に取得する値

Web:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Mobile:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## 次の確認

ローカルWeb/Mobileの `.env.local` に値を入れ、Expoアプリから「家族ボードを作る」を実行する。

確認するテーブル:

- `cases`
- `case_results`
- `person_status_events`
- `tasks`
- `support_packs`
- `storage.buckets` の `home-photos`

SQL投入後の構成確認には `verify_setup.sql` を実行する。`ok` が `false` の行があれば、該当SQLの投入漏れまたは権限設定漏れを確認する。
