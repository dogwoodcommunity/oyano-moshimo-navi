-- 親のもしもナビ: 地域スポンサー指標・親居住地データ
-- Existing production DB hardening/addition.
-- Source of truth for regional matching is the parent's prefecture, not the user's address.

alter table people
  add column if not exists prefecture text,
  add column if not exists city text;

create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  prefecture text not null,
  city text,
  category text not null,
  company_name text not null,
  contact_email text,
  website text,
  status text not null default 'open',
  page_views integer not null default 0,
  taps integer not null default 0,
  inquiries integer not null default 0,
  starts_on date,
  ends_on date,
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table partners
  add column if not exists prefecture text,
  add column if not exists city text,
  add column if not exists category text,
  add column if not exists company_name text,
  add column if not exists contact_email text,
  add column if not exists website text,
  add column if not exists status text default 'open',
  add column if not exists page_views integer default 0,
  add column if not exists taps integer default 0,
  add column if not exists inquiries integer default 0,
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists admin_note text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update partners
set
  status = coalesce(status, 'open'),
  page_views = coalesce(page_views, 0),
  taps = coalesce(taps, 0),
  inquiries = coalesce(inquiries, 0);

alter table partners
  alter column prefecture set not null,
  alter column category set not null,
  alter column company_name set not null,
  alter column status set not null,
  alter column page_views set not null,
  alter column taps set not null,
  alter column inquiries set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partners_prefecture_category_key'
  ) then
    alter table partners
      add constraint partners_prefecture_category_key unique (prefecture, category);
  end if;
end;
$$;

create index if not exists idx_people_prefecture on people(prefecture);
create index if not exists idx_partners_region_category_status on partners(prefecture, category, status);

create table if not exists prefecture_usage_snapshots (
  id uuid primary key default uuid_generate_v4(),
  snapshot_month date not null,
  prefecture text not null,
  active_users integer not null default 0,
  active_families integer not null default 0,
  created_at timestamptz default now(),
  unique(snapshot_month, prefecture)
);

create index if not exists idx_prefecture_usage_snapshots_month
  on prefecture_usage_snapshots(snapshot_month);

create or replace view prefecture_active_family_current_counts as
with prefectures(prefecture) as (
  values
    ('北海道'), ('青森県'), ('岩手県'), ('宮城県'), ('秋田県'), ('山形県'), ('福島県'),
    ('茨城県'), ('栃木県'), ('群馬県'), ('埼玉県'), ('千葉県'), ('東京都'), ('神奈川県'),
    ('新潟県'), ('富山県'), ('石川県'), ('福井県'), ('山梨県'), ('長野県'), ('岐阜県'),
    ('静岡県'), ('愛知県'), ('三重県'), ('滋賀県'), ('京都府'), ('大阪府'), ('兵庫県'),
    ('奈良県'), ('和歌山県'), ('鳥取県'), ('島根県'), ('岡山県'), ('広島県'), ('山口県'),
    ('徳島県'), ('香川県'), ('愛媛県'), ('高知県'), ('福岡県'), ('佐賀県'), ('長崎県'),
    ('熊本県'), ('大分県'), ('宮崎県'), ('鹿児島県'), ('沖縄県')
),
eligible_families as (
  select distinct p.family_id, p.prefecture, p.created_at
  from people p
  where coalesce(p.prefecture, '') <> ''
    and (
      exists (
        select 1
        from family_members fm
        where fm.family_id = p.family_id
          and fm.role <> 'owner'
      )
      or exists (
        select 1
        from family_invites fi
        where fi.family_id = p.family_id
          and fi.status = 'pending'
          and fi.created_at > now() - interval '7 days'
      )
    )
),
current_counts as (
  select
    ef.prefecture,
    count(distinct ef.family_id)::integer as active_families,
    count(distinct fm.user_id)::integer as active_users
  from eligible_families ef
  left join family_members fm on fm.family_id = ef.family_id
  group by ef.prefecture
)
select
  prefectures.prefecture,
  coalesce(current_counts.active_users, 0) as active_users,
  coalesce(current_counts.active_families, 0) as active_families
from prefectures
left join current_counts on current_counts.prefecture = prefectures.prefecture;

create or replace function capture_prefecture_usage_snapshot(
  p_snapshot_month date default date_trunc('month', now())::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- This is a monthly accounting snapshot for sponsor sales metrics.
  -- Run once on the first day of each month. Re-running mid-month rewrites
  -- that month's fixed value and should only happen for an explicit correction.
  insert into prefecture_usage_snapshots (
    snapshot_month,
    prefecture,
    active_users,
    active_families
  )
  select
    date_trunc('month', p_snapshot_month)::date,
    prefecture,
    active_users,
    active_families
  from prefecture_active_family_current_counts
  on conflict (snapshot_month, prefecture) do update
  set
    active_users = excluded.active_users,
    active_families = excluded.active_families,
    created_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function capture_prefecture_usage_snapshot(date) from public;
grant execute on function capture_prefecture_usage_snapshot(date) to service_role;

create or replace view prefecture_active_family_counts as
with current_counts as (
  select *
  from prefecture_active_family_current_counts
),
previous_counts as (
  select
    prefecture,
    active_users as previous_month_users,
    active_families as previous_month_families
  from prefecture_usage_snapshots
  where snapshot_month = (date_trunc('month', now()) - interval '1 month')::date
)
select
  current_counts.prefecture,
  current_counts.active_users,
  current_counts.active_families,
  coalesce(previous_counts.previous_month_users, 0) as previous_month_users,
  coalesce(previous_counts.previous_month_families, 0) as previous_month_families,
  current_counts.active_users - coalesce(previous_counts.previous_month_users, 0)
    as month_over_month_users,
  current_counts.active_families - coalesce(previous_counts.previous_month_families, 0)
    as month_over_month_families
from current_counts
left join previous_counts on previous_counts.prefecture = current_counts.prefecture;

alter table partners enable row level security;
alter table prefecture_usage_snapshots enable row level security;

drop policy if exists "admin read partners" on partners;
create policy "admin read partners"
on partners for select
using (is_app_admin());

drop policy if exists "admin read prefecture usage snapshots" on prefecture_usage_snapshots;
create policy "admin read prefecture usage snapshots"
on prefecture_usage_snapshots for select
using (is_app_admin());

grant select on partners to service_role;
grant select, insert, update on prefecture_usage_snapshots to service_role;
grant select on prefecture_active_family_current_counts to service_role;
grant select on prefecture_active_family_counts to service_role;
