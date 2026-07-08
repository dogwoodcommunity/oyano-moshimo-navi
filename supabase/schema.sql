-- 親のもしもナビ v0.3 Supabase schema draft
-- This is a draft for Codex implementation. Enable RLS in production.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_user_id uuid references profiles(id) on delete set null,
  plan text not null default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists family_members (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member', -- owner/admin/member/viewer
  relationship text,
  created_at timestamptz default now(),
  unique(family_id, user_id)
);

create table if not exists people (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) on delete cascade,
  display_name text not null,
  relationship_to_family text,
  age_band text,
  residence_area text,
  current_status text not null default 'preparing',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists person_status_events (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid references people(id) on delete cascade,
  previous_status text,
  new_status text not null,
  event_date date default current_date,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists task_templates (
  id uuid primary key default uuid_generate_v4(),
  status text not null,
  title text not null,
  description text,
  default_due_offset_days integer,
  priority integer default 3,
  category text,
  requires_professional boolean default false,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid references people(id) on delete cascade,
  template_id uuid references task_templates(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo', -- todo/doing/done/skipped
  priority integer default 3,
  category text,
  due_date date,
  assigned_member_id uuid references family_members(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists asset_categories (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  label text not null,
  description text
);

create table if not exists asset_items (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid references people(id) on delete cascade,
  category_id uuid references asset_categories(id) on delete restrict,
  title text not null,
  existence_status text not null default 'unknown', -- unknown/exists/not_exists
  location_note text,
  owner_note text,
  visibility text not null default 'family',
  sensitive_note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists timeline_events (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid references people(id) on delete cascade,
  event_type text not null,
  event_date date default current_date,
  title text not null,
  body text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists homes (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid references people(id) on delete cascade,
  property_type text, -- house/apartment/land/other
  city text,
  vacancy_status text, -- occupied/vacant/soon_vacant/unknown
  key_location_note text,
  utilities_note text,
  household_goods_level text, -- low/medium/high/unknown
  direction text, -- keep/sell/rent/demolish/undecided
  inheritance_registration_status text, -- done/not_done/unknown
  family_agreement_status text, -- agreed/not_agreed/unknown
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists home_photos (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references homes(id) on delete cascade,
  storage_path text not null,
  photo_type text,
  caption text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists home_diagnoses (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references homes(id) on delete cascade,
  diagnosis_type text,
  summary text,
  recommended_steps jsonb default '[]'::jsonb,
  provider_categories jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists cases (
  id uuid primary key default uuid_generate_v4(),
  anonymous_token text unique,
  user_id uuid references profiles(id) on delete set null,
  family_id uuid references families(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  source text,
  medium text,
  campaign text,
  referrer_id text,
  selected_status text,
  answers jsonb not null default '{}'::jsonb,
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_line_id text,
  consent_to_contact boolean default false,
  consent_to_provider_share boolean default false,
  status text not null default 'draft', -- draft/submitted/result_ready/converted/closed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists case_photos (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade,
  storage_path text not null,
  photo_type text,
  created_at timestamptz default now()
);

create table if not exists case_results (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade,
  diagnosis_type text,
  summary text,
  first_steps jsonb default '[]'::jsonb,
  tasks jsonb default '[]'::jsonb,
  provider_categories jsonb default '[]'::jsonb,
  app_handoff_token text unique,
  app_handoff_consumed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists family_invites (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) on delete cascade,
  invited_email text,
  invited_phone text,
  role text not null default 'member',
  relationship text,
  token text unique not null,
  status text not null default 'pending',
  expires_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists share_links (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  case_id uuid references cases(id) on delete set null,
  token text unique not null,
  purpose text not null,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  device_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, expo_push_token)
);

create table if not exists notification_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  reminders_enabled boolean default true,
  daily_digest_enabled boolean default true,
  urgent_enabled boolean default true,
  quiet_hours jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists scheduled_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  notification_type text not null default 'due_1d',
  scheduled_for timestamptz not null,
  status text not null default 'scheduled',
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, task_id, notification_type)
);

create table if not exists provider_categories (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  label text not null,
  provider_type text not null -- business/professional
);

create table if not exists providers (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references provider_categories(id) on delete restrict,
  name text not null,
  provider_type text not null, -- business/professional
  city text,
  service_area text,
  license_notes text,
  insurance_notes text,
  fee_policy text,
  contact_note text,
  status text not null default 'draft', -- draft/active/suspended
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists provider_recommendations (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade,
  provider_id uuid references providers(id) on delete set null,
  category_id uuid references provider_categories(id) on delete set null,
  reason text,
  display_order integer default 1,
  created_at timestamptz default now()
);

create table if not exists referrals (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete cascade,
  provider_id uuid references providers(id) on delete set null,
  referred_by uuid references profiles(id) on delete set null,
  status text not null default 'draft', -- draft/sent/contacted/closed/cancelled
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists consent_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  case_id uuid references cases(id) on delete set null,
  consent_type text not null,
  consent_text text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  name text not null,
  product_type text not null, -- subscription/support_pack/provider_listing
  price_yen integer,
  billing_period text,
  active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  family_id uuid references families(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  provider text not null, -- stripe/apple/google/manual
  provider_checkout_id text,
  amount_yen integer,
  status text not null default 'pending',
  purchased_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  provider text not null,
  provider_subscription_id text,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists support_packs (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id) on delete set null,
  family_id uuid references families(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  purchase_id uuid references purchases(id) on delete set null,
  status text not null default 'requested', -- requested/paid/reviewing/report_ready/delivered/closed
  requested_scope jsonb default '{}'::jsonb,
  assigned_admin_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists support_reviews (
  id uuid primary key default uuid_generate_v4(),
  support_pack_id uuid references support_packs(id) on delete cascade,
  reviewer_id uuid references profiles(id) on delete set null,
  report_summary text,
  priority_tasks jsonb default '[]'::jsonb,
  family_meeting_notes text,
  provider_categories jsonb default '[]'::jsonb,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists admin_notes (
  id uuid primary key default uuid_generate_v4(),
  target_type text not null,
  target_id uuid not null,
  admin_user_id uuid references profiles(id) on delete set null,
  note text not null,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Seeds
insert into asset_categories (key, label, description) values
('bank', '銀行', '銀行名・支店名・通帳やカードの保管場所'),
('insurance', '保険', '保険会社・証券の保管場所'),
('pension', '年金', '年金証書や関連書類の有無'),
('real_estate', '不動産', '実家・土地・登記書類の場所'),
('funeral', '葬儀', '宗派・菩提寺・希望・連絡先'),
('grave', 'お墓', '墓地・納骨先・墓じまい希望'),
('important_documents', '重要書類', '実印・遺言書・権利書など'),
('digital', 'デジタル', 'スマホ・PC・主要アカウントの存在'),
('home', '実家', '鍵・ライフライン・家財・空き家状況')
on conflict (key) do nothing;

insert into provider_categories (key, label, provider_type) values
('estate_cleanout', '家財整理・遺品整理', 'business'),
('vacant_home_management', '空き家管理', 'business'),
('real_estate', '不動産相談', 'business'),
('demolition', '解体', 'business'),
('judicial_scrivener', '司法書士', 'professional'),
('tax_accountant', '税理士', 'professional'),
('lawyer', '弁護士', 'professional'),
('administrative_scrivener', '行政書士', 'professional')
on conflict (key) do nothing;
