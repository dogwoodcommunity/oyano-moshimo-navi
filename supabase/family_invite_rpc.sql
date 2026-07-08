-- Family invite RPC with free-plan limit enforcement.
-- Run after schema.sql and production_rls.sql.

create extension if not exists "pgcrypto";

alter table family_invites
  add column if not exists relationship text;

alter table family_invites
  add column if not exists created_by uuid references profiles(id) on delete set null;

alter table family_invites
  add column if not exists accepted_at timestamptz;

create unique index if not exists idx_family_invites_token_unique
on family_invites(token);

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
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_invited_email is null or length(trim(p_invited_email)) = 0 then
    raise exception 'invited_email_required';
  end if;

  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'invalid_invite_role';
  end if;

  if not exists (
    select 1
    from family_members
    where family_id = p_family_id
      and user_id = auth.uid()
  ) then
    raise exception 'not_a_family_member';
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

  v_limit := case when v_plan = 'plus' then null else 2 end;

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
    p_role,
    nullif(trim(coalesce(p_relationship, '')), ''),
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
      ) < 2
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
    role = excluded.role,
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
