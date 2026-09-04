-- Atomic family membership management for existing and new databases.
-- Run after schema.sql, api_grants.sql, production_rls.sql,
-- notebook_diary_delete.sql, and family_invite_rpc.sql.
-- Every mutation locks the named family first and re-checks the authenticated
-- actor inside the SECURITY DEFINER transaction. Client code must always pass
-- the family id; member/invite ids alone are never treated as authorization.

begin;

create or replace function public.transfer_family_ownership(
  p_family_id uuid,
  p_target_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_owner_id uuid;
  v_actor public.family_members%rowtype;
  v_target public.family_members%rowtype;
begin
  if v_actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_family_id is null then
    raise exception 'family_id_required';
  end if;
  if p_target_member_id is null then
    raise exception 'member_id_required';
  end if;

  -- Keep the same family-lock order as notebook sync, diary deletion, member
  -- removal, and leave. This avoids taking the family row first while a sync
  -- holds the advisory lock and is waiting for that row.
  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || p_family_id::text, 0));

  select owner_user_id
  into v_current_owner_id
  from public.families
  where id = p_family_id
  for update;

  if not found then
    raise exception 'family_not_found';
  end if;
  if v_current_owner_id is null or not exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = v_current_owner_id
  ) then
    raise exception 'family_owner_missing';
  end if;

  select *
  into v_actor
  from public.family_members
  where family_id = p_family_id
    and user_id = v_actor_id
  for update;

  if not found then
    raise exception 'not_a_family_member';
  end if;
  if v_current_owner_id is distinct from v_actor_id then
    raise exception 'ownership_transfer_requires_current_owner';
  end if;

  select *
  into v_target
  from public.family_members
  where family_id = p_family_id
    and id = p_target_member_id
  for update;

  if not found then
    raise exception 'member_not_found';
  end if;
  if v_target.user_id is null then
    raise exception 'member_not_joined';
  end if;
  if v_target.user_id = v_actor_id then
    raise exception 'ownership_transfer_target_must_differ';
  end if;

  -- Point the family at the joined target before demoting the previous owner.
  -- Both changes remain invisible until this transaction commits.
  update public.families
  set owner_user_id = v_target.user_id,
      updated_at = now()
  where id = p_family_id;

  -- Old versions allowed more than one role='owner'. Normalize the family to
  -- one current owner during an explicit transfer and keep former owners as
  -- administrators instead of silently removing their access.
  update public.family_members
  set role = 'admin'
  where family_id = p_family_id
    and role = 'owner'
    and id <> v_target.id;

  update public.family_members
  set role = 'admin'
  where id = v_actor.id
    and role <> 'admin';

  update public.family_members
  set role = 'owner'
  where id = v_target.id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'previousOwnerMemberId', v_actor.id,
    'ownerMemberId', v_target.id
  );
end;
$$;

create or replace function public.remove_family_member(
  p_family_id uuid,
  p_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_owner_id uuid;
  v_actor public.family_members%rowtype;
  v_target public.family_members%rowtype;
begin
  if v_actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_family_id is null then
    raise exception 'family_id_required';
  end if;
  if p_member_id is null then
    raise exception 'member_id_required';
  end if;

  -- Use the same lock order as notebook sync/deletion. Otherwise a diary
  -- photo could be attached after the check below but before membership is
  -- removed, leaving the family with an inaccessible uploader-owned path.
  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || p_family_id::text, 0));

  select owner_user_id
  into v_current_owner_id
  from public.families
  where id = p_family_id
  for update;

  if not found then
    raise exception 'family_not_found';
  end if;

  if v_current_owner_id is null or not exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = v_current_owner_id
  ) then
    raise exception 'family_owner_missing';
  end if;

  select *
  into v_actor
  from public.family_members
  where family_id = p_family_id
    and user_id = v_actor_id
  for update;

  if not found then
    raise exception 'not_a_family_member';
  end if;
  if v_actor_id is distinct from v_current_owner_id
     and v_actor.role not in ('owner', 'admin') then
    raise exception 'not_family_admin';
  end if;

  select *
  into v_target
  from public.family_members
  where family_id = p_family_id
    and id = p_member_id
  for update;

  if not found then
    raise exception 'member_not_found';
  end if;
  if v_target.user_id = v_actor_id then
    raise exception 'remove_self_use_leave_family';
  end if;
  if v_target.user_id = v_current_owner_id then
    raise exception 'cannot_remove_family_owner';
  end if;
  if v_target.user_id is not null and exists (
    select 1
    from public.people person
    join public.timeline_events event on event.person_id = person.id
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
        then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
    ) attachment
    where person.family_id = p_family_id
      and event.event_type = 'diary'
      and attachment->>'storageBucket' = 'home-photos'
      and attachment->>'storagePath' like 'notebook/' || v_target.user_id::text || '/%'
      and exists (
        select 1
        from storage.objects stored_object
        where stored_object.bucket_id = 'home-photos'
          and stored_object.name = attachment->>'storagePath'
      )
  ) then
    -- Notebook photo paths carry the uploader id, and signed reads require
    -- that uploader to remain in this family. Fail closed instead of leaving
    -- diary entries which point at photos that the family can no longer open.
    raise exception 'member_has_notebook_photos';
  end if;

  delete from public.family_members
  where family_id = p_family_id
    and id = p_member_id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'removedMemberId', p_member_id
  );
