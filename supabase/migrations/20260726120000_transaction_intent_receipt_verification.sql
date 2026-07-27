begin;

alter table public.prepared_actions
  add column if not exists recipient text,
  add column if not exists value_wei text,
  add column if not exists calldata text;

alter table public.prepared_actions
  drop constraint if exists prepared_actions_action_kind_check,
  drop constraint if exists prepared_actions_provider_check,
  drop constraint if exists prepared_actions_transaction_shape_check;

alter table public.prepared_actions
  add constraint prepared_actions_action_kind_check
    check (
      action_kind in (
        'chain_status_check',
        'robinhood_reviewed_transaction'
      )
    ),
  add constraint prepared_actions_provider_check
    check (provider in ('chain_rpc', 'owner_dashboard')),
  add constraint prepared_actions_transaction_shape_check
    check (
      (
        action_kind = 'chain_status_check'
        and provider = 'chain_rpc'
        and risk = 'read-only'
        and recipient is null
        and value_wei is null
        and calldata is null
      )
      or (
        action_kind = 'robinhood_reviewed_transaction'
        and chain_key = 'robinhood_mainnet'
        and chain_id = 4663
        and status = 'approved'
        and risk = 'review'
        and provider = 'owner_dashboard'
        and recipient ~* '^0x[0-9a-f]{40}$'
        and value_wei = '0'
        and calldata = '0x'
        and expires_at is not null
      )
    );

alter table public.execution_results
  add column if not exists prepared_action_record_id uuid
    references public.prepared_actions(id) on delete restrict,
  add column if not exists receipt_block_number bigint,
  add column if not exists receipt_checked_at timestamptz;

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
    or new.recipient is distinct from old.recipient
    or new.value_wei is distinct from old.value_wei
    or new.calldata is distinct from old.calldata
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Prepared action immutable fields cannot change';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_prepared_action_immutable_fields()
from public, anon, authenticated;

create index if not exists execution_results_prepared_action_record_idx
on public.execution_results(prepared_action_record_id);

create or replace function public.enforce_execution_result_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workspaces workspaces
    join public.agent_instances agents
      on agents.workspace_id = workspaces.id
    join public.prepared_actions prepared
      on prepared.workspace_id = workspaces.id
      and prepared.agent_id = agents.id
    where workspaces.id = new.workspace_id
      and workspaces.owner_user_id = new.owner_user_id
      and agents.id = new.agent_id
      and prepared.id = new.prepared_action_record_id
      and prepared.request_id = new.prepared_action_id
      and prepared.action_kind = 'robinhood_reviewed_transaction'
      and prepared.chain_key = new.chain_key
      and prepared.chain_id = new.chain_id
      and prepared.status = 'approved'
      and prepared.expires_at > now()
  ) then
    raise exception 'execution_result_scope_mismatch' using errcode = '23514';
  end if;

  if new.receipt_checked_at is null then
    raise exception 'execution_result_receipt_verification_required'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_execution_result_scope()
from public, anon, authenticated;

drop trigger if exists enforce_execution_result_scope_on_write
on public.execution_results;
create trigger enforce_execution_result_scope_on_write
before insert or update of
  owner_user_id,
  workspace_id,
  agent_id,
  prepared_action_id,
  prepared_action_record_id,
  chain_key,
  chain_id
on public.execution_results
for each row
execute function public.enforce_execution_result_scope();

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
  if p_chain_key not in ('robinhood_mainnet', 'robinhood_testnet') then
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

  select minute_window_started_at, minute_count,
         hour_window_started_at, hour_count
  into v_minute_started, v_minute_count, v_hour_started, v_hour_count
  from public.chain_action_rate_limits
  where agent_id = p_agent_id and chain_key = p_chain_key
  for update;

  if not found then
    insert into public.chain_action_rate_limits (
      agent_id, workspace_id, chain_key,
      minute_window_started_at, minute_count,
      hour_window_started_at, hour_count, updated_at
    ) values (
      p_agent_id, p_workspace_id, p_chain_key,
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

  update public.chain_action_rate_limits
  set workspace_id = p_workspace_id,
      minute_window_started_at = v_minute_started,
      minute_count = v_minute_count + 1,
      hour_window_started_at = v_hour_started,
      hour_count = v_hour_count + 1,
      updated_at = v_now
  where agent_id = p_agent_id and chain_key = p_chain_key;

  return query select true, 'allowed'::text;
end;
$$;

revoke all on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
to service_role;

commit;
