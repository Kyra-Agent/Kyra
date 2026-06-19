begin;

do $$
begin
  if to_regclass('public.workspaces') is null then
    raise exception 'public.workspaces missing';
  end if;
  if to_regclass('public.agent_instances') is null then
    raise exception 'public.agent_instances missing';
  end if;
  if to_regclass('public.base_mcp_status_rate_limits') is not null then
    raise exception 'public.base_mcp_status_rate_limits already exists';
  end if;
end;
$$;

create table public.base_mcp_status_rate_limits (
  agent_id uuid primary key references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  minute_window_started_at timestamptz not null,
  minute_count integer not null,
  hour_window_started_at timestamptz not null,
  hour_count integer not null,
  updated_at timestamptz not null default now(),
  constraint base_mcp_status_minute_count_check
    check (minute_count between 0 and 6),
  constraint base_mcp_status_hour_count_check
    check (hour_count between 0 and 60),
  constraint base_mcp_status_window_order_check
    check (
      minute_window_started_at <= updated_at
      and hour_window_started_at <= updated_at
    )
);

alter table public.base_mcp_status_rate_limits enable row level security;

revoke all privileges on public.base_mcp_status_rate_limits from public;
revoke all privileges on public.base_mcp_status_rate_limits from anon;
revoke all privileges on public.base_mcp_status_rate_limits from authenticated;
revoke all privileges on public.base_mcp_status_rate_limits from service_role;
grant select, insert, update on public.base_mcp_status_rate_limits to service_role;

create or replace function public.consume_base_mcp_status_rate_limit(
  p_owner_user_id uuid,
  p_workspace_id uuid,
  p_agent_id uuid
)
returns table (allowed boolean, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_started timestamptz;
  v_minute_count integer;
  v_hour_started timestamptz;
  v_hour_count integer;
begin
  if not exists (
    select 1
    from public.agent_instances a
    join public.workspaces w on w.id = a.workspace_id
    where a.id = p_agent_id
      and a.workspace_id = p_workspace_id
      and w.owner_user_id = p_owner_user_id
  ) then
    raise exception 'Base MCP rate limit scope rejected';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_agent_id::text, 0));

  select minute_window_started_at, minute_count,
         hour_window_started_at, hour_count
    into v_minute_started, v_minute_count, v_hour_started, v_hour_count
  from public.base_mcp_status_rate_limits
  where agent_id = p_agent_id
  for update;

  if not found then
    insert into public.base_mcp_status_rate_limits (
      agent_id, workspace_id,
      minute_window_started_at, minute_count,
      hour_window_started_at, hour_count, updated_at
    ) values (
      p_agent_id, p_workspace_id,
      v_now, 1, v_now, 1, v_now
    );
    return query select true, 'allowed'::text;
    return;
  end if;

  if v_minute_started <= v_now - interval '1 minute' then
    v_minute_started := v_now;
    v_minute_count := 0;
  end if;
  if v_hour_started <= v_now - interval '1 hour' then
    v_hour_started := v_now;
    v_hour_count := 0;
  end if;

  if v_minute_count >= 6 or v_hour_count >= 60 then
    return query select false, 'rate_limited'::text;
    return;
  end if;

  update public.base_mcp_status_rate_limits
  set workspace_id = p_workspace_id,
      minute_window_started_at = v_minute_started,
      minute_count = v_minute_count + 1,
      hour_window_started_at = v_hour_started,
      hour_count = v_hour_count + 1,
      updated_at = v_now
  where agent_id = p_agent_id;

  return query select true, 'allowed'::text;
end;
$$;

revoke all on function public.consume_base_mcp_status_rate_limit(uuid, uuid, uuid)
  from public;
revoke all on function public.consume_base_mcp_status_rate_limit(uuid, uuid, uuid)
  from anon;
revoke all on function public.consume_base_mcp_status_rate_limit(uuid, uuid, uuid)
  from authenticated;
grant execute on function public.consume_base_mcp_status_rate_limit(uuid, uuid, uuid)
  to service_role;

commit;