end;
$$;

create or replace function public.leave_family(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_owner_id uuid;
  v_actor public.family_members%rowtype;
begin
  if v_actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_family_id is null then
    raise exception 'family_id_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || p_family_id::text, 0));

  select owner_user_id
  into v_current_owner_id
  from public.families
  where id = p_family_id
  for update;

  if not found then
    raise exception 'family_not_found';
  end if;
  if v_current_owner_id is null or not exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = v_current_owner_id
  ) then
    raise exception 'family_owner_missing';
  end if;

  select *
  into v_actor
  from public.family_members
  where family_id = p_family_id
    and user_id = v_actor_id
  for update;

  if not found then
    raise exception 'not_a_family_member';
  end if;
  if v_actor_id = v_current_owner_id then
    raise exception 'owner_must_transfer_before_leaving';
  end if;
  if exists (
    select 1
    from public.people person
    join public.timeline_events event on event.person_id = person.id
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
        then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
    ) attachment
    where person.family_id = p_family_id
      and event.event_type = 'diary'
      and attachment->>'storageBucket' = 'home-photos'
      and attachment->>'storagePath' like 'notebook/' || v_actor_id::text || '/%'
      and exists (
        select 1
        from storage.objects stored_object
        where stored_object.bucket_id = 'home-photos'
          and stored_object.name = attachment->>'storagePath'
      )
  ) then
    raise exception 'member_has_notebook_photos';
  end if;

  delete from public.family_members
  where family_id = p_family_id
    and id = v_actor.id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'leftMemberId', v_actor.id
  );
end;
$$;

create or replace function public.cancel_family_invite(
  p_family_id uuid,
  p_invite_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_owner_id uuid;
  v_actor public.family_members%rowtype;
  v_invite public.family_invites%rowtype;
begin
  if v_actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_family_id is null then
    raise exception 'family_id_required';
  end if;
  if p_invite_id is null then
    raise exception 'invite_id_required';
  end if;

  -- Accepting an invite takes this same lock before re-reading its pending
  -- state. Whichever operation commits first wins; the waiter must then see
  -- cancelled/accepted instead of applying the opposite action as well.
  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || p_family_id::text, 0));

  select owner_user_id
  into v_current_owner_id
  from public.families
  where id = p_family_id
  for update;

  if not found then
    raise exception 'family_not_found';
  end if;

  select *
  into v_actor
  from public.family_members
  where family_id = p_family_id
    and user_id = v_actor_id
  for update;

  if not found then
    raise exception 'not_a_family_member';
  end if;
  if v_actor_id is distinct from v_current_owner_id
     and v_actor.role not in ('owner', 'admin') then
    raise exception 'not_family_admin';
  end if;

  select *
  into v_invite
  from public.family_invites
  where family_id = p_family_id
    and id = p_invite_id
  for update;

  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.status = 'cancelled' then
    return jsonb_build_object(
      'familyId', p_family_id,
      'cancelledInviteId', p_invite_id,
      'alreadyCancelled', true
    );
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'invite_not_pending';
  end if;

  update public.family_invites
  set status = 'cancelled'
  where family_id = p_family_id
    and id = p_invite_id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'cancelledInviteId', p_invite_id,
    'alreadyCancelled', false
  );
