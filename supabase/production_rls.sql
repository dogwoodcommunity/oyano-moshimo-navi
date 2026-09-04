-- Production RLS setup for 親のもしもナビ v0.3
-- Run after supabase/schema.sql.
-- This keeps anonymous web diagnosis writes behind Next.js server APIs using the service role key.

alter table profiles enable row level security;
alter table app_admins enable row level security;
alter table account_delete_executors enable row level security;
alter table account_delete_executors force row level security;
alter table families enable row level security;
alter table family_members enable row level security;
alter table people enable row level security;
alter table person_status_events enable row level security;
alter table task_templates enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table asset_categories enable row level security;
alter table asset_items enable row level security;
alter table timeline_events enable row level security;
alter table person_ai_memories enable row level security;
alter table ai_consult_threads enable row level security;
alter table ai_consult_turns enable row level security;
alter table ai_memory_consents enable row level security;
alter table homes enable row level security;
alter table home_photos enable row level security;
alter table home_diagnoses enable row level security;
alter table cases enable row level security;
alter table case_photos enable row level security;
alter table case_results enable row level security;
alter table family_invites enable row level security;
alter table share_links enable row level security;
alter table push_tokens enable row level security;
alter table notification_preferences enable row level security;
alter table scheduled_notifications enable row level security;
alter table provider_categories enable row level security;
alter table providers enable row level security;
alter table provider_recommendations enable row level security;
alter table referrals enable row level security;
alter table sponsor_applications enable row level security;
alter table partners enable row level security;
alter table prefecture_usage_snapshots enable row level security;
alter table consent_logs enable row level security;
alter table products enable row level security;
alter table purchases enable row level security;
alter table subscriptions enable row level security;
alter table support_packs enable row level security;
alter table support_reviews enable row level security;
alter table admin_notes enable row level security;
alter table audit_logs enable row level security;
alter table account_delete_requests enable row level security;

create or replace function is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members
    where family_members.family_id = target_family_id
      and family_members.user_id = auth.uid()
  );
$$;

create or replace function is_family_admin(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members
    where family_members.family_id = target_family_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin')
  );
$$;

-- Content editors may add/update the shared notebook. A viewer is deliberately
-- excluded here even though is_family_member() must continue to allow reads.
-- Family administration and the person's basic profile remain owner/admin-only.
create or replace function is_family_editor(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members
    where family_members.family_id = target_family_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_admins
    where app_admins.user_id = auth.uid()
  );
$$;

-- PostgreSQL gives new functions EXECUTE to PUBLIC by default. These helpers
-- are intended only for authenticated RLS evaluation (and trusted service
-- operations), so keep anonymous PostgREST callers out explicitly.
revoke all on function is_family_member(uuid) from public, anon;
revoke all on function is_family_admin(uuid) from public, anon;
revoke all on function is_family_editor(uuid) from public, anon;
revoke all on function is_app_admin() from public, anon;
grant execute on function is_family_member(uuid) to authenticated, service_role;
grant execute on function is_family_admin(uuid) to authenticated, service_role;
grant execute on function is_family_editor(uuid) to authenticated, service_role;
grant execute on function is_app_admin() to authenticated, service_role;

create policy "app_admins read own"
on app_admins for select
using (user_id = auth.uid());

create policy "profiles read own"
on profiles for select
using (id = auth.uid());

create policy "profiles update own"
on profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "account_delete_requests read own"
on account_delete_requests for select
using (user_id = auth.uid());

create policy "account_delete_requests admin read"
on account_delete_requests for select
using (is_app_admin());

create policy "families read members"
on families for select
using (is_family_member(id));

-- Family ownership and other family-row mutations are RPC-only. A row policy
-- cannot distinguish a harmless rename from replacing owner_user_id, so the
-- atomic family_management_rpc.sql surface deliberately keeps direct updates
-- closed for authenticated clients.
drop policy if exists "families update admins" on families;

create policy "family_members read family"
on family_members for select
using (is_family_member(family_id));

drop policy if exists "family_members manage admins" on family_members;

drop policy if exists "family_members update admins" on family_members;
drop policy if exists "family_members delete admins" on family_members;

create policy "people read family"
on people for select
using (is_family_member(family_id));

create policy "people manage family admins"
on people for all
using (is_family_admin(family_id))
with check (is_family_admin(family_id));

