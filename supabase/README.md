# Supabase本番セットアップ

SQL Editorで以下の順に実行する。

既に初期セットアップ済みの本番DBへ後追いhardeningだけ入れる場合は、まず `production_pending_hardening.sql` を実行する。

1. `schema.sql`
2. `task_template_seed.sql`
3. `task_generation.sql`
4. `notification_delivery_hardening.sql`
5. `task_notification_generation.sql`
6. `monthly_checkin_notifications.sql`
7. `handoff_security_hardening.sql`
8. `sensitive_info_consent_hardening.sql`
9. `product_seed.sql`
10. `indexes.sql`
11. `api_grants.sql`
12. `production_rls.sql`
13. `family_invite_rpc.sql`
14. `storage_setup.sql`

既存DBで個別hardeningする場合のみ:

- `home_photo_security_hardening.sql`

任意確認:

15. `verify_setup.sql`
16. `verify_compact.sql`

## 重要

- Webの匿名診断作成は、Next.js API routeから `SUPABASE_SERVICE_ROLE_KEY` を使って保存する。
- `SUPABASE_SERVICE_ROLE_KEY` はVercelなどのサーバー環境変数にだけ入れる。
- `SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_` や `EXPO_PUBLIC_` に入れない。
- Expoアプリは `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` のみを使う。

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

ローカルWebの `.env.local` に値を入れ、`/start -> /diagnosis -> /result/[caseId]` を実行する。

確認するテーブル:

- `cases`
- `case_results`
- `person_status_events`
- `tasks`
- `support_packs`
- `storage.buckets` の `home-photos`

SQL投入後の構成確認には `verify_setup.sql` を実行する。`ok` が `false` の行があれば、該当SQLの投入漏れまたは権限設定漏れを確認する。
