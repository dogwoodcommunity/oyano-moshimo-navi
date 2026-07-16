-- Add task templates for the "post_discharge_home" status.
-- Run once on existing production databases after task_template_seed.sql has already been applied.

insert into task_templates (status, title, description, default_due_offset_days, priority, category, requires_professional)
select *
from (
  values
    (
      'post_discharge_home',
      '退院後の生活体制を確認する',
      '退院日、通院予定、服薬、食事、入浴、移動、見守りの担当を整理します。',
      3,
      1,
      'care',
      false
    ),
    (
      'post_discharge_home',
      '在宅サービスと連絡先をまとめる',
      'ケアマネ、訪問看護、訪問介護、福祉用具、かかりつけ医の連絡先を控えます。',
      7,
      1,
      'home_care',
      false
    ),
    (
      'post_discharge_home',
      '家の中の危ない場所を確認する',
      '段差、浴室、トイレ、寝室、玄関、緊急時の鍵の扱いを家族で確認します。',
      7,
      2,
      'home',
      false
    )
) as new_templates(status, title, description, default_due_offset_days, priority, category, requires_professional)
where not exists (
  select 1
  from task_templates
  where task_templates.status = new_templates.status
    and task_templates.title = new_templates.title
);
