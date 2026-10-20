do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'agent_watch_items', 'agent_price_alerts', 'agent_launch_subscriptions',
    'chain_launch_events', 'monitor_state'
  ] loop
    if not exists (
      select 1 from pg_class
      where oid = ('public.' || v_table)::regclass and relrowsecurity
    ) then
      raise exception '% must have row level security enabled', v_table;
    end if;

    if has_table_privilege('anon', 'public.' || v_table, 'select')
      or has_table_privilege('authenticated', 'public.' || v_table, 'insert')
      or has_table_privilege('authenticated', 'public.' || v_table, 'update')
      or has_table_privilege('authenticated', 'public.' || v_table, 'delete')
    then
      raise exception '% must stay backend-only for writes', v_table;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.chain_launch_events', 'select')
    or has_table_privilege('authenticated', 'public.monitor_state', 'select')
  then
    raise exception 'monitor internals must stay backend-only';
  end if;

  if has_function_privilege(
    'authenticated', 'public.add_agent_watch_item(uuid,text,text,text)'::regprocedure, 'execute'
  ) or has_function_privilege(
    'anon', 'public.list_agent_monitoring(uuid)'::regprocedure, 'execute'
  ) then
    raise exception 'monitoring functions must stay backend-only';
  end if;

  if not exists (select 1 from cron.job where jobname = 'kyra-telegram-monitor')
    or not exists (select 1 from cron.job where jobname = 'kyra-purge-monitoring')
  then
    raise exception 'monitoring cron jobs missing';
  end if;

  if position('kyra_monitor_secret' in (
    select command from cron.job where jobname = 'kyra-telegram-monitor'
  )) = 0 then
    raise exception 'monitor job must read its secret from Vault';
  end if;
end;
$$;
