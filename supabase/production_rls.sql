-- Production RLS setup for 親のもしもナビ v0.3
-- Run after supabase/schema.sql.
-- This keeps anonymous web diagnosis writes behind Next.js server APIs using the service role key.

alter table profiles enable row level security;
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
alter table consent_logs enable row level security;
alter table products enable row level security;
alter table purchases enable row level security;
alter table subscriptions enable row level security;
alter table support_packs enable row level security;
alter table support_reviews enable row level security;
alter table admin_notes enable row level security;
alter table audit_logs enable row level security;

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

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members
    where family_members.user_id = auth.uid()
      and family_members.role = 'admin'
      and family_members.relationship = 'app_admin'
  );
$$;

create policy "profiles read own"
on profiles for select
using (id = auth.uid());

create policy "profiles update own"
on profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "families read members"
on families for select
using (is_family_member(id));

create policy "families update admins"
on families for update
using (is_family_admin(id))
with check (is_family_admin(id));

create policy "family_members read family"
on family_members for select
using (is_family_member(family_id));

create policy "family_members manage admins"
on family_members for all
using (is_family_admin(family_id))
with check (is_family_admin(family_id));

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

create policy "tasks read family"
on tasks for select
using (
  exists (
    select 1 from people
    where people.id = tasks.person_id
      and is_family_member(people.family_id)
  )
);

create policy "tasks manage family"
on tasks for all
using (
  exists (
    select 1 from people
    where people.id = tasks.person_id
      and is_family_member(people.family_id)
  )
)
with check (
  exists (
    select 1 from people
    where people.id = tasks.person_id
      and is_family_member(people.family_id)
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

create policy "timeline_events read family"
on timeline_events for select
using (
  exists (
    select 1 from people
    where people.id = timeline_events.person_id
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

create policy "push_tokens own"
on push_tokens for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notification_preferences own"
on notification_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "scheduled_notifications own"
on scheduled_notifications for select
using (user_id = auth.uid());

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
