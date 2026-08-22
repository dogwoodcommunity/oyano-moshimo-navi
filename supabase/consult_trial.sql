-- Family-wide first successful AI consultation trial.
-- Run after schema.sql. The API marks this timestamp only after a consult succeeds.

alter table public.families
  add column if not exists consult_trial_used_at timestamptz;

comment on column public.families.consult_trial_used_at is
  'First successful free AI consultation timestamp. Null means the family trial is still available.';

create index if not exists idx_families_consult_trial_used_at
on public.families(consult_trial_used_at);
