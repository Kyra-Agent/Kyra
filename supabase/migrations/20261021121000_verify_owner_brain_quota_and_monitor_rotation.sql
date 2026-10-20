do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.telegram_owner_brain_usage'::regclass and relrowsecurity
  ) then
    raise exception 'owner brain usage must have row level security enabled';
  end if;

  if has_table_privilege('anon', 'public.telegram_owner_brain_usage', 'select')
    or has_table_privilege('authenticated', 'public.telegram_owner_brain_usage', 'select')
    or has_table_privilege('authenticated', 'public.telegram_owner_brain_usage', 'insert')
  then
    raise exception 'owner brain usage must stay backend-only';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.consume_telegram_owner_brain_quota(uuid)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.consume_telegram_owner_brain_quota(uuid)'::regprocedure,
    'execute'
  ) then
    raise exception 'owner brain quota must stay backend-only';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'kyra-purge-telegram-owner-brain-usage'
  ) then
    raise exception 'owner brain usage purge job missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_watch_items'
      and column_name = 'checked_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_launch_subscriptions'
      and column_name = 'attempted_at'
  ) then
    raise exception 'monitor rotation columns missing';
  end if;
end;
$$;
