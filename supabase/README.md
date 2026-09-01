# Supabase本番セットアップ

SQL Editorで以下の順に実行する。

既に初期セットアップ済みの本番DBへ後追いhardeningだけ入れる場合は、まず `production_pending_hardening.sql` と `admin_auth_hardening.sql` を実行する。
既存DBへ対象者ごとの長期AI記憶と安全な手帳同期を追加する場合は、既存の `is_family_member` 関数と従来RLSが入っていることを確認し、短時間のメンテナンス枠で `notebook_atomic_sync_v2.sql`、`ai_consult_memory.sql`、`verify_compact.sql` の順に実行する。先にDB移行を完了し、`verify_compact.sql` がすべて `ok=true` になってから対応するWebをデプロイする。`notebook_atomic_sync_v2.sql` は既存IDを補完し、重複を検出した場合は削除せず全体をロールバックする。`ai_consult_memory.sql` は新テーブルのgrant/revokeとRLSを含み、既存の手帳記録を変更・削除しない。既存DBでは現行の `api_grants.sql` や `production_rls.sql` 全体を再実行しない。従来ポリシーを含む全体SQLは既存DBへの再適用を前提としておらず、途中の既存ポリシーで停止するためである。

1. `schema.sql`
2. `task_template_seed.sql`
3. `task_generation.sql`
4. `notification_delivery_hardening.sql`
5. `task_notification_generation.sql`
6. `monthly_checkin_notifications.sql`
7. `notification_email_delivery.sql`
8. `handoff_security_hardening.sql`
9. `handoff_consume_rpc.sql`
10. `create_initial_family_person.sql`
11. `sensitive_info_consent_hardening.sql`
12. `product_seed.sql`
13. `indexes.sql`
14. `api_grants.sql`
15. `production_rls.sql`
16. `notebook_atomic_sync_v2.sql`
17. `ai_consult_memory.sql`
18. `family_invite_rpc.sql`
19. `admin_auth_hardening.sql`
20. `family_owner_succession.sql`
21. `account_deletion_pipeline.sql`
22. `public_api_rate_limits.sql`
23. `anonymous_case_retention.sql`
24. `storage_setup.sql`
25. `regional_sponsor_data.sql`

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

26. `verify_setup.sql`
27. `verify_compact.sql`

`notebook_atomic_sync_v2_regression.sql` は破棄可能なローカルPostgreSQL専用で、本番SQL Editorでは実行しない。

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
- 手帳のクラウド保存は `sync_notebook_v2` だけで対象者・確認リスト・日記を1トランザクションに保存する。クライアント時刻で勝敗を決めず、サーバー版数とハッシュで競合を検出する。
- PWAとMobileの直接書き込みは同じ安定ID・版数トリガーを共有する。`viewer` は閲覧のみ、`member` は確認リストと日記、`owner/admin` は基本情報も更新できる。
- AI相談履歴は `ai_consult_threads` / `ai_consult_turns` に保存する。対象者の家族メンバーであり、かつその相談スレッドを作った本人だけをWeb APIが許可し、RLSも同じ範囲へ制限する。
- 上記3テーブルと `ai_memory_consents` は、ログイン済みクライアントにも直接の追加・更新・削除権限を与えない。長期要約、根拠ID、相談履歴、同意状態の変更は、対象者と家族権限を再確認するWeb APIからservice roleでだけ行う。
- `excluded_event_ids` に入れた手帳記録は、再要約・関連記録検索の入力から必ず除外する。配列自体は外部キーではないため、アプリ側でも `timeline_events.person_id` との一致を検証する。
- 記憶の削除時は元の手帳記録を消さず、派生要約と参照IDを空にして `memory_reset_at` を更新する。再構築ではその時刻以前の記録を除外し、削除した記憶が直後に復活しないようにする。

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