end;
$$;

create or replace function public.get_family_management_summary(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_plan text;
  v_actor_role text;
  v_is_owner boolean;
  v_can_manage boolean;
  v_joined_others integer;
  v_pending_count integer;
  v_members jsonb;
  v_invites jsonb;
begin
  if v_actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_family_id is null then
    raise exception 'family_id_required';
  end if;

  -- All membership mutations take FOR UPDATE on this row first. FOR SHARE
  -- makes membership authorization and the returned summary one coherent read:
  -- a concurrent removal completes either before this check or after return.
  select owner_user_id, plan
  into v_owner_user_id, v_plan
  from public.families
  where id = p_family_id
  for share;

  if not found then
    raise exception 'family_not_found';
  end if;

  select role
  into v_actor_role
  from public.family_members
  where family_id = p_family_id
    and user_id = v_actor_id;

  if not found then
    raise exception 'not_a_family_member';
  end if;

  v_is_owner := v_owner_user_id = v_actor_id;
  v_can_manage := v_is_owner or v_actor_role in ('owner', 'admin');
  if v_is_owner then
    v_actor_role := 'owner';
  elsif v_actor_role = 'owner' then
    -- owner_user_id is authoritative; legacy co-owners are administrators.
    v_actor_role := 'admin';
  end if;

  select count(*)
  into v_joined_others
  from public.family_members
  where family_id = p_family_id
    and user_id is distinct from v_owner_user_id;

  select count(*)
  into v_pending_count
  from public.family_invites
  where family_id = p_family_id
    and status = 'pending'
    and created_at > now() - interval '7 days'
    and coalesce(expires_at, created_at + interval '7 days') > now();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'memberId', member.id,
        'isYou', member.user_id = v_actor_id,
        'isOwner', member.user_id = v_owner_user_id,
        'canRemove', v_can_manage
          and member.user_id is distinct from v_actor_id
          and member.user_id is distinct from v_owner_user_id
          and not exists (
            select 1
            from public.people person
            join public.timeline_events event on event.person_id = person.id
            cross join lateral jsonb_array_elements(
              case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
                then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
            ) attachment
            where person.family_id = p_family_id
              and event.event_type = 'diary'
              and attachment->>'storageBucket' = 'home-photos'
              and attachment->>'storagePath' like 'notebook/' || member.user_id::text || '/%'
              and exists (
                select 1
                from storage.objects stored_object
                where stored_object.bucket_id = 'home-photos'
                  and stored_object.name = attachment->>'storagePath'
              )
          ),
        'removeBlockedReason', case
          when v_can_manage and member.user_id is not null and exists (
            select 1
            from public.people person
            join public.timeline_events event on event.person_id = person.id
            cross join lateral jsonb_array_elements(
              case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
                then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
            ) attachment
            where person.family_id = p_family_id
              and event.event_type = 'diary'
              and attachment->>'storageBucket' = 'home-photos'
              and attachment->>'storagePath' like 'notebook/' || member.user_id::text || '/%'
              and exists (
                select 1
                from storage.objects stored_object
                where stored_object.bucket_id = 'home-photos'
                  and stored_object.name = attachment->>'storagePath'
              )
          ) then 'notebook_photos'
          else null
        end,
        'role', case
          when member.user_id = v_owner_user_id then 'owner'
          when member.role = 'owner' then 'admin'
          else member.role
        end,
        'relationship', member.relationship,
        'joinedAt', member.created_at
      )
      order by member.created_at, member.id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.family_members member
  where member.family_id = p_family_id;

  if v_can_manage then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'inviteId', invite.id,
          'invitedEmail', invite.invited_email,
          'relationship', invite.relationship,
          'role', invite.role,
          'createdAt', invite.created_at
        )
        order by invite.created_at, invite.id
      ),
      '[]'::jsonb
    )
    into v_invites
    from public.family_invites invite
    where invite.family_id = p_family_id
      and invite.status = 'pending'
      and invite.created_at > now() - interval '7 days'
      and coalesce(invite.expires_at, invite.created_at + interval '7 days') > now();
  else
    -- Invite addresses are operational data for owner/admin only.
    v_invites := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'familyId', p_family_id,
    'plan', case when v_plan = 'plus' then 'plus' else 'free' end,
    'isOwner', v_is_owner,
    'currentUserRole', v_actor_role,
    'canManage', v_can_manage,
    'canLeave', not v_is_owner and not exists (
      select 1
      from public.people person
      join public.timeline_events event on event.person_id = person.id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
          then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
      ) attachment
      where person.family_id = p_family_id
        and event.event_type = 'diary'
        and attachment->>'storageBucket' = 'home-photos'
        and attachment->>'storagePath' like 'notebook/' || v_actor_id::text || '/%'
        and exists (
          select 1
          from storage.objects stored_object
          where stored_object.bucket_id = 'home-photos'
            and stored_object.name = attachment->>'storagePath'
        )
    ),
    'leaveBlockedReason', case
      when not v_is_owner and exists (
        select 1
        from public.people person
        join public.timeline_events event on event.person_id = person.id
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
            then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
        ) attachment
        where person.family_id = p_family_id
          and event.event_type = 'diary'
          and attachment->>'storageBucket' = 'home-photos'
          and attachment->>'storagePath' like 'notebook/' || v_actor_id::text || '/%'
          and exists (
            select 1
            from storage.objects stored_object
            where stored_object.bucket_id = 'home-photos'
              and stored_object.name = attachment->>'storagePath'
          )
      ) then 'notebook_photos'
      when v_is_owner then 'owner_transfer_required'
      else null
    end,
    'limit', case when v_plan = 'plus' then null else 1 end,
    'remaining', case
      when v_plan = 'plus' then null
      else greatest(0, 1 - v_joined_others - v_pending_count)
    end,
    'members', v_members,
    'pendingInvites', v_invites
  );
