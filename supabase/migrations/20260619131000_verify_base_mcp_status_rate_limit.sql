do $$
declare
  v_check boolean;
begin
  if to_regclass('public.base_mcp_status_rate_limits') is null then
    raise exception 'base_mcp_status_rate_limits table missing';
  end if;

  if to_regprocedure(
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)'
  ) is null then
    raise exception 'consume_base_mcp_status_rate_limit function missing';
  end if;

  select relrowsecurity
    into v_check
  from pg_class
  where oid = to_regclass('public.base_mcp_status_rate_limits');

  if v_check is not true then
    raise exception 'base_mcp_status_rate_limits RLS disabled';
  end if;

  if has_table_privilege(
    'anon',
    'public.base_mcp_status_rate_limits',
    'SELECT,INSERT,UPDATE,DELETE'
  ) then
    raise exception 'anon table privilege present';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.base_mcp_status_rate_limits',
    'SELECT,INSERT,UPDATE,DELETE'
  ) then
    raise exception 'authenticated table privilege present';
  end if;

  if not (
    has_table_privilege(
      'service_role',
      'public.base_mcp_status_rate_limits',
      'SELECT'
    )
    and has_table_privilege(
      'service_role',
      'public.base_mcp_status_rate_limits',
      'INSERT'
    )
    and has_table_privilege(
      'service_role',
      'public.base_mcp_status_rate_limits',
      'UPDATE'
    )
  ) then
    raise exception 'service role table privileges incomplete';
  end if;

  if has_table_privilege(
    'service_role',
    'public.base_mcp_status_rate_limits',
    'DELETE'
  ) then
    raise exception 'service role delete privilege present';
  end if;

  if has_function_privilege(
    'anon',
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon function execute privilege present';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated function execute privilege present';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'service role function execute privilege missing';
  end if;

  select not prosecdef
    into v_check
  from pg_proc
  where oid = to_regprocedure(
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)'
  );

  if v_check is not true then
    raise exception 'rate limit function is not security invoker';
  end if;

  select count(*) = 7
    into v_check
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'base_mcp_status_rate_limits';

  if v_check is not true then
    raise exception 'rate limit table column contract mismatch';
  end if;

  select count(*) >= 3
    into v_check
  from pg_constraint
  where conrelid = to_regclass('public.base_mcp_status_rate_limits')
    and contype = 'c';

  if v_check is not true then
    raise exception 'rate limit table safety constraints missing';
  end if;
end;
$$;
