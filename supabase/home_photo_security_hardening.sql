-- Home photo uploads must go through the authenticated Web API that verifies
-- family membership before issuing a signed upload URL.
drop policy if exists "home photos upload authenticated" on storage.objects;
