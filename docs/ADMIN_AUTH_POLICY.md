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

`supabase/account_delete_executor_role.sql` を適用しても、ユーザー作成や権限付与は行われない。
`account_delete_executors.user_id`、削除依頼の `handled_by`、削除jobの `operator_user_id`、監査logの
`actor_user_id` は、いずれも `profiles.id` を監査上の本人識別子として使う。そのため、一般利用者として
初期設定していない削除担当者にも、権限付与とは別に最小限の `profiles` 行が1件必要である。
`profiles` 行だけでは、家族への所属、一般Admin、削除専用roleのいずれも付与されない。
本人識別の正本はAuth UUIDであり、profileのemailは監査表示用の複製にすぎない。有効化時には
profileのemailだけを信用せず、同じUUIDの確認済みAuth emailと一致することを毎回再確認する。

最初に、正確なAuth user ID、メール確認、verified TOTP 1件、unverified TOTP 0件、既存profile・
一般Admin・削除担当roleが0件であることを二者で照合する。次の初回登録は、Authのemailだけを監査用
profileへ複製し、表示名・電話・家族・対象者を作らず、削除担当も `active=false` で停止させる。
`<delete_operator_user_id>` と記録識別子は制限付き運用台帳の実値へ置き換える。

```sql
begin;

do $provision$
declare
  v_operator_user_id uuid := '<delete_operator_user_id>';
  v_identity_record text := '<本人確認記録の識別子・未有効>';
  v_operator_email text;
begin
  if v_identity_record is null
     or btrim(v_identity_record) = ''
     or position('<' in v_identity_record) > 0
     or position('>' in v_identity_record) > 0 then
    raise exception 'a real identity-verification record identifier is required';
  end if;

  select auth_user.email
    into v_operator_email
  from auth.users auth_user
  where auth_user.id = v_operator_user_id
    and auth_user.email is not null
    and auth_user.email_confirmed_at is not null;

  if v_operator_email is null then
    raise exception 'confirmed Auth user was not found';
  end if;
  if (
    select count(*)
    from auth.mfa_factors factor
    where factor.user_id = v_operator_user_id
      and factor.factor_type = 'totp'
      and factor.status = 'verified'
  ) <> 1 or exists (
    select 1
    from auth.mfa_factors factor
    where factor.user_id = v_operator_user_id
      and factor.factor_type = 'totp'
      and factor.status = 'unverified'
  ) then
    raise exception 'exactly one verified TOTP and no unfinished TOTP are required';
  end if;
  if exists (select 1 from public.profiles where id = v_operator_user_id)
     or exists (select 1 from public.app_admins where user_id = v_operator_user_id)
     or exists (select 1 from public.account_delete_executors where user_id = v_operator_user_id) then
    raise exception 'operator identity already exists; review without overwriting it';
  end if;

  insert into public.profiles (id, email)
  values (v_operator_user_id, v_operator_email);

  insert into public.account_delete_executors (
    user_id, created_by, note, active, activated_at, revoked_at
  ) values (
    v_operator_user_id, null, 'identity=' || btrim(v_identity_record), false, null, null
  );
end;
$provision$;

commit;
```

初回登録後は、対象profile 1件、`family_members` 0件、`app_admins` 0件、無効なexecutor 1件、
有効executor 0件をSELECTで確認する。ここまででは削除依頼画面へ入れない。

実行者とは別の確認者についても、正確なAuth user IDと `profiles` 行を制限付き運用台帳で照合する。
確認者本人の承認記録ができた後だけ、次のように未有効・未失効の初回行を1件に限定して有効化する。
失効済み行へ `on conflict ... revoked_at = null` を行って復活させてはいけない。

