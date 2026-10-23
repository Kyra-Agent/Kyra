do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.set_agent_trade_rule_enabled(uuid,uuid,boolean)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.set_agent_trade_rule_enabled(uuid,uuid,boolean)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.delete_agent_trade_rule(uuid,uuid)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.delete_agent_trade_rule(uuid,uuid)'::regprocedure,
    'execute'
  ) then
    raise exception 'trade rule owner controls must stay backend-only';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.set_agent_trade_rule_enabled(uuid,uuid,boolean)'::regprocedure,
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.delete_agent_trade_rule(uuid,uuid)'::regprocedure,
    'execute'
  ) then
    raise exception 'agent-trade-rules needs the owner control functions';
  end if;
end;
$$;
