-- 都道府県別スポンサー営業数字の月次スナップショットcron
-- 実行タイミング: regional_sponsor_data.sql 適用後
-- 意味論:
-- - 毎月1日 00:10 UTC（日本時間09:10）に、その月の確定値を1回だけ保存する。
-- - 月途中の手動再実行は禁止。訂正が必要な場合だけ、管理者が理由を残して再実行する。
-- - 前月比は prefecture_usage_snapshots の確定値との差分で見る。

create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'capture-prefecture-usage-snapshot';

select cron.schedule(
  'capture-prefecture-usage-snapshot',
  '10 0 1 * *',
  $$select public.capture_prefecture_usage_snapshot(date_trunc('month', now())::date);$$
);
