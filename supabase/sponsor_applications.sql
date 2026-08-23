create table if not exists sponsor_applications (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  prefecture text not null,
  city text,
  category text not null,
  slot_type text not null,
  website text,
  budget_note text,
  message text,
  consent_to_contact boolean not null default false,
  status text not null default 'new',
  admin_note text,
  ip_address text,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sponsor_applications enable row level security;

drop policy if exists "admin read sponsor_applications" on sponsor_applications;
create policy "admin read sponsor_applications"
on sponsor_applications for select
using (is_app_admin());

create index if not exists idx_sponsor_applications_region_category
on sponsor_applications(prefecture, category, status);

create index if not exists idx_sponsor_applications_created_at
on sponsor_applications(created_at desc);
