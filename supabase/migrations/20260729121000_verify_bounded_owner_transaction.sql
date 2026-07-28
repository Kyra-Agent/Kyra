do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prepared_actions'
      and column_name = 'policy_version'
      and is_nullable = 'NO'
      and column_default is not null
      and position('2' in column_default) > 0
  ) then
    raise exception 'prepared action policy version is missing or unsafe';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.prepared_actions'::regclass
      and tgname = 'enforce_prepared_action_policy_on_insert'
      and not tgisinternal
  ) then
    raise exception 'prepared action insert policy trigger missing';
  end if;

  if position(
    'new.policy_version is distinct from old.policy_version'
    in pg_get_functiondef('public.enforce_prepared_action_immutable_fields()'::regprocedure)
  ) = 0 then
    raise exception 'prepared action policy version is mutable';
  end if;

  if position(
    '100000000000000'
    in pg_get_constraintdef((
      select oid
      from pg_constraint
      where conrelid = 'public.prepared_actions'::regclass
        and conname = 'prepared_actions_transaction_shape_check'
        and contype = 'c'
    ))
  ) = 0 then
    raise exception 'bounded owner transaction constraint missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.enforce_prepared_action_policy_on_insert()',
    'execute'
  ) then
    raise exception 'prepared action insert policy function is publicly executable';
  end if;

  if not exists (
    select 1
    from pg_index index_record
    join pg_class index_class on index_class.oid = index_record.indexrelid
    where index_record.indrelid = 'public.execution_results'::regclass
      and index_class.relname = 'execution_results_one_result_per_intent_idx'
      and index_record.indisunique
      and index_record.indisvalid
      and index_record.indisready
  ) then
    raise exception 'one execution result per prepared intent index is missing';
  end if;
end;
$$;