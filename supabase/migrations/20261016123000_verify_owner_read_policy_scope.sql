do $$
declare
  offending text;
begin
  select string_agg(tablename || '.' || policyname, ', ')
  into offending
  from pg_policies
  where schemaname = 'public'
    and (
      coalesce(qual, '') ilike '%owns_workspace%'
      or coalesce(with_check, '') ilike '%owns_workspace%'
    )
    and roles <> array['authenticated']::name[];

  if offending is not null then
    raise exception 'Owner policies must be scoped to authenticated: %', offending;
  end if;

  if has_function_privilege('anon', 'public.owns_workspace(uuid)', 'execute') then
    raise exception 'anon can execute owns_workspace';
  end if;
end;
$$;
