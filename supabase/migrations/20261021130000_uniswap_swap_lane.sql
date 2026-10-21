begin;

-- Protected swaps move from the retired 0x/KYRA lane (never used: the swap
-- tables are empty) to Uniswap V3 on Robinhood Chain, swapping ETH and USDG
-- through SwapRouter02. Policy version 2 pins the router as the only call
-- target and the only allowance spender, and adds per-workspace daily caps.

alter table public.swap_quote_reviews
  drop constraint swap_quote_reviews_tokens_check,
  drop constraint swap_quote_reviews_amounts_check,
  drop constraint swap_quote_reviews_transaction_check,
  drop constraint swap_quote_reviews_provider_check,
  drop constraint swap_quote_reviews_status_check,
  drop constraint swap_quote_reviews_policy_check;

alter table public.swap_quote_reviews
  add constraint swap_quote_reviews_tokens_check
    check (
      sell_token_symbol <> buy_token_symbol
      and (
        (
          sell_token_symbol = 'ETH'
          and lower(sell_token_address) = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
          and sell_token_decimals = 18
        )
        or (
          sell_token_symbol = 'USDG'
          and lower(sell_token_address) = lower('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168')
          and sell_token_decimals = 6
        )
      )
      and (
        (
          buy_token_symbol = 'ETH'
          and lower(buy_token_address) = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
          and buy_token_decimals = 18
        )
        or (
          buy_token_symbol = 'USDG'
          and lower(buy_token_address) = lower('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168')
          and buy_token_decimals = 6
        )
      )
    ),
  add constraint swap_quote_reviews_amounts_check
    check (
      sell_amount_atomic ~ '^[1-9][0-9]{0,77}$'
      and buy_amount_atomic ~ '^[1-9][0-9]{0,77}$'
      and minimum_buy_amount_atomic ~ '^[1-9][0-9]{0,77}$'
      and minimum_buy_amount_atomic::numeric <= buy_amount_atomic::numeric
      and (
        (sell_token_symbol = 'ETH' and sell_amount_atomic::numeric <= 5000000000000000)
        or (sell_token_symbol = 'USDG' and sell_amount_atomic::numeric <= 12500000)
      )
    ),
  add constraint swap_quote_reviews_transaction_check
    check (
      transaction_data ~ '^0x([0-9a-f]{2})+$'
      and char_length(transaction_data) <= 32770
      and transaction_value_wei ~ '^(0|[1-9][0-9]*)$'
      and lower(transaction_to) = lower('0xCaf681a66D020601342297493863E78C959E5cb2')
      and (
        (
          sell_token_symbol = 'ETH'
          and allowance_target is null
          and transaction_value_wei = sell_amount_atomic
        )
        or (
          sell_token_symbol = 'USDG'
          and lower(allowance_target) = lower('0xCaf681a66D020601342297493863E78C959E5cb2')
          and transaction_value_wei = '0'
        )
      )
    ),
  add constraint swap_quote_reviews_provider_check
    check (provider = 'uniswap_v3_robinhood'),
  add constraint swap_quote_reviews_status_check
    check (
      status in ('quote_ready', 'allowance_required')
      and (sell_token_symbol <> 'ETH' or status = 'quote_ready')
    ),
  add constraint swap_quote_reviews_policy_check
    check (policy_version = 2);

comment on table public.swap_quote_reviews is
  'Service-only immutable Uniswap V3 quote snapshots for the protected Robinhood Chain swap lane.';

alter table public.swap_execution_intents
  drop constraint swap_execution_intents_step_shape_check,
  drop constraint swap_execution_intents_policy_check;

alter table public.swap_execution_intents
  add constraint swap_execution_intents_step_shape_check
    check (
      (
        step = 'swap'
        and lower(transaction_to) = lower('0xCaf681a66D020601342297493863E78C959E5cb2')
        and token_address is null
        and spender_address is null
        and allowance_amount_atomic is null
      )
      or (
        step in ('allowance_set', 'allowance_revoke')
        and token_address is not null
        and lower(token_address) = lower('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168')
        and lower(transaction_to) = lower('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168')
        and spender_address is not null
        and lower(spender_address) = lower('0xCaf681a66D020601342297493863E78C959E5cb2')
        and allowance_amount_atomic is not null
        and allowance_amount_atomic ~ '^(0|[1-9][0-9]*)$'
        and transaction_value_wei = '0'
      )
    ),
  add constraint swap_execution_intents_policy_check
    check (policy_version = 2);

