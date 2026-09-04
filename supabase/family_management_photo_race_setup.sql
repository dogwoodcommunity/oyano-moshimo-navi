-- Test-only fixtures for the two family/photo reference race interleavings.

insert into auth.users (id, email)
values
  ('f1000000-0000-4000-8000-000000000001', 'race-insert-owner@example.test'),
  ('f1000000-0000-4000-8000-000000000002', 'race-insert-member@example.test'),
  ('f2000000-0000-4000-8000-000000000001', 'race-remove-owner@example.test'),
  ('f2000000-0000-4000-8000-000000000002', 'race-remove-member@example.test');

insert into public.profiles (id, email)
select id, email
from auth.users
where id in (
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002'
);

insert into public.families (id, name, owner_user_id, plan)
values
  ('f1000000-0000-4000-8000-000000000010', 'Photo insert wins', 'f1000000-0000-4000-8000-000000000001', 'plus'),
  ('f2000000-0000-4000-8000-000000000010', 'Member removal wins', 'f2000000-0000-4000-8000-000000000001', 'plus');

insert into public.family_members (id, family_id, user_id, role, relationship)
values
  ('f1000000-0000-4000-8000-000000000101', 'f1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000001', 'owner', 'owner'),
  ('f1000000-0000-4000-8000-000000000102', 'f1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000002', 'member', 'member'),
  ('f2000000-0000-4000-8000-000000000101', 'f2000000-0000-4000-8000-000000000010', 'f2000000-0000-4000-8000-000000000001', 'owner', 'owner'),
  ('f2000000-0000-4000-8000-000000000102', 'f2000000-0000-4000-8000-000000000010', 'f2000000-0000-4000-8000-000000000002', 'member', 'member');

insert into public.people (id, family_id, display_name, relationship_to_family, profile)
values
  ('f1000000-0000-4000-8000-000000000020', 'f1000000-0000-4000-8000-000000000010', 'Parent one', 'parent', '{"localCaseId":"race-insert-case"}'),
  ('f2000000-0000-4000-8000-000000000020', 'f2000000-0000-4000-8000-000000000010', 'Parent two', 'parent', '{"localCaseId":"race-remove-case"}');

insert into storage.objects (id, bucket_id, name)
values
  ('f1000000-0000-4000-8000-000000000401', 'home-photos', 'notebook/f1000000-0000-4000-8000-000000000002/race.jpg'),
  ('f2000000-0000-4000-8000-000000000401', 'home-photos', 'notebook/f2000000-0000-4000-8000-000000000002/race.jpg');
