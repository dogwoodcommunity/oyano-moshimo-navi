-- 無料プランの人数上限を1人に下げる。
--
-- 招待を作る側（create_family_invite）と、受け取る側（accept_family_invite）の
-- 両方に上限が書かれている。片方だけ直すと、招待は作れないのに受け取りは通る、
-- あるいはその逆になる。必ず一緒に流すこと。
--
-- 数字の元は packages/shared/src/plan.ts の FREE_PLAN_MEMBER_LIMIT。
--
-- この2つの関数定義は supabase/family_invite_rpc.sql と
-- supabase/admin_auth_hardening.sql の内容と同一。差し替えても
-- 管理者まわりの保護（app_admins のポリシー）には触れない。

create or replace function public.create_family_invite(
  p_family_id uuid,
  p_invited_email text,
  p_role text default 'member',
  p_relationship text default null
)
returns family_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_count int;
  v_limit int;
  v_invite family_invites;
  v_inviter_role text;
  v_role text;
  v_relationship text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_invited_email is null or length(trim(p_invited_email)) = 0 then
    raise exception 'invited_email_required';
  end if;

  v_role := lower(trim(coalesce(p_role, 'member')));
  v_relationship := nullif(trim(coalesce(p_relationship, '')), '');

  if v_role not in ('admin', 'member', 'viewer') then
    raise exception 'invalid_invite_role';
  end if;

  if lower(coalesce(v_relationship, '')) = 'app_admin' then
    raise exception 'reserved_relationship';
  end if;

  select role into v_inviter_role
  from family_members
  where family_id = p_family_id
    and user_id = auth.uid()
  limit 1;

  if v_inviter_role is null then
    raise exception 'not_a_family_member';
  end if;

  if v_inviter_role not in ('owner', 'admin') then
    raise exception 'invite_requires_family_admin';
  end if;

  if v_role = 'admin' and v_inviter_role <> 'owner' then
    raise exception 'admin_invite_requires_owner';
  end if;

  select plan into v_plan
  from families
  where id = p_family_id;

  if v_plan is null then
    raise exception 'family_not_found';
  end if;

  select * into v_invite
  from family_invites
  where family_id = p_family_id
    and invited_email = lower(trim(p_invited_email))
    and status = 'pending'
    and created_at > now() - interval '7 days';

  if found then
    return v_invite;
  end if;

  -- 無料で招待できる人数。packages/shared/src/plan.ts の FREE_PLAN_MEMBER_LIMIT と揃えること。
  v_limit := case when v_plan = 'plus' then null else 1 end;

  if v_limit is not null then
    select
      (
        select count(*)
        from family_members fm
        join families f on f.id = fm.family_id
        where fm.family_id = p_family_id
          and fm.user_id is distinct from f.owner_user_id
      )
      +
      (
        select count(*)
        from family_invites
        where family_id = p_family_id
          and status = 'pending'
          and created_at > now() - interval '7 days'
      )
    into v_count;

    if v_count >= v_limit then
      raise exception 'free_plan_limit_reached'
        using hint = 'upgrade_to_plus';
    end if;
  end if;

  insert into family_invites (
    family_id,
    invited_email,
    role,
    relationship,
    token,
    status,
    expires_at,
    created_by
  )
  values (
    p_family_id,
    lower(trim(p_invited_email)),
    v_role,
    v_relationship,
    translate(rtrim(encode(gen_random_bytes(24), 'base64'), '='), '+/', '-_'),
    'pending',
    now() + interval '7 days',
    auth.uid()
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.accept_family_invite(p_token text)
returns family_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite family_invites;
  v_member family_members;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite
  from family_invites
  where token = p_token
    and status = 'pending'
    and created_at > now() - interval '7 days'
  for update;

  if not found then
    raise exception 'invite_invalid_or_expired';
  end if;

  if v_invite.role not in ('admin', 'member', 'viewer')
    or lower(coalesce(v_invite.relationship, '')) = 'app_admin' then
    raise exception 'invite_has_reserved_role';
  end if;

  select lower(email) into v_user_email
  from auth.users
  where id = auth.uid();

  if v_user_email is null or lower(v_invite.invited_email) <> v_user_email then
    raise exception 'invite_email_mismatch';
  end if;

  perform 1
  from families f
  where f.id = v_invite.family_id
    and (
      f.plan = 'plus'
      or (
        select count(*)
        from family_members fm
        where fm.family_id = f.id
          and fm.user_id is distinct from f.owner_user_id
      -- 無料で受け入れられる人数。packages/shared/src/plan.ts の
      -- FREE_PLAN_MEMBER_LIMIT および create_family_invite の v_limit と揃えること。
      ) < 1
    );

  if not found then
    raise exception 'family_limit_reached';
  end if;

  insert into family_members (
    family_id,
    user_id,
    role,
    relationship
  )
  values (
    v_invite.family_id,
    auth.uid(),
    v_invite.role,
    v_invite.relationship
  )
  on conflict (family_id, user_id)
  do update set
    role = case
      when family_members.role = 'owner' then 'owner'
      when family_members.role = 'admin' and excluded.role in ('member', 'viewer') then 'admin'
      else excluded.role
    end,
    relationship = coalesce(excluded.relationship, family_members.relationship)
  returning * into v_member;

  update family_invites
  set status = 'accepted',
      accepted_at = now()
  where id = v_invite.id;

  return v_member;
end;
$$;

grant execute on function public.create_family_invite(uuid, text, text, text) to authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;
