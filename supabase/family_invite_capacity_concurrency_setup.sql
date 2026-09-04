-- Test-only fixtures that widen invite/member inserts so two seat-consuming
-- requests deterministically overlap.

insert into auth.users (id, email)
values
  ('fe000000-0000-4000-8000-000000000001', 'invite-owner@example.test'),
  ('ff000000-0000-4000-8000-000000000001', 'accept-owner@example.test'),
  ('ff000000-0000-4000-8000-000000000002', 'accept-one@example.test'),
  ('ff000000-0000-4000-8000-000000000003', 'accept-two@example.test');

insert into public.profiles (id, email)
select id, email
from auth.users
where id in (
  'fe000000-0000-4000-8000-000000000001',
  'ff000000-0000-4000-8000-000000000001',
  'ff000000-0000-4000-8000-000000000002',
  'ff000000-0000-4000-8000-000000000003'
);

insert into public.families (id, name, owner_user_id, plan)
values
  ('fe000000-0000-4000-8000-000000000010', 'Concurrent invite family', 'fe000000-0000-4000-8000-000000000001', 'free'),
  ('ff000000-0000-4000-8000-000000000010', 'Concurrent accept family', 'ff000000-0000-4000-8000-000000000001', 'free');

insert into public.family_members (id, family_id, user_id, role, relationship)
values
  ('fe000000-0000-4000-8000-000000000101', 'fe000000-0000-4000-8000-000000000010', 'fe000000-0000-4000-8000-000000000001', 'owner', 'owner'),
  ('ff000000-0000-4000-8000-000000000101', 'ff000000-0000-4000-8000-000000000010', 'ff000000-0000-4000-8000-000000000001', 'owner', 'owner');

insert into public.family_invites (
  id, family_id, invited_email, role, token, status, expires_at, created_by
)
values
  ('ff000000-0000-4000-8000-000000000201', 'ff000000-0000-4000-8000-000000000010', 'accept-one@example.test', 'member', 'concurrent-accept-one', 'pending', now() + interval '7 days', 'ff000000-0000-4000-8000-000000000001'),
  ('ff000000-0000-4000-8000-000000000202', 'ff000000-0000-4000-8000-000000000010', 'accept-two@example.test', 'member', 'concurrent-accept-two', 'pending', now() + interval '7 days', 'ff000000-0000-4000-8000-000000000001');

create or replace function public.delay_family_invite_capacity_test()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'family_invites'
     and new.family_id = 'fe000000-0000-4000-8000-000000000010'::uuid then
    perform pg_sleep(1);
  elsif tg_table_name = 'family_members'
        and new.family_id = 'ff000000-0000-4000-8000-000000000010'::uuid
        and new.user_id <> 'ff000000-0000-4000-8000-000000000001'::uuid then
    perform pg_sleep(1);
  end if;
  return new;
end;
$$;

create trigger delay_family_invite_capacity_insert
before insert on public.family_invites
for each row execute function public.delay_family_invite_capacity_test();

create trigger delay_family_member_capacity_insert
before insert on public.family_members
for each row execute function public.delay_family_invite_capacity_test();
