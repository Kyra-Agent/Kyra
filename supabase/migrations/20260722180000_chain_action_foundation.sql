begin;

do $$
begin
  if to_regclass('public.workspaces') is null then
    raise exception 'public.workspaces missing';
  end if;
  if to_regclass('public.agent_instances') is null then
    raise exception 'public.agent_instances missing';
  end if;
  if to_regprocedure('public.owns_workspace(uuid)') is null then
    raise exception 'public.owns_workspace(uuid) missing';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agent_instances'::regclass
      and conname = 'agent_instances_network_check'
      and contype = 'c'
  ) then
    raise exception 'agent_instances network constraint missing';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_instances'
      and column_name = 'chain_action_status'
  ) then
    raise exception 'agent_instances.chain_action_status already exists';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('wallet_policies', 'approval_requests')
      and column_name in ('chain_key', 'chain_id')
  ) then
    raise exception 'chain identity columns already exist';
  end if;
  if to_regclass('public.prepared_actions') is not null then
    raise exception 'public.prepared_actions already exists';
  end if;
  if to_regclass('public.prepared_action_owner_summaries') is not null then
    raise exception 'public.prepared_action_owner_summaries already exists';
  end if;
  if to_regclass('public.chain_action_rate_limits') is not null then
    raise exception 'public.chain_action_rate_limits already exists';
  end if;
end;
$$;

alter table public.agent_instances
  drop constraint agent_instances_network_check,
  add constraint agent_instances_network_check
    check (network in ('base', 'robinhood_mainnet', 'robinhood_testnet')),
  add column chain_action_status text not null default 'disabled',
  add constraint agent_instances_chain_action_status_check
    check (chain_action_status in ('disabled', 'ready', 'active', 'paused'));