create or replace function public.enforce_swap_execution_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote public.swap_quote_reviews%rowtype;
  v_day_start timestamptz;
  v_reserved numeric;
  v_daily_limit numeric;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.quote_review_id::text || ':' || new.step, 0)
  );

  if not exists (
    select 1
    from public.workspaces workspaces
    join public.agent_instances agents
      on agents.workspace_id = workspaces.id
    where workspaces.id = new.workspace_id
      and workspaces.owner_user_id = new.owner_user_id
      and agents.id = new.agent_id
      and agents.network = 'robinhood_mainnet'
      and agents.chain_action_status in ('ready', 'active')
  ) then
    raise exception 'swap_execution_scope_mismatch' using errcode = '23514';
  end if;

  select *
  into quote
  from public.swap_quote_reviews reviews
  where reviews.id = new.quote_review_id
    and reviews.workspace_id = new.workspace_id
    and reviews.agent_id = new.agent_id
    and lower(reviews.taker_address) = lower(new.sender_address)
  for share;

  if not found then
    raise exception 'swap_quote_scope_mismatch' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.swap_execution_intents intents
    left join public.swap_execution_results results
      on results.intent_id = intents.id
    where intents.quote_review_id = new.quote_review_id
      and intents.step = new.step
      and (results.id is null or results.status <> 'failed')
  ) then
    raise exception 'swap_execution_step_already_active' using errcode = '23505';
  end if;

  if new.step = 'swap' then
    if quote.status <> 'quote_ready'
      or quote.expires_at <= pg_catalog.now()
      or lower(new.transaction_to) <> lower(quote.transaction_to)
      or lower(new.transaction_data) <> lower(quote.transaction_data)
      or new.transaction_value_wei <> quote.transaction_value_wei
      or new.expires_at <> quote.expires_at
    then
      raise exception 'swap_execution_quote_mismatch' using errcode = '23514';
    end if;

    -- A USDG quote is only 'quote_ready' when the backend read an allowance
    -- covering the sale on chain and simulated the exact router call, so the
    -- swap step needs no separate Kyra allowance record. That also covers
    -- owners who approved the router outside Kyra.

    -- Daily cap per workspace and sell token. Swaps that failed, or that
    -- were never signed before the router deadline passed, do not count.
    v_day_start := pg_catalog.date_trunc('day', pg_catalog.timezone('utc', pg_catalog.now()))
      at time zone 'utc';
    v_daily_limit := case quote.sell_token_symbol
      when 'ETH' then 20000000000000000::numeric
      when 'USDG' then 50000000::numeric
    end;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        new.workspace_id::text || ':swap:' || quote.sell_token_symbol || ':' || v_day_start::text,
        0
      )
    );

    select coalesce(sum(reserved_quotes.sell_amount_atomic::numeric), 0)
    into v_reserved
    from public.swap_execution_intents reserved_intents
    join public.swap_quote_reviews reserved_quotes
      on reserved_quotes.id = reserved_intents.quote_review_id
    left join public.swap_execution_results reserved_results
      on reserved_results.intent_id = reserved_intents.id
    where reserved_intents.workspace_id = new.workspace_id
      and reserved_intents.step = 'swap'
      and reserved_quotes.sell_token_symbol = quote.sell_token_symbol
      and reserved_intents.created_at >= v_day_start
      and (
        reserved_results.status in ('submitted', 'confirmed')
        or (
          reserved_results.id is null
          and reserved_quotes.expires_at + interval '10 minutes' > pg_catalog.now()
        )
      );

    if v_daily_limit is null
      or v_reserved + quote.sell_amount_atomic::numeric > v_daily_limit
    then
      raise exception 'daily_swap_limit_exceeded' using errcode = '23514';
    end if;
  elsif new.step = 'allowance_set' then
    if quote.status <> 'allowance_required'
      or quote.expires_at <= pg_catalog.now()
      or quote.sell_token_symbol <> 'USDG'
      or quote.allowance_target is null
      or new.token_address is null
      or new.spender_address is null
      or new.allowance_amount_atomic is null
      or lower(new.transaction_to) <> lower(quote.sell_token_address)
      or lower(new.token_address) <> lower(quote.sell_token_address)
      or lower(new.spender_address) <> lower(quote.allowance_target)
      or new.allowance_amount_atomic <> quote.sell_amount_atomic
      or new.transaction_value_wei <> '0'
    then
      raise exception 'swap_allowance_scope_mismatch' using errcode = '23514';
    end if;
  else
    if quote.sell_token_symbol <> 'USDG'
      or quote.allowance_target is null
      or new.token_address is null
      or new.spender_address is null
      or new.allowance_amount_atomic is null
      or lower(new.transaction_to) <> lower(quote.sell_token_address)
      or lower(new.token_address) <> lower(quote.sell_token_address)
      or lower(new.spender_address) <> lower(quote.allowance_target)
      or new.allowance_amount_atomic <> '0'
      or new.transaction_value_wei <> '0'
      or not exists (
        select 1
        from public.swap_execution_intents allowance_intents
        join public.swap_execution_results allowance_results
          on allowance_results.intent_id = allowance_intents.id
          and allowance_results.status = 'confirmed'
        where allowance_intents.owner_user_id = new.owner_user_id
          and allowance_intents.workspace_id = new.workspace_id
          and allowance_intents.agent_id = new.agent_id
          and allowance_intents.step = 'allowance_set'
          and lower(allowance_intents.sender_address) = lower(new.sender_address)
          and lower(allowance_intents.token_address) = lower(new.token_address)
          and lower(allowance_intents.spender_address) = lower(new.spender_address)
      )
    then
      raise exception 'swap_revoke_scope_mismatch' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_swap_execution_intent()
from public, anon, authenticated;

commit;
