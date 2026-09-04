-- Test-only Storage shim and legacy co-owner fixture. Applying
-- family_management_rpc.sql must normalize the legacy row without touching
-- the primary owner selected by families.owner_user_id; a second application
-- then proves that normalization and ACL hardening are rerunnable.

create schema if not exists storage;
create table if not exists storage.objects (
  id uuid primary key default uuid_generate_v4(),
  bucket_id text,
  name text
);

insert into auth.users (id, email)
values
  ('fc000000-0000-4000-8000-000000000001', 'owner-c@example.test'),
  ('fc000000-0000-4000-8000-000000000002', 'legacy-owner-c@example.test');

insert into public.profiles (id, email)
select id, email
from auth.users
where id in (
  'fc000000-0000-4000-8000-000000000001',
  'fc000000-0000-4000-8000-000000000002'
);

insert into public.families (id, name, owner_user_id, plan)
values (
  'fc000000-0000-4000-8000-000000000010',
  'Legacy co-owner family',
  'fc000000-0000-4000-8000-000000000001',
  'plus'
);

insert into public.family_members (id, family_id, user_id, role, relationship)
values
  ('fc000000-0000-4000-8000-000000000101', 'fc000000-0000-4000-8000-000000000010', 'fc000000-0000-4000-8000-000000000001', 'owner', 'primary owner'),
  ('fc000000-0000-4000-8000-000000000102', 'fc000000-0000-4000-8000-000000000010', 'fc000000-0000-4000-8000-000000000002', 'owner', 'legacy co-owner');
