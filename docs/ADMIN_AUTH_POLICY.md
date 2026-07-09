# Admin認可方針

Admin APIは `SUPABASE_SERVICE_ROLE_KEY` を使うため、RLSではなくAPI側で認可する。

## v0.3の方針

- 正式ルートはSupabase Authの個別ユーザーを使う。
- `family_members.role = 'admin'` かつ `family_members.relationship = 'app_admin'` のユーザーだけがAdmin APIを使える。
- 既存運用のため、`ADMIN_ACCESS_TOKEN` + `x-admin-token` は暫定fallbackとして残す。
- Admin画面のAccess欄は、`app_admin access token` を保存している場合は `Authorization: Bearer ...` を優先して送る。未設定の場合だけ `ADMIN_ACCESS_TOKEN fallback` を `x-admin-token` で送る。
- 削除依頼の状態変更では、処理者の `user_id` / `email` / 認可方式を `audit_logs.metadata` に保存する。

## app_adminの作り方

Supabase Authで管理者ユーザーを作成し、profilesに行がある状態で、SQL Editorから以下を実行する。

```sql
insert into families (name, owner_user_id, plan)
values ('親のもしもナビ運営', '<admin_user_id>', 'plus')
returning id;
```

返ってきたfamily idを使う。

```sql
insert into family_members (family_id, user_id, role, relationship)
values ('<family_id>', '<admin_user_id>', 'admin', 'app_admin')
on conflict (family_id, user_id)
do update set role = 'admin', relationship = 'app_admin';
```

## 今後の改善

- Admin画面にSupabase AuthログインUIを追加する。
- `ADMIN_ACCESS_TOKEN` fallbackを廃止する。
- Admin操作ごとの専用audit logを増やす。
