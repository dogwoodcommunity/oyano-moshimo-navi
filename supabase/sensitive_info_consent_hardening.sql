alter table cases
  add column if not exists consent_to_sensitive_info boolean default false,
  add column if not exists sensitive_info_consent_version text,
  add column if not exists sensitive_info_consented_at timestamptz;

create index if not exists idx_consent_logs_case_type
on consent_logs(case_id, consent_type, created_at desc);
