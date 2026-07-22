begin;

do $$
begin
  if to_regclass('public.agent_instances') is null
    or to_regclass('public.wallet_policies') is null
    or to_regclass('public.approval_requests') is null
    or to_regclass('public.prepared_actions') is null
    or to_regclass('public.chain_action_rate_limits') is null
  then
    raise exception 'Chain binding prerequisites missing';
  end if;

  if exists (
    select 1
    from public.wallet_policies policies
    join public.agent_instances agents on agents.id = policies.agent_id
    where policies.workspace_id <> agents.workspace_id
      or policies.chain_key <> agents.network
  ) then
    raise exception 'Wallet policy agent chain mismatch';
  end if;

  if exists (
    select 1
    from public.approval_requests approvals
    join public.agent_instances agents on agents.id = approvals.agent_id
    where approvals.workspace_id <> agents.workspace_id
      or approvals.chain_key <> agents.network
  ) then
    raise exception 'Approval request agent chain mismatch';
  end if;

  if exists (
    select 1
    from public.prepared_actions actions
    join public.agent_instances agents on agents.id = actions.agent_id
    where actions.workspace_id <> agents.workspace_id
      or actions.chain_key <> agents.network
      or agents.chain_action_status not in ('ready', 'active')
  ) then
    raise exception 'Prepared action agent chain mismatch';
  end if;

  if exists (
    select 1
    from public.chain_action_rate_limits limits
    join public.agent_instances agents on agents.id = limits.agent_id
    where limits.workspace_id <> agents.workspace_id
      or limits.chain_key <> agents.network
  ) then
    raise exception 'Chain action limiter agent chain mismatch';
  end if;
end;
$$;

create or replace function public.enforce_chain_action_agent_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_chain_key text := v_payload ->> 'chain_key';
  v_chain_id bigint;
  v_expected_chain_id bigint;
  v_agent_network text;
  v_agent_status text;
begin
  if v_chain_key not in ('base', 'robinhood_mainnet', 'robinhood_testnet') then
    raise exception 'Chain action agent scope rejected';
  end if;

  select agents.network, agents.chain_action_status
  into v_agent_network, v_agent_status
  from public.agent_instances agents
  where agents.id = new.agent_id
    and agents.workspace_id = new.workspace_id;

  if not found or v_agent_network <> v_chain_key then
    raise exception 'Chain action agent scope rejected';
  end if;

  if v_payload ? 'chain_id' then
    v_chain_id := (v_payload ->> 'chain_id')::bigint;
    v_expected_chain_id := case v_chain_key
      when 'base' then 8453
      when 'robinhood_mainnet' then 4663
      when 'robinhood_testnet' then 46630
      else null
    end;
    if v_chain_id is distinct from v_expected_chain_id then
      raise exception 'Chain action identity rejected';
    end if;
  end if;

  if tg_table_name = 'prepared_actions'
    and v_agent_status not in ('ready', 'active')
  then
    raise exception 'Agent chain action status rejected';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_agent_network_rebinding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.network is distinct from old.network
    and (
      exists (
        select 1 from public.wallet_policies
        where agent_id = old.id
      )
      or exists (
        select 1 from public.approval_requests
        where agent_id = old.id
      )
      or exists (
        select 1 from public.prepared_actions
        where agent_id = old.id
      )
      or exists (
        select 1 from public.chain_action_rate_limits
        where agent_id = old.id
      )
    )
  then
    raise exception 'Agent network rebind rejected';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_wallet_policy_agent_chain_scope
  on public.wallet_policies;
create trigger enforce_wallet_policy_agent_chain_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.wallet_policies
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_approval_request_agent_chain_scope
  on public.approval_requests;
create trigger enforce_approval_request_agent_chain_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.approval_requests
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_prepared_action_agent_scope
  on public.prepared_actions;
create trigger enforce_prepared_action_agent_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.prepared_actions
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_chain_action_rate_limit_agent_scope
  on public.chain_action_rate_limits;
create trigger enforce_chain_action_rate_limit_agent_scope
before insert or update of workspace_id, agent_id, chain_key
on public.chain_action_rate_limits
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_agent_network_rebinding
  on public.agent_instances;
create trigger enforce_agent_network_rebinding
before update of network
on public.agent_instances
for each row execute function public.enforce_agent_network_rebinding();

create or replace function public.consume_chain_action_rate_limit(
  p_owner_user_id uuid,
  p_workspace_id uuid,
  p_agent_id uuid,
  p_chain_key text
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
  if p_chain_key not in ('base', 'robinhood_mainnet', 'robinhood_testnet') then
    raise exception 'Chain action rate limit scope rejected';
  end if;

  if not exists (
    select 1
    from public.agent_instances agents
    join public.workspaces workspaces on workspaces.id = agents.workspace_id
    where agents.id = p_agent_id
      and agents.workspace_id = p_workspace_id
      and workspaces.owner_user_id = p_owner_user_id
      and agents.network = p_chain_key
      and agents.chain_action_status in ('ready', 'active')
  ) then
    raise exception 'Chain action rate limit scope rejected';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_agent_id::text || ':' || p_chain_key, 0)
  );

  select
    minute_window_started_at,
    minute_count,
    hour_window_started_at,
    hour_count
  into
    v_minute_started,
    v_minute_count,
    v_hour_started,
    v_hour_count
  from public.chain_action_rate_limits
  where agent_id = p_agent_id
    and chain_key = p_chain_key
  for update;

  if not found then
    insert into public.chain_action_rate_limits (
      agent_id,
      workspace_id,
      chain_key,
      minute_window_started_at,
      minute_count,
      hour_window_started_at,
      hour_count,
      updated_at
    ) values (
      p_agent_id,
      p_workspace_id,
      p_chain_key,
      v_now,
      1,
      v_now,
      1,
      v_now
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

  update public.chain_action_rate_limits
  set
    workspace_id = p_workspace_id,
    minute_window_started_at = v_minute_started,
    minute_count = v_minute_count + 1,
    hour_window_started_at = v_hour_started,
    hour_count = v_hour_count + 1,
    updated_at = v_now
  where agent_id = p_agent_id
    and chain_key = p_chain_key;

  return query select true, 'allowed'::text;
end;
$$;

revoke all on function public.enforce_chain_action_agent_scope()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_agent_network_rebinding()
  from public, anon, authenticated, service_role;
revoke all on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
  to service_role;

commit;
