do $$
begin
  if not exists (
    select 1
    from pg_class
    where oid = 'public.agent_settings'::regclass
      and relrowsecurity
  ) then
    raise exception 'agent settings must have row level security enabled';
  end if;

  if has_table_privilege('anon', 'public.agent_settings', 'select')
    or has_table_privilege('authenticated', 'public.agent_settings', 'insert')
    or has_table_privilege('authenticated', 'public.agent_settings', 'update')
    or has_table_privilege('authenticated', 'public.agent_settings', 'delete')
  then
    raise exception 'agent settings writes must stay backend-only';
  end if;

  if not exists (
    select 1
    from pg_policy
    where polrelid = 'public.agent_settings'::regclass
      and polname = 'Workspace owners can read agent settings'
      and polcmd = 'r'
  ) then
    raise exception 'agent settings owner read policy missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agent_settings'::regclass
      and contype = 'f'
      and confrelid = 'public.agent_instances'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'agent settings must cascade with their agent';
  end if;

  if has_table_privilege('anon', 'public.agent_instances', 'truncate') then
    raise exception 'anon must not hold truncate on public tables';
  end if;
end;
$$;
