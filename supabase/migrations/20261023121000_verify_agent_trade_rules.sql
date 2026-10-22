do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.agent_trade_rules'::regclass and relrowsecurity
  ) then
    raise exception 'trade rules must have row level security enabled';
  end if;

  if has_table_privilege('anon', 'public.agent_trade_rules', 'select')
    or has_table_privilege('authenticated', 'public.agent_trade_rules', 'insert')
    or has_table_privilege('authenticated', 'public.agent_trade_rules', 'update')
  then
    raise exception 'trade rules must stay backend-only for writes';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.add_agent_trade_rule(uuid,text,text,text,text,integer,numeric)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.list_agent_trade_rules(uuid)'::regprocedure,
    'execute'
  ) then
    raise exception 'trade rule functions must stay backend-only';
  end if;
end;
$$;
