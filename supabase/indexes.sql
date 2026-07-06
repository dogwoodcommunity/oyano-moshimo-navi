-- Performance indexes for 親のもしもナビ v0.3
-- Run after schema.sql.

create index if not exists idx_family_members_user_id on family_members(user_id);
create index if not exists idx_family_members_family_id on family_members(family_id);
create index if not exists idx_family_invites_family_status on family_invites(family_id, status, created_at);
create unique index if not exists idx_family_invites_token_unique on family_invites(token);
create index if not exists idx_people_family_id on people(family_id);
create index if not exists idx_people_current_status on people(current_status);
create index if not exists idx_person_status_events_person_id on person_status_events(person_id);
create index if not exists idx_task_templates_status on task_templates(status);
create index if not exists idx_tasks_person_id on tasks(person_id);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_asset_items_person_id on asset_items(person_id);
create index if not exists idx_timeline_events_person_id on timeline_events(person_id);
create index if not exists idx_homes_person_id on homes(person_id);
create index if not exists idx_home_photos_home_id on home_photos(home_id);
create index if not exists idx_cases_status on cases(status);
create index if not exists idx_cases_created_at on cases(created_at);
create index if not exists idx_case_results_case_id on case_results(case_id);
create index if not exists idx_support_packs_case_id on support_packs(case_id);
create index if not exists idx_support_packs_status on support_packs(status);
create index if not exists idx_push_tokens_user_id on push_tokens(user_id);
create index if not exists idx_scheduled_notifications_status_for on scheduled_notifications(status, scheduled_for);
create index if not exists idx_scheduled_notifications_user_day on scheduled_notifications(user_id, scheduled_for);
create index if not exists idx_scheduled_notifications_task_type on scheduled_notifications(task_id, notification_type);
create index if not exists idx_provider_recommendations_case_id on provider_recommendations(case_id);
create index if not exists idx_purchases_provider_checkout_id on purchases(provider_checkout_id);
