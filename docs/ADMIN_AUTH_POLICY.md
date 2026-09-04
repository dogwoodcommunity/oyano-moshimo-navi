# Admin認可方針

Admin APIは `SUPABASE_SERVICE_ROLE_KEY` を使うため、RLSではなくAPI側で認可する。

## v0.3の方針

- 正式ルートはSupabase Authの個別ユーザーを使う。
- `app_admins.user_id` に登録されたユーザーだけがAdmin APIを使える。
- 現行の `app_admin` は削除専用roleではなく、全Admin APIに共通する管理者権限である。
- 運用担当として氏名を指名しただけではAdmin権限を付与しない。本人確認済みSupabase Authユーザーを別途 `app_admins.user_id` に登録する。
- 削除実行予定者の指名だけでは、Supabase Authユーザー、MFA、`app_admins` 行、Vercel・Supabase等の本番権限を作成・付与しない。
- 削除実行者を実登録する前に、全Admin APIの閲覧・操作範囲を明示承認するか、削除専用roleを実装・検証する。
- `family_members` の `admin` は家族内の管理者であり、運営Admin権限には使わない。
- 既存運用のため、`ADMIN_ACCESS_TOKEN` + `x-admin-token` は暫定fallbackとして残す。
- Admin画面のAccess欄は、`app_admin access token` を保存している場合は `Authorization: Bearer ...` を優先して送る。未設定の場合だけ `ADMIN_ACCESS_TOKEN fallback` を `x-admin-token` で送る。
- 削除依頼の状態変更では、処理者の `user_id` / `email` / 認可方式を `audit_logs.metadata` に保存する。
- 削除対象本人、実行者、実行者とは別の確認者を分離し、個人の連絡手段やuser IDは公開Gitではなく制限付き運用台帳で管理する。

## app_adminの作り方

Supabase Authで管理者ユーザーを作成し、profilesに行がある状態で、SQL Editorから以下を実行する。

```sql
insert into app_admins (user_id, note)
values ('<admin_user_id>', '運営管理者')
on conflict (user_id)
do update set note = excluded.note;
```

`family_members.relationship = 'app_admin'` は旧方式の一時マーカーです。現在は予約語として家族招待RPCで拒否します。

## 今後の改善

- Admin画面にSupabase AuthログインUIを追加する。
- `ADMIN_ACCESS_TOKEN` fallbackを廃止する。
- Admin操作ごとの専用audit logを増やす。
