-- Family owner succession RPC.
-- Run after schema.sql, production_rls.sql, and family_invite_rpc.sql.
-- A trusted family member can be promoted to owner so the board does not depend
-- on a single person during an emergency.

create or replace function public.promote_family_member_to_owner(p_family_member_id uuid)
returns family_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target family_members;
  v_promoted family_members;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_target
  from family_members
  where id = p_family_member_id
  for update;

  if not found then
    raise exception 'member_not_found';
  end if;

  if not exists (
    select 1
    from family_members
    where family_id = v_target.family_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  ) then
    raise exception 'not_family_admin';
  end if;

  update family_members
  set role = 'owner'
  where id = p_family_member_id
  returning * into v_promoted;

  update families
  set owner_user_id = coalesce(owner_user_id, v_promoted.user_id),
      updated_at = now()
  where id = v_promoted.family_id
    and owner_user_id is null;

  return v_promoted;
end;
$$;

grant execute on function public.promote_family_member_to_owner(uuid) to authenticated;
