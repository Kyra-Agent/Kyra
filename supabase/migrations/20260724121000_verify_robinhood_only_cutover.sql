do $$
declare
  view_definition text;
begin
  if exists (
    select 1
    from public.agent_instances
    where network not in ('robinhood_mainnet', 'robinhood_testnet')
  ) then
    raise exception 'agent_instances contains a non-Robinhood network';
  end if;

  if exists (
    select 1
    from public.wallet_policies
    where
      (chain_key = 'robinhood_mainnet' and chain_id <> 4663)
      or (chain_key = 'robinhood_testnet' and chain_id <> 46630)
      or chain_key not in ('robinhood_mainnet', 'robinhood_testnet')
  ) then
    raise exception 'wallet_policies contains an invalid Robinhood chain identity';
  end if;

  if exists (
    select 1
    from public.approval_requests
    where
      (chain_key = 'robinhood_mainnet' and chain_id <> 4663)
      or (chain_key = 'robinhood_testnet' and chain_id <> 46630)
      or chain_key not in ('robinhood_mainnet', 'robinhood_testnet')
  ) then
    raise exception 'approval_requests contains an invalid Robinhood chain identity';
  end if;

  if exists (
    select 1
    from public.approval_requests
    where prepared_tx is not null
      and (
        prepared_tx ->> 'chain_key' = 'base'
        or prepared_tx ->> 'chain_id' in ('8453', '0x2105')
      )
  ) then
    raise exception 'approval_requests still contains a legacy Base transaction payload';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_instances'
      and column_name = 'base_mcp_status'
  ) then
    raise exception 'legacy agent Base status column still exists';
  end if;

  if to_regclass('public.base_mcp_status_rate_limits') is not null then
    raise exception 'legacy Base rate-limit table still exists';
  end if;

  if to_regprocedure('public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)') is not null then
    raise exception 'legacy Base rate-limit function still exists';
  end if;

  if position(
    'when ''base'''
    in pg_get_functiondef('public.enforce_chain_action_agent_scope()'::regprocedure)
  ) > 0 then
    raise exception 'chain action scope validator still accepts Base';
  end if;

  select pg_get_viewdef('public.public_agent_profiles'::regclass, true)
  into view_definition;

  if position('chain_action_status' in view_definition) = 0
    or position('base_mcp_status' in view_definition) > 0
  then
    raise exception 'public agent view is not Robinhood cutover ready';
  end if;
end;
$$;