```sql
begin;

do $activate$
declare
  v_operator_user_id uuid := '<delete_operator_user_id>';
  v_approver_user_id uuid := '<approver_user_id>';
  v_approval_record text := '<承認記録の識別子>';
  v_operator_email text;
begin
  if v_approval_record is null
     or btrim(v_approval_record) = ''
     or position('<' in v_approval_record) > 0
     or position('>' in v_approval_record) > 0 then
    raise exception 'a real approval record identifier is required';
  end if;
  if v_operator_user_id = v_approver_user_id then
    raise exception 'operator and approver must be different people';
  end if;

  select auth_user.email
    into v_operator_email
  from auth.users auth_user
  where auth_user.id = v_operator_user_id
    and auth_user.email is not null
    and auth_user.email_confirmed_at is not null
  for update;

  if v_operator_email is null then
    raise exception 'confirmed operator Auth user was not found';
  end if;
  if (
    select count(*)
    from auth.mfa_factors factor
    where factor.user_id = v_operator_user_id
      and factor.factor_type = 'totp'
      and factor.status = 'verified'
  ) <> 1 or exists (
    select 1
    from auth.mfa_factors factor
    where factor.user_id = v_operator_user_id
      and factor.factor_type = 'totp'
      and factor.status = 'unverified'
  ) then
    raise exception 'operator still requires exactly one verified TOTP and no unfinished TOTP';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_operator_user_id
      and profile.email is not null
      and lower(profile.email) = lower(v_operator_email)
  ) then
    raise exception 'operator profile no longer matches the confirmed Auth identity';
  end if;
  if exists (select 1 from public.family_members where user_id = v_operator_user_id) then
    raise exception 'operator unexpectedly belongs to an application family';
  end if;
  if exists (select 1 from public.app_admins where user_id = v_operator_user_id) then
    raise exception 'operator unexpectedly has broader app-admin authority';
  end if;
  if not exists (
    select 1
    from auth.users auth_user
    join public.profiles profile on profile.id = auth_user.id
    where auth_user.id = v_approver_user_id
      and auth_user.email is not null
      and auth_user.email_confirmed_at is not null
      and profile.email is not null
      and lower(profile.email) = lower(auth_user.email)
  ) then
    raise exception 'confirmed approver Auth identity and matching profile were not found';
  end if;

  update public.account_delete_executors
  set created_by = v_approver_user_id,
      note = concat_ws(
        ' | ',
        nullif(btrim(note), ''),
        'approval=' || btrim(v_approval_record)
      ),
      active = true,
      activated_at = now()
  where user_id = v_operator_user_id
    and created_by is null
    and note like 'identity=%'
    and active = false
    and activated_at is null
    and revoked_at is null
    and exists (
      select 1
      from auth.users auth_user
      join public.profiles profile on profile.id = auth_user.id
      where auth_user.id = v_operator_user_id
        and auth_user.email is not null
        and auth_user.email_confirmed_at is not null
        and profile.email is not null
        and lower(profile.email) = lower(auth_user.email)
    )
    and (
      select count(*)
      from auth.mfa_factors factor
      where factor.user_id = v_operator_user_id
        and factor.factor_type = 'totp'
        and factor.status = 'verified'
    ) = 1
    and not exists (
      select 1
      from auth.mfa_factors factor
      where factor.user_id = v_operator_user_id
        and factor.factor_type = 'totp'
        and factor.status = 'unverified'
    )
    and not exists (
      select 1 from public.family_members where user_id = v_operator_user_id
    )
    and not exists (
      select 1 from public.app_admins where user_id = v_operator_user_id
    )
    and exists (
      select 1
      from auth.users auth_user
      join public.profiles profile on profile.id = auth_user.id
      where auth_user.id = v_approver_user_id
        and auth_user.email is not null
        and auth_user.email_confirmed_at is not null
        and profile.email is not null
        and lower(profile.email) = lower(auth_user.email)
    );

  if not found then
    raise exception 'one new inactive operator row was not found';
  end if;
end;
$activate$;

commit;
```

有効化後のexecutor行には、`identity=<本人確認記録>` と `approval=<別確認者の承認記録>` の
両方を残す。後者で前者を上書きせず、詳細な証跡そのものは制限付き運用台帳で保管する。

退任・権限停止時は、有効化済み・未失効の1行だけを次のように即時失効させる。すでに失効済みの
時刻は上書きせず、未有効行をCHECK制約違反にしない。実行後は削除専用auth-statusが403になることを確認する。

```sql
begin;

do $revoke$
declare
  v_operator_user_id uuid := '<delete_operator_user_id>';
begin
  update public.account_delete_executors
  set active = false,
      revoked_at = now()
  where user_id = v_operator_user_id
    and active = true
    and activated_at is not null
    and revoked_at is null;

  if not found then
    raise exception 'one active and unrevoked operator row was not found';
  end if;
end;
$revoke$;

commit;
```

まだ一度も有効化していない `active=false` 行を取り消す場合は、失効処理を流用しない。当該UUID、
`activated_at is null`、`revoked_at is null` を再確認してexecutor行だけを削除し、最小profileは
ほかの参照が0件であることを別途監査できるまで残す。

削除専用実行者が使えるのは `/api/admin/delete-requests`、その専用auth-status、`/api/admin/delete-requests/execute` だけである。モニター回答、利用状況、本番環境確認などほかのAdmin APIは拒否される。実行者本人の削除、最後の包括管理者、最後の有効な削除専用実行者の削除は安全停止する。

## 今後の改善

- `ADMIN_ACCESS_TOKEN` fallbackを廃止する。
- Admin操作ごとの専用audit logを増やす。
- 削除実行者とは別の確認者による承認をAPIでも強制する。
