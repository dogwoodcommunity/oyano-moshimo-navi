do $first_family_concurrency_assert$
declare
  v_family_count integer;
  v_membership_count integer;
  v_owner_count integer;
begin
  select count(distinct family_id), count(*)
  into v_family_count, v_membership_count
  from public.family_members
  where user_id = 'fd000000-0000-4000-8000-000000000001';

  if v_family_count <> 1 or v_membership_count <> 1 then
    raise exception 'concurrent first-family calls created % families / % memberships',
      v_family_count, v_membership_count;
  end if;

  select count(*)
  into v_owner_count
  from public.families family
  join public.family_members member
    on member.family_id = family.id
   and member.user_id = family.owner_user_id
  where family.owner_user_id = 'fd000000-0000-4000-8000-000000000001'
    and member.role = 'owner';

  if v_owner_count <> 1 then
    raise exception 'concurrent first-family result has % current owners', v_owner_count;
  end if;
end;
$first_family_concurrency_assert$;