alter table public.wallet_policies
  add column chain_key text not null default 'base',
  add column chain_id bigint not null default 8453,
  add constraint wallet_policies_chain_key_check
    check (chain_key in ('base', 'robinhood_mainnet', 'robinhood_testnet')),
  add constraint wallet_policies_chain_identity_check
    check (
      (chain_key = 'base' and chain_id = 8453)
      or (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    );

alter table public.approval_requests
  add column chain_key text not null default 'base',
  add column chain_id bigint not null default 8453,
  add constraint approval_requests_chain_key_check
    check (chain_key in ('base', 'robinhood_mainnet', 'robinhood_testnet')),
  add constraint approval_requests_chain_identity_check
    check (
      (chain_key = 'base' and chain_id = 8453)
      or (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    );

create table public.prepared_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  request_id text not null,
  action_kind text not null,
  chain_key text not null,
  chain_id bigint not null,
  status text not null,
  risk text not null,
  route_summary text not null,
  value_summary text not null,
  approval_requirement text not null,
  safety_note text not null,
  provider text not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint prepared_actions_request_unique
    unique (workspace_id, agent_id, request_id),
  constraint prepared_actions_action_kind_check
    check (action_kind = 'chain_status_check'),
  constraint prepared_actions_chain_key_check
    check (chain_key in ('base', 'robinhood_mainnet', 'robinhood_testnet')),
  constraint prepared_actions_chain_identity_check
    check (
      (chain_key = 'base' and chain_id = 8453)
      or (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    ),
  constraint prepared_actions_status_check
    check (
      status in (
        'preview_ready',
        'review_required',
        'approved',
        'rejected',
        'expired',
        'failed'
      )
    ),
  constraint prepared_actions_risk_check
    check (risk in ('read-only', 'review', 'blocked')),
  constraint prepared_actions_provider_check
    check (provider = 'chain_rpc'),
  constraint prepared_actions_request_id_format_check
    check (request_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'),
  constraint prepared_actions_route_summary_len
    check (char_length(btrim(route_summary)) between 1 and 160),
  constraint prepared_actions_value_summary_len
    check (char_length(btrim(value_summary)) between 1 and 160),
  constraint prepared_actions_approval_requirement_len
    check (char_length(btrim(approval_requirement)) between 1 and 200),
  constraint prepared_actions_safety_note_len
    check (char_length(btrim(safety_note)) between 1 and 200),
  constraint prepared_actions_expiry_after_creation_check
    check (expires_at is null or expires_at > created_at),
  constraint prepared_actions_updated_after_creation_check
    check (updated_at >= created_at),
  constraint prepared_actions_resolved_after_creation_check
    check (resolved_at is null or resolved_at >= created_at)
);

create index prepared_actions_workspace_created_idx
  on public.prepared_actions (workspace_id, created_at desc);
create index prepared_actions_agent_created_idx
  on public.prepared_actions (agent_id, created_at desc);
create index prepared_actions_chain_created_idx
  on public.prepared_actions (chain_key, created_at desc);
create index prepared_actions_expiry_idx
  on public.prepared_actions (expires_at)
  where expires_at is not null;

alter table public.prepared_actions enable row level security;

create policy "Workspace owners can read prepared actions"
on public.prepared_actions
for select
using (public.owns_workspace(workspace_id));

create view public.prepared_action_owner_summaries
with (security_invoker = true)
as
select
  id,
  workspace_id,
  agent_id,
  action_kind,
  chain_key,
  chain_id,
  status,
  risk,
  route_summary,
  value_summary,
  approval_requirement,
  safety_note,
  expires_at,
  created_at,
  resolved_at
from public.prepared_actions;

create table public.chain_action_rate_limits (
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  chain_key text not null,
  minute_window_started_at timestamptz not null,
  minute_count integer not null,
  hour_window_started_at timestamptz not null,
  hour_count integer not null,
  updated_at timestamptz not null default now(),
  primary key (agent_id, chain_key),
  constraint chain_action_rate_limits_chain_key_check
    check (chain_key in ('base', 'robinhood_mainnet', 'robinhood_testnet')),
  constraint chain_action_rate_limits_minute_count_check
    check (minute_count between 0 and 6),
  constraint chain_action_rate_limits_hour_count_check
    check (hour_count between 0 and 60),
  constraint chain_action_rate_limits_window_order_check
    check (
      minute_window_started_at <= updated_at
      and hour_window_started_at <= updated_at
    )
);

create or replace function public.enforce_chain_action_agent_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.agent_instances agents
    where agents.id = new.agent_id
      and agents.workspace_id = new.workspace_id
  ) then
    raise exception 'Chain action agent scope rejected';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_prepared_action_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.agent_id is distinct from old.agent_id
    or new.request_id is distinct from old.request_id
    or new.action_kind is distinct from old.action_kind
    or new.chain_key is distinct from old.chain_key
    or new.chain_id is distinct from old.chain_id
    or new.risk is distinct from old.risk
    or new.route_summary is distinct from old.route_summary
    or new.value_summary is distinct from old.value_summary
    or new.approval_requirement is distinct from old.approval_requirement
    or new.safety_note is distinct from old.safety_note
    or new.provider is distinct from old.provider
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Prepared action immutable fields cannot change';
  end if;

  return new;
end;
$$;

create trigger enforce_prepared_action_agent_scope
before insert or update of workspace_id, agent_id
on public.prepared_actions
for each row execute function public.enforce_chain_action_agent_scope();

create trigger enforce_prepared_action_immutable_fields
before update
on public.prepared_actions
for each row execute function public.enforce_prepared_action_immutable_fields();

create trigger enforce_chain_action_rate_limit_agent_scope
before insert or update of workspace_id, agent_id
on public.chain_action_rate_limits
for each row execute function public.enforce_chain_action_agent_scope();

alter table public.chain_action_rate_limits enable row level security;

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

revoke all privileges on public.prepared_actions from public, anon, authenticated, service_role;
revoke all privileges on public.prepared_action_owner_summaries from public, anon, authenticated, service_role;
revoke all privileges on public.chain_action_rate_limits from public, anon, authenticated, service_role;
revoke all on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.enforce_chain_action_agent_scope()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_prepared_action_immutable_fields()
  from public, anon, authenticated, service_role;

grant select (
  id,
  workspace_id,
  agent_id,
  action_kind,
  chain_key,
  chain_id,
  status,
  risk,
  route_summary,
  value_summary,
  approval_requirement,
  safety_note,
  expires_at,
  created_at,
  resolved_at
) on public.prepared_actions to authenticated;
grant select on public.prepared_action_owner_summaries to authenticated;
grant select, insert, update on public.prepared_actions to service_role;
grant select, insert, update on public.chain_action_rate_limits to service_role;
grant execute on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
  to service_role;

commit;
