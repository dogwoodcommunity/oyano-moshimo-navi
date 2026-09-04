do $invite_capacity_assert$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.family_invites
  where family_id = 'fe000000-0000-4000-8000-000000000010'
    and status = 'pending';
  if v_count <> 1 then
    raise exception 'concurrent create produced % pending invites for one free slot', v_count;
  end if;

  select count(*) into v_count
  from public.family_members
  where family_id = 'ff000000-0000-4000-8000-000000000010'
    and user_id <> 'ff000000-0000-4000-8000-000000000001';
  if v_count <> 1 then
    raise exception 'concurrent accept produced % joined members for one free slot', v_count;
  end if;
end;
$invite_capacity_assert$;

-- Keep the test-only delay hooks from affecting the independent management
-- regression that runs next in the same disposable database.
drop trigger delay_family_invite_capacity_insert on public.family_invites;
drop trigger delay_family_member_capacity_insert on public.family_members;
drop function public.delay_family_invite_capacity_test();
