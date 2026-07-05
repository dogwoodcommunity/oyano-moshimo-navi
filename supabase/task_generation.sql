-- Generate checklist tasks whenever a person's status changes.
-- Run after schema.sql and task_template_seed.sql.

create or replace function public.generate_tasks_for_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tasks (
    person_id,
    template_id,
    title,
    description,
    priority,
    category,
    due_date,
    created_by
  )
  select
    new.person_id,
    task_templates.id,
    task_templates.title,
    task_templates.description,
    task_templates.priority,
    task_templates.category,
    case
      when task_templates.default_due_offset_days is null then null
      else new.event_date + task_templates.default_due_offset_days
    end,
    new.created_by
  from task_templates
  where task_templates.status = new.new_status
    and not exists (
      select 1
      from tasks
      where tasks.person_id = new.person_id
        and tasks.template_id = task_templates.id
    );

  update people
  set
    current_status = new.new_status,
    updated_at = now()
  where people.id = new.person_id
    and people.current_status is distinct from new.new_status;

  return new;
end;
$$;

drop trigger if exists trg_generate_tasks_for_status_event on person_status_events;

create trigger trg_generate_tasks_for_status_event
after insert on person_status_events
for each row
execute function public.generate_tasks_for_status_event();