create policy "status_events read family"
on person_status_events for select
using (
  exists (
    select 1 from people
    where people.id = person_status_events.person_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "status_events insert family" on person_status_events;

create policy "status_events insert family"
on person_status_events for insert
to authenticated
with check (
  exists (
    select 1
    from people
    join family_members on family_members.family_id = people.family_id
    where people.id = person_status_events.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
);

create policy "tasks read family"
on tasks for select
using (
  exists (
    select 1 from people
    where people.id = tasks.person_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "tasks manage family" on tasks;

create policy "tasks manage family"
on tasks for all
to authenticated
using (
  exists (
    select 1
    from people
    join family_members on family_members.family_id = people.family_id
    where people.id = tasks.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
)
with check (
  exists (
    select 1
    from people
    join family_members on family_members.family_id = people.family_id
    where people.id = tasks.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
);

create policy "task_comments read family"
on task_comments for select
using (
  exists (
    select 1
    from tasks
    join people on people.id = tasks.person_id
    where tasks.id = task_comments.task_id
      and is_family_member(people.family_id)
  )
);

create policy "asset_items read family"
on asset_items for select
using (
  exists (
    select 1 from people
    where people.id = asset_items.person_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "asset_items manage family" on asset_items;

create policy "asset_items manage family"
on asset_items for all
to authenticated
using (
  exists (
    select 1 from people
    where people.id = asset_items.person_id
      and is_family_editor(people.family_id)
  )
)
with check (
  exists (
    select 1 from people
    where people.id = asset_items.person_id
      and is_family_editor(people.family_id)
  )
);

create policy "timeline_events read family"
on timeline_events for select
using (
  exists (
    select 1 from people
    where people.id = timeline_events.person_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "timeline_events manage family" on timeline_events;

create policy "timeline_events manage family"
on timeline_events for all
to authenticated
using (
  exists (
    select 1
    from people
    join family_members on family_members.family_id = people.family_id
    where people.id = timeline_events.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
)
with check (
  exists (
    select 1
    from people
    join family_members on family_members.family_id = people.family_id
    where people.id = timeline_events.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists "person_ai_memories read family" on person_ai_memories;
create policy "person_ai_memories read family"
on person_ai_memories for select
to authenticated
using (
  exists (
    select 1 from people
    where people.id = person_ai_memories.person_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "person_ai_memories insert family" on person_ai_memories;
drop policy if exists "person_ai_memories update family" on person_ai_memories;
drop policy if exists "person_ai_memories delete family" on person_ai_memories;

drop policy if exists "ai_consult_threads owner family access" on ai_consult_threads;
drop policy if exists "ai_consult_threads owner family read" on ai_consult_threads;
create policy "ai_consult_threads owner family read"
on ai_consult_threads for select
to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1 from people
    where people.id = ai_consult_threads.person_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "ai_consult_turns owner family access" on ai_consult_turns;
drop policy if exists "ai_consult_turns owner family read" on ai_consult_turns;
create policy "ai_consult_turns owner family read"
on ai_consult_turns for select
to authenticated
using (
  exists (
    select 1
    from ai_consult_threads
    join people on people.id = ai_consult_threads.person_id
    where ai_consult_threads.id = ai_consult_turns.thread_id
      and ai_consult_threads.owner_user_id = auth.uid()
      and is_family_member(people.family_id)
  )
);

drop policy if exists "ai_memory_consents own family read" on ai_memory_consents;
create policy "ai_memory_consents own family read"
on ai_memory_consents for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from people
    where people.id = ai_memory_consents.person_id
      and is_family_member(people.family_id)
  )
);

create policy "homes read family"
on homes for select
using (
  exists (
    select 1 from people
    where people.id = homes.person_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "homes manage family" on homes;

create policy "homes manage family"
on homes for all
to authenticated
using (
  exists (
    select 1 from people
    where people.id = homes.person_id
      and is_family_editor(people.family_id)
  )
)
with check (
  exists (
    select 1 from people
    where people.id = homes.person_id
      and is_family_editor(people.family_id)
  )
);

create policy "home_photos read family"
on home_photos for select
using (
  exists (
    select 1
    from homes
    join people on people.id = homes.person_id
    where homes.id = home_photos.home_id
      and is_family_member(people.family_id)
  )
);

drop policy if exists "home_photos manage family" on home_photos;

create policy "home_photos manage family"
on home_photos for all
to authenticated
using (
  exists (
    select 1
    from homes
    join people on people.id = homes.person_id
    where homes.id = home_photos.home_id
      and is_family_editor(people.family_id)
  )
)
with check (
  exists (
    select 1
    from homes
    join people on people.id = homes.person_id
    where homes.id = home_photos.home_id
      and is_family_editor(people.family_id)
  )
);

create policy "push_tokens own"
on push_tokens for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notification_preferences own"
on notification_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "scheduled_notifications own"
on scheduled_notifications for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "task_templates public read"
on task_templates for select
using (true);

create policy "asset_categories public read"
on asset_categories for select
using (true);

create policy "provider_categories public read"
on provider_categories for select
using (true);

create policy "providers active public read"
on providers for select
using (status = 'active');

create policy "admin read sponsor_applications"
on sponsor_applications for select
using (is_app_admin());

create policy "admin read partners"
on partners for select
using (is_app_admin());

create policy "admin read prefecture_usage_snapshots"
on prefecture_usage_snapshots for select
using (is_app_admin());

create policy "products active public read"
on products for select
using (active = true);

create policy "admin read cases"
on cases for select
using (is_app_admin());

create policy "admin read case_results"
on case_results for select
using (is_app_admin());

create policy "admin read support_packs"
on support_packs for select
using (is_app_admin());

create policy "admin read purchases"
on purchases for select
using (is_app_admin());

create policy "admin read audit_logs"
on audit_logs for select
using (is_app_admin());
