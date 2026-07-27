do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'telegram_processed_updates'
      and column_name in (
        'delivery_status',
        'lease_expires_at',
        'attempt_count',
        'delivered_at'
      )
    group by table_schema, table_name
    having count(*) = 4
  ) then
    raise exception 'telegram delivery retry columns missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.telegram_processed_updates'::regclass
      and conname = 'telegram_processed_updates_delivery_status_check'
      and contype = 'c'
  ) then
    raise exception 'telegram delivery status constraint missing';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.mark_telegram_update_delivered(uuid,bigint)'::regprocedure
  ) then
    raise exception 'telegram delivery completion function missing';
  end if;

  if position(
    'lease_expires_at'
    in pg_get_functiondef('public.claim_telegram_update(uuid,bigint)'::regprocedure)
  ) = 0 then
    raise exception 'telegram update claim is not lease aware';
  end if;

  if position(
    'delivery_status = ''delivered'''
    in pg_get_functiondef(
      'public.mark_telegram_update_delivered(uuid,bigint)'::regprocedure
    )
  ) = 0 then
    raise exception 'telegram update delivery completion is incomplete';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.mark_telegram_update_delivered(uuid,bigint)',
    'execute'
  ) then
    raise exception 'telegram delivery completion is publicly executable';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.telegram_processed_updates',
    'select'
  ) or has_table_privilege(
    'authenticated',
    'public.telegram_processed_updates',
    'update'
  ) then
    raise exception 'telegram delivery metadata is publicly accessible';
  end if;

  if has_function_privilege(
    'anon',
    'public.mark_telegram_update_delivered(uuid,bigint)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.claim_telegram_update(uuid,bigint)',
    'execute'
  ) then
    raise exception 'telegram delivery retry functions cross the service boundary';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.mark_telegram_update_delivered(uuid,bigint)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.claim_telegram_update(uuid,bigint)',
    'execute'
  ) then
    raise exception 'telegram delivery retry service role access missing';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.telegram_processed_updates',
    'select'
  ) or not has_table_privilege(
    'service_role',
    'public.telegram_processed_updates',
    'update'
  ) then
    raise exception 'telegram delivery retry table service access missing';
  end if;
end;
$$;
