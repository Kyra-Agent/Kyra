do $$
declare
  public_policy_roles name[];
begin
  select roles
  into public_policy_roles
  from pg_policies
  where schemaname = 'public'
    and tablename = 'agent_instances'
    and policyname = 'Online demo agent instances are public readable';

  if public_policy_roles is null
    or public_policy_roles <> array['anon']::name[]
  then
    raise exception 'public demo agent policy must be restricted to anon';
  end if;

  if has_function_privilege(
    'anon',
    'public.owns_workspace(uuid)',
    'execute'
  ) then
    raise exception 'anon can execute owns_workspace';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.owns_workspace(uuid)',
    'execute'
  ) then
    raise exception 'authenticated owner policy cannot execute owns_workspace';
  end if;

  if has_function_privilege(
    'anon',
    'public.enforce_demo_agent_limit()',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.enforce_demo_agent_limit()',
    'execute'
  ) then
    raise exception 'demo agent trigger function is directly executable';
  end if;
end;
$$;
