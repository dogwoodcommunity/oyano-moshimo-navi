-- 測るのは1つの数字だけ。
--   危機モードを開いた人のうち、対象者を登録し、7日以内に2件目の記録を書いた割合。
--
-- 個人情報は入れない。端末ごとに振る匿名IDと、イベント名と、時刻だけを持つ。
-- 書き込みはサーバー（service role）からのみ。RLSは有効のまま、ポリシーを作らない。

create table if not exists funnel_events (
  id uuid primary key default uuid_generate_v4(),
  anon_id text not null,
  event text not null,
  platform text not null default 'web',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table funnel_events enable row level security;

create index if not exists funnel_events_anon_idx on funnel_events (anon_id, created_at);
create index if not exists funnel_events_event_idx on funnel_events (event, created_at);

-- 匿名IDの粒度は端末単位。Web入口とアプリはIDが分かれるため、
-- 「Webで危機モードを見た人がアプリで続けたか」は追えない。
-- そこはアプリ内の数字とWeb入口の数字を別々に見る前提にしている。

create or replace function public.funnel_summary(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with scoped as (
  select * from funnel_events
  where created_at > now() - make_interval(days => greatest(p_days, 1))
),
opened as (
  select anon_id, platform, min(created_at) as opened_at
  from scoped where event = 'crisis_opened'
  group by anon_id, platform
),
created_person as (
  select anon_id, min(created_at) as created_at
  from scoped where event = 'person_created'
  group by anon_id
),
records as (
  select s.anon_id, count(*) as record_count
  from scoped s
  join created_person c on c.anon_id = s.anon_id
  where s.event = 'record_written'
    and s.created_at <= c.created_at + interval '7 days'
  group by s.anon_id
)
select jsonb_build_object(
  'days', greatest(p_days, 1),
  'crisisOpened', (select count(*) from opened),
  'crisisOpenedApp', (select count(*) from opened where platform = 'app'),
  'crisisOpenedWeb', (select count(*) from opened where platform = 'web'),
  'personCreated', (select count(*) from opened o join created_person c on c.anon_id = o.anon_id),
  'returnedWithin7Days', (
    select count(*)
    from opened o
    join created_person c on c.anon_id = o.anon_id
    join records r on r.anon_id = o.anon_id
    where r.record_count >= 2
  ),
  'eventTotals', (
    select coalesce(jsonb_object_agg(event, total), '{}'::jsonb)
    from (select event, count(*) as total from scoped group by event) t
  )
);
$$;

revoke execute on function public.funnel_summary(integer) from anon, authenticated;
