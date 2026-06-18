-- Read-only Phase 7L verifier. Returns booleans only and no user rows.
select
  to_regclass('public.base_mcp_status_rate_limits') is not null as table_exists,
  to_regprocedure(
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)'
  ) is not null as function_exists,
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.base_mcp_status_rate_limits')
  ), false) as rls_enabled,
  not has_table_privilege(
    'anon', 'public.base_mcp_status_rate_limits', 'SELECT,INSERT,UPDATE,DELETE'
  ) as anon_table_denied,
  not has_table_privilege(
    'authenticated', 'public.base_mcp_status_rate_limits',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as authenticated_table_denied,
  (
    has_table_privilege(
      'service_role', 'public.base_mcp_status_rate_limits', 'SELECT'
    )
    and has_table_privilege(
      'service_role', 'public.base_mcp_status_rate_limits', 'INSERT'
    )
    and has_table_privilege(
      'service_role', 'public.base_mcp_status_rate_limits', 'UPDATE'
    )
  ) as service_table_granted,
  not has_table_privilege(
    'service_role', 'public.base_mcp_status_rate_limits', 'DELETE'
  ) as service_delete_denied,
  not has_function_privilege(
    'anon',
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)',
    'EXECUTE'
  ) as anon_function_denied,
  not has_function_privilege(
    'authenticated',
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)',
    'EXECUTE'
  ) as authenticated_function_denied,
  has_function_privilege(
    'service_role',
    'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)',
    'EXECUTE'
  ) as service_function_granted,
  coalesce((
    select not prosecdef
    from pg_proc
    where oid = to_regprocedure(
      'public.consume_base_mcp_status_rate_limit(uuid,uuid,uuid)'
    )
  ), false) as security_invoker,
  coalesce((
    select count(*) = 7
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'base_mcp_status_rate_limits'
  ), false) as exact_column_count,
  coalesce((
    select count(*) >= 3
    from pg_constraint
    where conrelid = to_regclass('public.base_mcp_status_rate_limits')
      and contype = 'c'
  ), false) as safety_constraints_present;
