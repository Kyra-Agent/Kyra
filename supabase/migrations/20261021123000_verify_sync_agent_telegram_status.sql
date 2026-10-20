do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.telegram_sessions'::regclass
      and tgname = 'sync_agent_telegram_status'
      and not tgisinternal
  ) then
    raise exception 'telegram status sync trigger missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.sync_agent_telegram_status()'::regprocedure,
    'execute'
  ) then
    raise exception 'telegram status sync must not be callable by users';
  end if;

  if exists (
    select 1
    from public.agent_instances agents
    where agents.telegram_status <> 'active'
      and exists (
        select 1 from public.telegram_sessions sessions
        where sessions.agent_id = agents.id and sessions.webhook_status = 'active'
      )
  ) then
    raise exception 'agents with a live bot must show telegram_status active';
  end if;
end;
$$;
