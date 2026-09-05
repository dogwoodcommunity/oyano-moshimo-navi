# Admin認可方針

Admin APIは `SUPABASE_SERVICE_ROLE_KEY` を使うため、RLSではなくAPI側で認可する。

## v0.3の方針

- 正式ルートはSupabase Authの個別ユーザーを使う。
- `app_admins.user_id` に登録されたユーザーだけが、モニター回答・利用状況・本番設定を含む一般Admin APIを使える。
- 現行の `app_admin` は削除専用roleではなく、全Admin APIに共通する管理者権限である。
- 運用担当として氏名を指名しただけではAdmin権限を付与しない。本人確認済みSupabase Authユーザーを別途 `app_admins.user_id` に登録する。
- 削除実行予定者の指名だけでは、Supabase Authユーザー、MFA、`account_delete_executors` 行、Vercel・Supabase等の本番権限を作成・付与しない。
- 削除専用roleは `account_delete_executors` で管理し、有効化済み・未失効の個別ユーザーだけを受け付ける。一般Admin APIへは権限を広げない。
- `family_members` の `admin` は家族内の管理者であり、運営Admin権限には使わない。
- 既存運用のため、`ADMIN_ACCESS_TOKEN` + `x-admin-token` は一般Admin APIの暫定fallbackとして残す。削除依頼の一覧・状態変更・事前確認・実行では一切受け付けない。
- Admin画面のAccess欄は、`app_admin access token` を保存している場合は `Authorization: Bearer ...` を優先して送る。未設定の場合だけ `ADMIN_ACCESS_TOKEN fallback` を `x-admin-token` で送る。
- 削除依頼の状態変更では、処理者の `user_id` / `email` / 認可方式を `audit_logs.metadata` に保存する。
- 削除依頼の状態変更はserver-only RPCで依頼行と監査ログを同じトランザクションに保存し、手動の `completed` 変更は拒否する。
- 削除前確認は有効なBearer認証（AAL1以上）、実削除は登録済みTOTPで追加認証したAAL2を必須にする。
- 削除対象本人、実行者、実行者とは別の確認者を分離し、個人の連絡手段やuser IDは公開Gitではなく制限付き運用台帳で管理する。

## 削除担当者の初回本人確認

- 本人だけが `/admin/delete-requests/setup` を開き、招待を受けた個別メールのMagic Linkと認証アプリの6桁の数字で確認する。
- Magic Linkは既存Authユーザーだけを許可し、この画面から新規ユーザー、`profiles`、家族、対象者、削除専用roleを作らない。
- QRコード、手入力用コード、6桁の数字は運営者へ送らず、Git、ログ、localStorageにも保存しない。
- 登録開始と中断時のcleanupは、開始時に取得した同一のAAL1 token、同一Auth user ID、この画面が作った正確なfactor IDへ結合する。中断時はそのtokenで対象が `unverified` の場合だけ削除し、verified化済み・別ユーザー・別factorは削除せずfail closedにする。過去に残った未完了factorは一括・自動削除しない。
- verified TOTPが1件でも、現在のセッションがAAL2になるまで設定完了と扱わない。複数ある場合は権限付与を停止して手動確認する。
- 認証callback失敗やログインユーザー変更時は古いBearer、QR、手入力用コード、6桁入力を破棄し、別ユーザーの状態へ戻らない。
- 設定完了は本人確認の完了だけを意味する。正確なAuth user ID、`profiles` の限定作成、別確認者の承認後に限り、別操作で `account_delete_executors` を有効化する。

## app_adminの作り方

Supabase Authで管理者ユーザーを作成し、profilesに行がある状態で、SQL Editorから以下を実行する。

```sql
insert into app_admins (user_id, note)
values ('<admin_user_id>', '運営管理者')
on conflict (user_id)
do update set note = excluded.note;
```

`family_members.relationship = 'app_admin'` は旧方式の一時マーカーです。現在は予約語として家族招待RPCで拒否します。

## 削除専用実行者の登録と失効

`supabase/account_delete_executor_role.sql` を適用しても、ユーザー作成や権限付与は行われない。本人確認済みの個別Supabase Authユーザー、`profiles` 行、正確なuser ID、登録済みTOTP、別確認者を運用台帳で確認した後に限り、SQL Editorで次のように有効化する。

```sql
insert into account_delete_executors (
  user_id, created_by, note, active, activated_at, revoked_at
) values (
  '<delete_operator_user_id>',
  '<approver_user_id>',
  '<承認記録の識別子>',
  true,
  now(),
  null
)
on conflict (user_id) do update
set created_by = excluded.created_by,
    note = excluded.note,
    active = true,
    activated_at = now(),
    revoked_at = null;
```

退任・権限停止時は行を共有したままにせず、次のように即時失効させる。実行後は削除専用auth-statusが403になることを確認する。

```sql
update account_delete_executors
set active = false,
    revoked_at = now()
where user_id = '<delete_operator_user_id>';
```

削除専用実行者が使えるのは `/api/admin/delete-requests`、その専用auth-status、`/api/admin/delete-requests/execute` だけである。モニター回答、利用状況、本番環境確認などほかのAdmin APIは拒否される。実行者本人の削除、最後の包括管理者、最後の有効な削除専用実行者の削除は安全停止する。

## 今後の改善

- `ADMIN_ACCESS_TOKEN` fallbackを廃止する。
- Admin操作ごとの専用audit logを増やす。
- 削除実行者とは別の確認者による承認をAPIでも強制する。
