-- Family-wide latest successful free AI consultation timestamp.
-- Run after schema.sql. The API uses this legacy-named column for the JST daily free allowance.

alter table public.families
  add column if not exists consult_trial_used_at timestamptz;

comment on column public.families.consult_trial_used_at is
  'Latest successful free AI consultation timestamp. Free families can consult once per JST calendar day.';

create index if not exists idx_families_consult_trial_used_at
on public.families(consult_trial_used_at);
