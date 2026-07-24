begin;

drop view if exists public.public_agent_profiles;

alter table public.agent_instances
  drop constraint if exists agent_instances_network_check;
alter table public.wallet_policies
  drop constraint if exists wallet_policies_chain_key_check,
  drop constraint if exists wallet_policies_chain_identity_check;
alter table public.approval_requests
  drop constraint if exists approval_requests_chain_key_check,
  drop constraint if exists approval_requests_chain_identity_check;
alter table if exists public.prepared_actions
  drop constraint if exists prepared_actions_chain_key_check,
  drop constraint if exists prepared_actions_chain_identity_check;
alter table if exists public.chain_action_rate_limits
  drop constraint if exists chain_action_rate_limits_chain_key_check;
alter table public.activity_logs
  drop constraint if exists activity_logs_source_check;

drop trigger if exists enforce_wallet_policy_agent_chain_scope
  on public.wallet_policies;
drop trigger if exists enforce_approval_request_agent_chain_scope
  on public.approval_requests;
drop trigger if exists enforce_prepared_action_agent_scope
  on public.prepared_actions;
drop trigger if exists enforce_chain_action_rate_limit_agent_scope
  on public.chain_action_rate_limits;
drop trigger if exists enforce_agent_network_rebinding
  on public.agent_instances;

delete from public.prepared_actions
where chain_key = 'base';

delete from public.chain_action_rate_limits
where chain_key = 'base';

update public.wallet_policies
set
  chain_key = 'robinhood_mainnet',
  chain_id = 4663,
  wallet_label = replace(wallet_label, 'Base Account', 'Robinhood Chain wallet')
where chain_key = 'base' or chain_id = 8453;

update public.approval_requests
set
  chain_key = 'robinhood_mainnet',
  chain_id = 4663,
  command = replace(command, 'Base', 'Robinhood Chain'),
  route = replace(route, 'Base', 'Robinhood Chain'),
  status = 'rejected',
  requires_wallet = false,
  prepared_tx = null,
  tx_hash = null,
  resolved_at = coalesce(resolved_at, now())
where chain_key = 'base' or chain_id = 8453;

update public.agent_instances
set
  network = 'robinhood_mainnet',
  chain_action_status = case
    when chain_action_status = 'active' then 'active'
    else 'ready'
  end,
  last_sync_at = now()
where network = 'base';

update public.activity_logs
set
  source = case
    when source = 'base_mcp_routes' then 'chain_action_routes'
    else source
  end,
  message = replace(message, 'Base', 'Robinhood Chain')
where source = 'base_mcp_routes' or position('Base' in message) > 0;

update public.agent_templates
set
  summary = replace(summary, 'Base', 'Robinhood Chain'),
  best_for = replace(best_for, 'Base', 'Robinhood Chain'),
  terminal_seed = replace(terminal_seed, 'Base', 'Robinhood Chain'),
  actions = replace(actions::text, 'Base', 'Robinhood Chain')::jsonb,
  modules = replace(modules::text, 'Base', 'Robinhood Chain')::jsonb
where
  position('Base' in summary) > 0
  or position('Base' in best_for) > 0
  or position('Base' in terminal_seed) > 0
  or position('Base' in actions::text) > 0
  or position('Base' in modules::text) > 0;

alter table public.agent_instances
  alter column network set default 'robinhood_mainnet',
  add constraint agent_instances_network_check
    check (network in ('robinhood_mainnet', 'robinhood_testnet')),
  drop column if exists base_mcp_status;

alter table public.wallet_policies
  alter column chain_key set default 'robinhood_mainnet',
  alter column chain_id set default 4663,
  add constraint wallet_policies_chain_key_check
    check (chain_key in ('robinhood_mainnet', 'robinhood_testnet')),
  add constraint wallet_policies_chain_identity_check
    check (
      (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    );

alter table public.approval_requests
  alter column chain_key set default 'robinhood_mainnet',
  alter column chain_id set default 4663,
  add constraint approval_requests_chain_key_check
    check (chain_key in ('robinhood_mainnet', 'robinhood_testnet')),
  add constraint approval_requests_chain_identity_check
    check (
      (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    );

alter table if exists public.prepared_actions
  add constraint prepared_actions_chain_key_check
    check (chain_key in ('robinhood_mainnet', 'robinhood_testnet')),
  add constraint prepared_actions_chain_identity_check
    check (
      (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    );

alter table if exists public.chain_action_rate_limits
  add constraint chain_action_rate_limits_chain_key_check
    check (chain_key in ('robinhood_mainnet', 'robinhood_testnet'));

alter table public.activity_logs
  add constraint activity_logs_source_check
    check (
      source in (
        'agent_instances',
        'telegram_sessions',
        'chain_action_routes',
        'approval_requests'
      )
    );

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
  if v_chain_key not in ('robinhood_mainnet', 'robinhood_testnet') then
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

create trigger enforce_wallet_policy_agent_chain_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.wallet_policies
for each row execute function public.enforce_chain_action_agent_scope();

create trigger enforce_approval_request_agent_chain_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.approval_requests
for each row execute function public.enforce_chain_action_agent_scope();

create trigger enforce_prepared_action_agent_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.prepared_actions
for each row execute function public.enforce_chain_action_agent_scope();

create trigger enforce_chain_action_rate_limit_agent_scope
before insert or update of workspace_id, agent_id, chain_key
on public.chain_action_rate_limits
for each row execute function public.enforce_chain_action_agent_scope();

create trigger enforce_agent_network_rebinding
before update of network
on public.agent_instances
for each row execute function public.enforce_agent_network_rebinding();

drop function if exists public.consume_base_mcp_status_rate_limit(uuid, uuid, uuid);
drop table if exists public.base_mcp_status_rate_limits;

create or replace view public.public_agent_profiles
with (security_invoker = true)
as
select
  agents.public_slug,
  agents.display_name,
  agents.handle,
  agents.status,
  agents.mode,
  agents.network,
  agents.telegram_status,
  agents.chain_action_status,
  agents.created_at,
  agents.last_sync_at,
  templates.id as template_id,
  templates.name as template_name,
  templates.role as template_role,
  templates.status as template_status,
  templates.summary as template_summary,
  templates.best_for as template_best_for,
  templates.actions as template_actions,
  templates.modules as template_modules
from public.agent_instances agents
join public.agent_templates templates on templates.id = agents.template_id
where agents.status = 'online'
  and agents.mode = 'demo';

revoke all privileges on public.public_agent_profiles from public, anon, authenticated, service_role;
grant select on public.public_agent_profiles to anon, authenticated, service_role;

revoke select on public.agent_instances from anon;
grant select (
  public_slug,
  display_name,
  handle,
  status,
  mode,
  network,
  telegram_status,
  chain_action_status,
  created_at,
  last_sync_at,
  template_id
) on public.agent_instances to anon;

commit;