end;
$$;

-- The user-facing mutation surface is RPC-only. Without these revokes, the
-- broad bootstrap grants plus old admin policies could delete/demote the owner
-- or replace families.owner_user_id without the transaction checks above.
drop policy if exists "families update admins" on public.families;
drop policy if exists "family_members manage admins" on public.family_members;
drop policy if exists "family_members update admins" on public.family_members;
drop policy if exists "family_members delete admins" on public.family_members;

-- families.owner_user_id is authoritative. Repair the role label where the
-- pointed owner is still a joined member, then demote legacy co-owner rows to
-- admin so they can be removed or leave normally. Broken families whose owner
-- pointer has no joined member are left untouched and the RPCs fail closed.
update public.family_members primary_member
set role = 'owner'
from public.families family
where family.id = primary_member.family_id
  and family.owner_user_id = primary_member.user_id
  and primary_member.role <> 'owner';

update public.family_members legacy_owner
set role = 'admin'
from public.families family
where family.id = legacy_owner.family_id
  and family.owner_user_id is not null
  and legacy_owner.user_id is distinct from family.owner_user_id
  and legacy_owner.role = 'owner'
  and exists (
    select 1
    from public.family_members primary_member
    where primary_member.family_id = family.id
      and primary_member.user_id = family.owner_user_id
  );

revoke insert, update, delete on table public.family_members from authenticated;
revoke insert, update, delete on table public.family_invites from authenticated;
revoke update, delete on table public.families from authenticated;

revoke all on function public.transfer_family_ownership(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.remove_family_member(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.leave_family(uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_family_invite(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_family_management_summary(uuid) from public, anon, authenticated, service_role;
do $legacy_owner_promotion_acl$
begin
  if to_regprocedure('public.promote_family_member_to_owner(uuid)') is not null then
    revoke all on function public.promote_family_member_to_owner(uuid) from public, anon, authenticated, service_role;
    grant execute on function public.promote_family_member_to_owner(uuid) to service_role;
  end if;
end;
$legacy_owner_promotion_acl$;

grant execute on function public.transfer_family_ownership(uuid, uuid) to authenticated, service_role;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.leave_family(uuid) to authenticated, service_role;
grant execute on function public.cancel_family_invite(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_family_management_summary(uuid) to authenticated, service_role;

commit;
