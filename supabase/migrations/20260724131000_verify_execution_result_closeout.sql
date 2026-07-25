do $$
declare
  forbidden_column_count integer;
begin
  if to_regclass('public.execution_results') is null then
    raise exception 'execution_results table is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'execution_results'
      and policyname = 'Workspace owners can read execution results'
      and roles @> array['authenticated']::name[]
  ) then
    raise exception 'owner-only execution result policy is missing';
  end if;

  if has_table_privilege('anon', 'public.execution_results', 'select')
    or has_table_privilege('anon', 'public.execution_results', 'insert')
    or has_table_privilege('anon', 'public.execution_results', 'update')
    or has_table_privilege('authenticated', 'public.execution_results', 'insert')
    or has_table_privilege('authenticated', 'public.execution_results', 'update')
    or has_table_privilege('authenticated', 'public.execution_results', 'delete')
  then
    raise exception 'execution_results privileges exceed the owner-read-only boundary';
  end if;

  if not has_table_privilege('authenticated', 'public.execution_results', 'select') then
    raise exception 'authenticated owner read access is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.execution_results'::regclass
      and conname = 'execution_results_status_fields_check'
      and contype = 'c'
  ) then
    raise exception 'execution result status consistency constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.execution_results'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (chain_id, tx_hash)'
  ) then
    raise exception 'execution result transaction hash uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.execution_results'::regclass
      and tgname = 'enforce_execution_result_scope_on_write'
      and not tgisinternal
      and tgenabled <> 'D'
  ) then
    raise exception 'execution result owner/workspace/agent scope trigger is missing';
  end if;

  if has_function_privilege('anon', 'public.enforce_execution_result_scope()', 'execute')
    or has_function_privilege('authenticated', 'public.enforce_execution_result_scope()', 'execute')
  then
    raise exception 'execution result scope trigger function is publicly executable';
  end if;

  select count(*)
  into forbidden_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'execution_results'
    and column_name in (
      'private_key',
      'seed_phrase',
      'telegram_token',
      'telegram_bot_token',
      'provider_payload',
      'raw_provider_payload',
      'signed_payload',
      'raw_calldata',
      'submission_nonce'
    );

  if forbidden_column_count <> 0 then
    raise exception 'execution_results contains forbidden sensitive columns';
  end if;
end
$$;