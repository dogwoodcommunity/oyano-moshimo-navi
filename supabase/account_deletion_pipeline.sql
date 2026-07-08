-- Account deletion request pipeline hardening for existing databases.
-- Run after schema.sql and before verify_setup.sql.

create table if not exists account_delete_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  contact_email text,
  reason text,
  status text not null default 'requested' check (status in ('requested', 'reviewing', 'needs_followup', 'completed')),
  requested_from text not null default 'mobile_app',
  due_at timestamptz not null default (now() + interval '30 days'),
  last_status_changed_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references profiles(id) on delete set null,
  handled_by_email text,
  handled_by_method text,
  handled_note text,
  audit_log_id uuid references audit_logs(id) on delete set null,
  created_at timestamptz default now()
);

alter table account_delete_requests
  add column if not exists user_id uuid references profiles(id) on delete set null,
  add column if not exists contact_email text,
  add column if not exists reason text,
  add column if not exists status text not null default 'requested',
  add column if not exists requested_from text not null default 'mobile_app',
  add column if not exists due_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists last_status_changed_at timestamptz not null default now(),
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references profiles(id) on delete set null,
  add column if not exists handled_by_email text,
  add column if not exists handled_by_method text,
  add column if not exists handled_note text,
  add column if not exists audit_log_id uuid references audit_logs(id) on delete set null,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_delete_requests_status_check'
  ) then
    alter table account_delete_requests
      add constraint account_delete_requests_status_check
      check (status in ('requested', 'reviewing', 'needs_followup', 'completed'));
  end if;
end;
$$;

create index if not exists idx_account_delete_requests_status_due
on account_delete_requests(status, due_at);

create index if not exists idx_account_delete_requests_user_status
on account_delete_requests(user_id, status);

create unique index if not exists idx_account_delete_requests_one_open
on account_delete_requests(user_id)
where status in ('requested', 'reviewing', 'needs_followup') and user_id is not null;

alter table account_delete_requests enable row level security;

drop policy if exists "account_delete_requests read own" on account_delete_requests;
create policy "account_delete_requests read own"
on account_delete_requests for select
using (user_id = auth.uid());

drop policy if exists "account_delete_requests admin read" on account_delete_requests;
create policy "account_delete_requests admin read"
on account_delete_requests for select
using (is_app_admin());
