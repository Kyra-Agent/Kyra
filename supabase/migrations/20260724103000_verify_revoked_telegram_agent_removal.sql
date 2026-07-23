do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.remove_owned_demo_agent(uuid,uuid)'::regprocedure)
    into v_definition;

  if position('sessions.webhook_status in (''active'', ''queued'')' in lower(v_definition)) = 0
    or position('secrets.revoked_at is null' in lower(v_definition)) = 0
    or position('sessions.token_secret_ref is not null' in lower(v_definition)) > 0
  then
    raise exception 'revoked Telegram agent removal contract incomplete';
  end if;

  if has_function_privilege('anon', 'public.remove_owned_demo_agent(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.remove_owned_demo_agent(uuid,uuid)', 'execute')
    or not has_function_privilege('service_role', 'public.remove_owned_demo_agent(uuid,uuid)', 'execute')
  then
    raise exception 'remove_owned_demo_agent privileges drifted';
  end if;
end;
$$;
