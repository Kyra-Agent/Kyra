begin;

-- Owner chats reach the agent brain, which is billed per call. Cap how often
-- one agent's owner chat can use it so a single account cannot drain the
-- platform's model credits: 30 answers per 10 minutes, 300 per day.
create table if not exists public.telegram_owner_brain_usage (
  agent_id uuid not null
    references public.agent_instances(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (agent_id, window_start),
  constraint telegram_owner_brain_usage_count_check
    check (request_count between 0 and 1000)
);

create index if not exists telegram_owner_brain_usage_window_idx
  on public.telegram_owner_brain_usage (window_start);

alter table public.telegram_owner_brain_usage enable row level security;

revoke all privileges on public.telegram_owner_brain_usage
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.telegram_owner_brain_usage
  to service_role;

create or replace function public.consume_telegram_owner_brain_quota(
  p_agent_id uuid
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_window timestamptz := date_bin(interval '10 minutes', now(), timestamptz '2000-01-01');
  v_window_count integer;
  v_day_count integer;
begin
  select coalesce(sum(usage.request_count), 0) into v_day_count
  from public.telegram_owner_brain_usage usage
  where usage.agent_id = p_agent_id
    and usage.window_start > now() - interval '24 hours';

  if v_day_count >= 300 then
    return 'daily_limited';
  end if;

  select coalesce(sum(usage.request_count), 0) into v_window_count
  from public.telegram_owner_brain_usage usage
  where usage.agent_id = p_agent_id
    and usage.window_start = v_window;

  if v_window_count >= 30 then
    return 'burst_limited';
  end if;

  insert into public.telegram_owner_brain_usage (agent_id, window_start, request_count)
  values (p_agent_id, v_window, 1)
  on conflict (agent_id, window_start)
  do update set request_count = public.telegram_owner_brain_usage.request_count + 1;

  return 'allowed';
end;
$$;

revoke all on function public.consume_telegram_owner_brain_quota(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_telegram_owner_brain_quota(uuid)
  to service_role;

select cron.schedule(
  'kyra-purge-telegram-owner-brain-usage',
  '17 * * * *',
  $purge$delete from public.telegram_owner_brain_usage where window_start < now() - interval '25 hours'$purge$
);

-- The monitor checks watch items and launch digests in rotation, least
-- recently checked first, so busy agents cannot starve later ones.
alter table public.agent_watch_items
  add column if not exists checked_at timestamptz;
create index if not exists agent_watch_items_checked_idx
  on public.agent_watch_items (checked_at asc nulls first);

alter table public.agent_launch_subscriptions
  add column if not exists attempted_at timestamptz;

commit;
