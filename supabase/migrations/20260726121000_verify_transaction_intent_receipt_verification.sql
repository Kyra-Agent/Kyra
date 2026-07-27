do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prepared_actions'
      and column_name in ('recipient', 'value_wei', 'calldata')
    group by table_schema, table_name
    having count(*) = 3
  ) then
    raise exception 'prepared_actions transaction intent fields missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'execution_results'
      and column_name in ('prepared_action_record_id', 'receipt_block_number', 'receipt_checked_at')
    group by table_schema, table_name
    having count(*) = 3
  ) then
    raise exception 'execution_results receipt verification fields missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.execution_results'::regclass
      and conname = 'execution_results_prepared_action_record_id_fkey'
      and contype = 'f'
  ) then
    raise exception 'execution_results prepared action foreign key missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.execution_results'::regclass
      and tgname = 'enforce_execution_result_scope_on_write'
      and not tgisinternal
  ) then
    raise exception 'execution result scope trigger missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.prepared_actions'::regclass
      and conname = 'prepared_actions_transaction_shape_check'
      and contype = 'c'
  ) then
    raise exception 'prepared action transaction shape constraint missing';
  end if;

  if position(
    'new.recipient is distinct from old.recipient'
    in pg_get_functiondef('public.enforce_prepared_action_immutable_fields()'::regprocedure)
  ) = 0 or position(
    'new.value_wei is distinct from old.value_wei'
    in pg_get_functiondef('public.enforce_prepared_action_immutable_fields()'::regprocedure)
  ) = 0 or position(
    'new.calldata is distinct from old.calldata'
    in pg_get_functiondef('public.enforce_prepared_action_immutable_fields()'::regprocedure)
  ) = 0 then
    raise exception 'prepared action transaction fields are not immutable';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.enforce_prepared_action_immutable_fields()',
    'execute'
  ) then
    raise exception 'prepared action immutability function is publicly executable';
  end if;

  if position(
    '''base'''
    in pg_get_functiondef(
      'public.consume_chain_action_rate_limit(uuid,uuid,uuid,text)'::regprocedure
    )
  ) > 0 then
    raise exception 'chain action rate limiter still accepts Base';
  end if;
end;
$$;
