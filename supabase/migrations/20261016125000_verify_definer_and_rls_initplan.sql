do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null and (
    has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
    or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')
  ) then
    raise exception 'rls_auto_enable must not be executable by API roles';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'Users can read their own workspaces',
        'Workspace owners can read execution results'
      )
      and qual !~* '\(\s*select\s+auth\.uid\(\)'
  ) then
    raise exception 'Owner policies must evaluate auth.uid() once per statement';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspaces'
      and policyname = 'Users can read their own workspaces'
      and roles = array['authenticated']::name[]
  ) then
    raise exception 'Workspace read policy must be scoped to authenticated';
  end if;
end;
$$;
