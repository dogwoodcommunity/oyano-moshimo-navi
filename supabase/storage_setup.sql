-- Storage setup for 親のもしもナビ v0.3
-- Run after schema.sql and production_rls.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home-photos',
  'home-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "home photos read own family"
on storage.objects for select
using (
  bucket_id = 'home-photos'
  and exists (
    select 1
    from home_photos
    join homes on homes.id = home_photos.home_id
    join people on people.id = homes.person_id
    join family_members on family_members.family_id = people.family_id
    where home_photos.storage_path = storage.objects.name
      and family_members.user_id = auth.uid()
  )
);

create policy "home photos upload authenticated"
on storage.objects for insert
with check (
  bucket_id = 'home-photos'
  and auth.uid() is not null
);

create policy "home photos update own family"
on storage.objects for update
using (
  bucket_id = 'home-photos'
  and exists (
    select 1
    from home_photos
    join homes on homes.id = home_photos.home_id
    join people on people.id = homes.person_id
    join family_members on family_members.family_id = people.family_id
    where home_photos.storage_path = storage.objects.name
      and family_members.user_id = auth.uid()
  )
);

create policy "home photos delete own family"
on storage.objects for delete
using (
  bucket_id = 'home-photos'
  and exists (
    select 1
    from home_photos
    join homes on homes.id = home_photos.home_id
    join people on people.id = homes.person_id
    join family_members on family_members.family_id = people.family_id
    where home_photos.storage_path = storage.objects.name
      and family_members.user_id = auth.uid()
  )
);
