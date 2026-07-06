-- API role grants for Supabase/PostgREST.
-- Run after schema.sql and before production verification.
-- RLS still controls anon/authenticated access; these grants only allow the API roles
-- to reach the tables/functions that policies then restrict.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select, update on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

grant select, insert, update on cases to anon;
grant select, insert, update on case_results to anon;
grant select, insert on consent_logs to anon;
grant usage, select, update on all sequences in schema public to anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;
