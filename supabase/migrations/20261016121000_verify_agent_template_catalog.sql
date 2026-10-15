do $$
declare
  catalog_count integer;
begin
  select count(*)
  into catalog_count
  from public.agent_templates
  where id in ('operator', 'scout', 'steward', 'executor', 'strategist', 'custom');

  if catalog_count <> 6 then
    raise exception 'Agent template catalog is incomplete: % of 6 templates present.', catalog_count;
  end if;

  if exists (
    select 1
    from public.agent_templates
    where id in ('operator', 'scout', 'steward', 'executor', 'strategist', 'custom')
      and (
        jsonb_typeof(actions) <> 'array'
        or jsonb_array_length(actions) = 0
        or jsonb_typeof(modules) <> 'array'
        or jsonb_array_length(modules) = 0
      )
  ) then
    raise exception 'Agent template catalog has an empty action or module stack.';
  end if;
end;
$$;
