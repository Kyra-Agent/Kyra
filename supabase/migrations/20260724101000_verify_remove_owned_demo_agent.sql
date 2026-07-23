do $$
declare
  v_definition text;
begin
  if to_regprocedure('public.remove_owned_demo_agent(uuid,uuid)') is null then
    raise exception 'remove_owned_demo_agent function missing';
  end if;

  select pg_get_functiondef('public.remove_owned_demo_agent(uuid,uuid)'::regprocedure)
    into v_definition;

  if position('workspaces.owner_user_id = p_owner_user_id' in v_definition) = 0
    or position('telegram_disconnect_required' in v_definition) = 0
    or position('execution_history_present' in v_definition) = 0
    or position('for update of agents' in lower(v_definition)) = 0
  then
    raise exception 'remove_owned_demo_agent safety contract incomplete';
  end if;

  if has_function_privilege('anon', 'public.remove_owned_demo_agent(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.remove_owned_demo_agent(uuid,uuid)', 'execute')
  then
    raise exception 'remove_owned_demo_agent must remain inaccessible to browser roles';
  end if;

  if not has_function_privilege('service_role', 'public.remove_owned_demo_agent(uuid,uuid)', 'execute') then
    raise exception 'service_role execute grant missing for remove_owned_demo_agent';
  end if;
end;
$$;
