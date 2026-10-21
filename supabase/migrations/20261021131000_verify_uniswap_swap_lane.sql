do $$
begin
  if position(
    'uniswap_v3_robinhood'
    in pg_get_constraintdef(
      (select oid from pg_constraint where conname = 'swap_quote_reviews_provider_check')
    )
  ) = 0 then
    raise exception 'swap quotes must be limited to the Uniswap V3 provider';
  end if;

  if position(
    lower('0xCaf681a66D020601342297493863E78C959E5cb2')
    in lower(pg_get_constraintdef(
      (select oid from pg_constraint where conname = 'swap_execution_intents_step_shape_check')
    ))
  ) = 0 then
    raise exception 'swap execution intents must pin the Uniswap router';
  end if;

  if position(
    'daily_swap_limit_exceeded'
    in pg_get_functiondef('public.enforce_swap_execution_intent()'::regprocedure)
  ) = 0 then
    raise exception 'swap execution must enforce the daily swap cap';
  end if;

  if has_table_privilege('authenticated', 'public.swap_quote_reviews', 'select')
    or has_table_privilege('authenticated', 'public.swap_execution_intents', 'insert')
    or has_table_privilege('anon', 'public.swap_execution_results', 'select')
  then
    raise exception 'swap tables must stay backend-only';
  end if;
end;
$$;
