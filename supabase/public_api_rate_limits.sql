create table if not exists public_api_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public_api_rate_limits enable row level security;

create or replace function public.check_public_api_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
  v_count integer;
  v_window_start timestamptz;
  v_retry_after integer;
begin
  if p_key is null or length(p_key) < 8 then
    raise exception 'invalid_rate_limit_key';
  end if;

  if p_limit < 1 then
    raise exception 'invalid_rate_limit';
  end if;

  insert into public_api_rate_limits as limits (key, window_start, request_count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
  set
    window_start = case
      when limits.window_start <= v_now - v_window then v_now
      else limits.window_start
    end,
    request_count = case
      when limits.window_start <= v_now - v_window then 1
      else limits.request_count + 1
    end,
    updated_at = v_now
  returning request_count, window_start into v_count, v_window_start;

  v_retry_after := greatest(1, ceil(extract(epoch from (v_window_start + v_window - v_now)))::integer);

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'limit', p_limit,
    'remaining', greatest(p_limit - v_count, 0),
    'retry_after', case when v_count <= p_limit then 0 else v_retry_after end
  );
end;
$$;

revoke all on function public.check_public_api_rate_limit(text, integer, integer) from public;
grant execute on function public.check_public_api_rate_limit(text, integer, integer) to service_role;

create index if not exists idx_public_api_rate_limits_updated_at
on public_api_rate_limits(updated_at);
