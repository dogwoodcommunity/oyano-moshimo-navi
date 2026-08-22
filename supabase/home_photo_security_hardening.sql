-- Home photo uploads must go through an authenticated Web API before a signed
-- upload URL is issued.
-- - Legacy home_photos records rely on family membership policies.
-- - Notebook diary photos use home-photos/notebook/{user_id}/... and are
--   verified in /api/notebook/photo-upload-url and /api/notebook/sync before
--   signed upload/read URLs are returned.
drop policy if exists "home photos upload authenticated" on storage.objects;
