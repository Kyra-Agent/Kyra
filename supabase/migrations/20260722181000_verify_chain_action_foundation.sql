do $$
declare
  forbidden_column_count integer;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_instances'
      and column_name = 'chain_action_status'
      and data_type = 'text'
      and is_nullable = 'NO'
      and column_default = '''disabled''::text'
  ) then
    raise exception 'agent chain action status column invalid';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agent_instances'::regclass
      and conname = 'agent_instances_network_check'
      and pg_get_constraintdef(oid) like '%robinhood_mainnet%'
      and pg_get_constraintdef(oid) like '%robinhood_testnet%'
  ) then
    raise exception 'agent chain network constraint invalid';
  end if;
  if exists (
    select 1
    from public.agent_instances
    where network not in ('base', 'robinhood_mainnet', 'robinhood_testnet')
      or chain_action_status not in ('disabled', 'ready', 'active', 'paused')
  ) then
    raise exception 'agent chain state contains invalid values';
  end if;
  if exists (
    select 1
    from public.wallet_policies
    where not (
      (chain_key = 'base' and chain_id = 8453)
      or (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    )
  ) then
    raise exception 'wallet policy chain identity invalid';
  end if;
  if exists (
    select 1
    from public.approval_requests
    where not (
      (chain_key = 'base' and chain_id = 8453)
      or (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    )
  ) then
    raise exception 'approval receipt chain identity invalid';
  end if;
  if to_regclass('public.prepared_actions') is null then
    raise exception 'prepared_actions table missing';
  end if;
  if to_regclass('public.prepared_action_owner_summaries') is null then
    raise exception 'prepared_action_owner_summaries view missing';
  end if;
  if to_regclass('public.chain_action_rate_limits') is null then
    raise exception 'chain_action_rate_limits table missing';
  end if;
  if to_regprocedure(
    'public.consume_chain_action_rate_limit(uuid,uuid,uuid,text)'
  ) is null then
    raise exception 'consume_chain_action_rate_limit function missing';
  end if;
  if to_regprocedure('public.enforce_chain_action_agent_scope()') is null then
    raise exception 'enforce_chain_action_agent_scope function missing';
  end if;
  if to_regprocedure(
    'public.enforce_prepared_action_immutable_fields()'
  ) is null then
    raise exception 'prepared action immutability function missing';
  end if;
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = to_regclass('public.prepared_actions')
      and tgname = 'enforce_prepared_action_agent_scope'
      and not tgisinternal
  ) then
    raise exception 'prepared action agent scope trigger missing';
  end if;
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = to_regclass('public.prepared_actions')
      and tgname = 'enforce_prepared_action_immutable_fields'
      and not tgisinternal
  ) then
    raise exception 'prepared action immutability trigger missing';
  end if;
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = to_regclass('public.chain_action_rate_limits')
      and tgname = 'enforce_chain_action_rate_limit_agent_scope'
      and not tgisinternal
  ) then
    raise exception 'chain action limiter agent scope trigger missing';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.prepared_actions')
  ) then
    raise exception 'prepared_actions RLS disabled';
  end if;
  if not (
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.chain_action_rate_limits')
  ) then
    raise exception 'chain_action_rate_limits RLS disabled';
  end if;

  select count(*)
  into forbidden_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('prepared_actions', 'prepared_action_owner_summaries')
    and column_name in (
      'owner_user_id',
      'wallet_address',
      'private_key',
      'seed_phrase',
      'telegram_token_ref',
      'telegram_bot_token',
      'api_key',
      'raw_provider_payload',
      'provider_payload_ref',
      'raw_calldata',
      'signed_payload',
      'tx_hash'
    );
  if forbidden_column_count <> 0 then
    raise exception 'prepared action storage contains forbidden columns';
  end if;

  if has_table_privilege('anon', 'public.prepared_actions', 'select')
    or has_table_privilege('anon', 'public.prepared_action_owner_summaries', 'select')
    or has_table_privilege('anon', 'public.chain_action_rate_limits', 'select')
  then
    raise exception 'anon chain action privileges detected';
  end if;

  if has_table_privilege('authenticated', 'public.prepared_actions', 'insert')
    or has_table_privilege('authenticated', 'public.prepared_actions', 'update')
    or has_table_privilege('authenticated', 'public.prepared_actions', 'delete')
    or has_table_privilege('authenticated', 'public.chain_action_rate_limits', 'select')
  then
    raise exception 'authenticated chain action write privilege detected';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.consume_chain_action_rate_limit(uuid,uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'authenticated limiter execution privilege detected';
  end if;
end;
$$;
