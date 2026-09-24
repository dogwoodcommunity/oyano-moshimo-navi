-- Additive prerequisite BEFORE enabling anonymous consultation in production.
-- Apply the updated supabase/family_invite_rpc.sql first (its two public RPCs
-- reject is_anonymous claims), then this file. Historical invite bundles carry
-- the same guard so a later reapply cannot reopen guest sharing.
-- Requires the existing storage setup and Supabase auth.jwt(). Rerunnable.
-- No data deletion, new grants, bucket changes or registered-user restrictions.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '1min';

-- Restrictive policies intersect existing grants. They never introduce a new
-- upload path. Signed uploads are also gated by /api/notebook/photo-upload-url.
-- Keep read/delete available under existing ownership rules; this does not
-- interfere with record export or erasure. Other buckets are unchanged.
drop policy if exists "home photos registered insert guard" on storage.objects;
create policy "home photos registered insert guard"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id <> 'home-photos'
  or not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
);

drop policy if exists "home photos registered update guard" on storage.objects;
create policy "home photos registered update guard"
on storage.objects as restrictive for update to authenticated
using (
  bucket_id <> 'home-photos'
  or not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
)
with check (
  bucket_id <> 'home-photos'
  or not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
);

commit;
