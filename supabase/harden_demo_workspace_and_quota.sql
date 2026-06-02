create unique index if not exists workspaces_owner_demo_unique_idx
on public.workspaces(owner_user_id)
where mode = 'demo';

create or replace function public.enforce_demo_agent_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mode = 'demo' then
    perform pg_advisory_xact_lock(hashtext(new.workspace_id::text));

    if (
      select count(*)
      from public.agent_instances
      where workspace_id = new.workspace_id
        and mode = 'demo'
    ) >= 3 then
      raise exception 'Demo agent limit reached (3/3).';
    end if;
  end if;

  return new;
end;
$$;
