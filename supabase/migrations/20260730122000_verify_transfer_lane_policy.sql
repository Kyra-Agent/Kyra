do $$
declare
  transfer_constraint text;
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prepared_actions'
      and column_name in (
        'sender_address',
        'asset_kind',
        'token_address',
        'token_symbol',
        'token_decimals',
        'amount_atomic'
      )
  ) <> 6 then
    raise exception 'transfer intent columns are incomplete';
  end if;

  select pg_get_constraintdef(oid)
  into transfer_constraint
  from pg_constraint
  where conrelid = 'public.prepared_actions'::regclass
    and conname = 'prepared_actions_transfer_policy_check'
    and contype = 'c';

  if transfer_constraint is null
    or position('0xa2d99db0593ffd57ae9b92103515bba061fa5ec1' in lower(transfer_constraint)) = 0
    or position('5000000000000000' in transfer_constraint) = 0
    or position('10000000000000000000000' in transfer_constraint) = 0
  then
    raise exception 'transfer allowlist or per-action caps are missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.prepared_actions'::regclass
      and tgname = 'enforce_prepared_action_policy_on_insert'
      and not tgisinternal
  ) then
    raise exception 'prepared action insert policy trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.prepared_actions'::regclass
      and tgname = 'prepared_actions_transfer_daily_limit'
      and not tgisinternal
  ) then
    raise exception 'atomic transfer daily-limit trigger is missing';
  end if;

  if position(
    'new.sender_address is distinct from old.sender_address'
    in pg_get_functiondef('public.enforce_prepared_action_immutable_fields()'::regprocedure)
  ) = 0
    or position(
      'new.amount_atomic is distinct from old.amount_atomic'
      in pg_get_functiondef('public.enforce_prepared_action_immutable_fields()'::regprocedure)
    ) = 0
  then
    raise exception 'transfer intent fields are mutable';
  end if;

  if position(
    'not in (2, 3)'
    in lower(pg_get_functiondef('public.enforce_prepared_action_policy_on_insert()'::regprocedure))
  ) = 0 then
    raise exception 'new transfer intent policy versions are unsafe';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.enforce_prepared_action_policy_on_insert()',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.enforce_prepared_action_transfer_daily_limit()',
    'execute'
  ) then
    raise exception 'transfer policy trigger functions are publicly executable';
  end if;

  if has_table_privilege('authenticated', 'public.prepared_actions', 'insert') then
    raise exception 'authenticated clients can insert prepared actions directly';
  end if;

  if not exists (
    select 1
    from pg_index index_record
    join pg_class index_class on index_class.oid = index_record.indexrelid
    where index_record.indrelid = 'public.prepared_actions'::regclass
      and index_class.relname = 'prepared_actions_transfer_daily_idx'
      and index_record.indisvalid
      and index_record.indisready
  ) then
    raise exception 'transfer daily-limit index is missing';
  end if;
end;
$$;