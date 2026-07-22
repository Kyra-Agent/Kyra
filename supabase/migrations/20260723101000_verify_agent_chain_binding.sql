do $$
declare
  scope_definition text;
  limiter_definition text;
begin
  if exists (
    select 1
    from public.wallet_policies policies
    join public.agent_instances agents on agents.id = policies.agent_id
    where policies.workspace_id <> agents.workspace_id
      or policies.chain_key <> agents.network
  ) then
    raise exception 'Wallet policy agent chain binding invalid';
  end if;

  if exists (
    select 1
    from public.approval_requests approvals
    join public.agent_instances agents on agents.id = approvals.agent_id
    where approvals.workspace_id <> agents.workspace_id
      or approvals.chain_key <> agents.network
  ) then
    raise exception 'Approval request agent chain binding invalid';
  end if;

  if exists (
    select 1
    from public.prepared_actions actions
    join public.agent_instances agents on agents.id = actions.agent_id
    where actions.workspace_id <> agents.workspace_id
      or actions.chain_key <> agents.network
      or agents.chain_action_status not in ('ready', 'active')
  ) then
    raise exception 'Prepared action agent chain binding invalid';
  end if;

  if exists (
    select 1
    from public.chain_action_rate_limits limits
    join public.agent_instances agents on agents.id = limits.agent_id
    where limits.workspace_id <> agents.workspace_id
      or limits.chain_key <> agents.network
  ) then
    raise exception 'Chain action limiter agent chain binding invalid';
  end if;

  select pg_get_functiondef(
    'public.enforce_chain_action_agent_scope()'::regprocedure
  ) into scope_definition;
  if position('agents.network' in scope_definition) = 0
    or position('chain_action_status' in scope_definition) = 0
    or position('prepared_actions' in scope_definition) = 0
  then
    raise exception 'Chain action scope function is incomplete';
  end if;

  select pg_get_functiondef(
    'public.consume_chain_action_rate_limit(uuid,uuid,uuid,text)'::regprocedure
  ) into limiter_definition;
  if position('agents.network = p_chain_key' in limiter_definition) = 0
    or position('agents.chain_action_status' in limiter_definition) = 0
  then
    raise exception 'Chain action limiter binding is incomplete';
  end if;

  if to_regprocedure('public.enforce_agent_network_rebinding()') is null then
    raise exception 'Agent network rebind function missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.wallet_policies'::regclass
      and tgname = 'enforce_wallet_policy_agent_chain_scope'
      and not tgisinternal
  ) then
    raise exception 'Wallet policy agent chain trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.approval_requests'::regclass
      and tgname = 'enforce_approval_request_agent_chain_scope'
      and not tgisinternal
  ) then
    raise exception 'Approval request agent chain trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.prepared_actions'::regclass
      and tgname = 'enforce_prepared_action_agent_scope'
      and not tgisinternal
  ) then
    raise exception 'Prepared action agent chain trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.chain_action_rate_limits'::regclass
      and tgname = 'enforce_chain_action_rate_limit_agent_scope'
      and not tgisinternal
  ) then
    raise exception 'Chain action limiter agent chain trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.agent_instances'::regclass
      and tgname = 'enforce_agent_network_rebinding'
      and not tgisinternal
  ) then
    raise exception 'Agent network rebind trigger missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.enforce_agent_network_rebinding()',
    'execute'
  ) then
    raise exception 'Authenticated network rebind function execution detected';
  end if;
end;
$$;
