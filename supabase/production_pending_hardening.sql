-- Run this in Supabase SQL Editor after the initial v0.3 setup.
-- It contains production hardening added after the first schema import.

-- 1. Web-to-app handoff tokens are one-time use.
alter table case_results
  add column if not exists app_handoff_consumed_at timestamptz;

create index if not exists idx_case_results_handoff_valid
on case_results(case_id, app_handoff_token, created_at)
where app_handoff_token is not null
  and app_handoff_consumed_at is null;

-- 2. Sensitive information consent is recorded per diagnosis.
alter table cases
  add column if not exists consent_to_sensitive_info boolean default false,
  add column if not exists sensitive_info_consent_version text,
  add column if not exists sensitive_info_consented_at timestamptz;

create index if not exists idx_consent_logs_case_type
on consent_logs(case_id, consent_type, created_at desc);
