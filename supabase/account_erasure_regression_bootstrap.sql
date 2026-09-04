-- Test-only Storage shim for the account-erasure regression.
-- Supabase projects already provide storage.objects.

create schema if not exists storage;
create table if not exists storage.objects (
  id uuid primary key,
  bucket_id text not null,
  name text not null,
  unique (bucket_id, name)
);
