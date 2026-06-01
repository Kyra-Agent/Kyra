create or replace function public.enforce_demo_agent_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mode = 'demo' and (
    select count(*)
    from public.agent_instances
    where workspace_id = new.workspace_id
      and mode = 'demo'
  ) >= 3 then
    raise exception 'Demo agent limit reached (3/3).';
  end if;

  return new;
end;
$$;
