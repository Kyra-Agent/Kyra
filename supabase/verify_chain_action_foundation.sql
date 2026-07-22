select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_instances'
      and column_name = 'chain_action_status'
      and data_type = 'text'
      and is_nullable = 'NO'
      and column_default = '''disabled''::text'
  ) as agent_chain_status_ready,
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agent_instances'::regclass
      and conname = 'agent_instances_network_check'
      and pg_get_constraintdef(oid) like '%robinhood_mainnet%'
      and pg_get_constraintdef(oid) like '%robinhood_testnet%'
  ) as agent_chain_networks_ready,
  not exists (
    select 1
    from public.wallet_policies
    where not (
      (chain_key = 'base' and chain_id = 8453)
      or (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    )
  ) as wallet_policy_chain_identity_valid,
  not exists (
    select 1
    from public.approval_requests
    where not (
      (chain_key = 'base' and chain_id = 8453)
      or (chain_key = 'robinhood_mainnet' and chain_id = 4663)
      or (chain_key = 'robinhood_testnet' and chain_id = 46630)
    )
  ) as approval_receipt_chain_identity_valid,
  to_regclass('public.prepared_actions') is not null
    as prepared_actions_exists,
  to_regclass('public.prepared_action_owner_summaries') is not null
    as owner_summary_exists,
  to_regclass('public.chain_action_rate_limits') is not null
    as rate_limits_exists,
  to_regprocedure(
    'public.consume_chain_action_rate_limit(uuid,uuid,uuid,text)'
  ) is not null as limiter_exists,
  to_regprocedure('public.enforce_chain_action_agent_scope()') is not null
    as scope_guard_exists,
  to_regprocedure(
    'public.enforce_prepared_action_immutable_fields()'
  ) is not null as immutable_guard_exists,
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.prepared_actions')
  ), false) as prepared_actions_rls_enabled,
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.chain_action_rate_limits')
  ), false) as rate_limits_rls_enabled,
  not coalesce(
    has_table_privilege('anon', 'public.prepared_actions', 'select'),
    false
  ) as anon_prepared_actions_blocked,
  not coalesce(
    has_table_privilege(
      'anon',
      'public.prepared_action_owner_summaries',
      'select'
    ),
    false
  ) as anon_owner_summary_blocked,
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'prepared_actions',
        'prepared_action_owner_summaries'
      )
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
      )
  ) as sensitive_columns_absent;
