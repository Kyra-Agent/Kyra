begin;

-- agent_instances.telegram_status was written once at deploy and never
-- changed, so public profiles could not tell a live bot from an agent with
-- no bot. Keep it in step with the agent's Telegram sessions: active when
-- any session's webhook is active, queued while one is activating, and
-- mocked (no bot) otherwise.
create or replace function public.sync_agent_telegram_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent_id uuid := coalesce(new.agent_id, old.agent_id);
  v_status text;
begin
  select case
    when bool_or(sessions.webhook_status = 'active') then 'active'
    when bool_or(sessions.webhook_status = 'queued') then 'queued'
    else 'mocked'
  end
  into v_status
  from public.telegram_sessions sessions
  where sessions.agent_id = v_agent_id;

  update public.agent_instances agents
  set telegram_status = coalesce(v_status, 'mocked')
  where agents.id = v_agent_id
    and agents.telegram_status is distinct from coalesce(v_status, 'mocked');

  return null;
end;
$$;

revoke all on function public.sync_agent_telegram_status()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_agent_telegram_status on public.telegram_sessions;
create trigger sync_agent_telegram_status
after insert or delete or update of webhook_status, agent_id
on public.telegram_sessions
for each row execute function public.sync_agent_telegram_status();

-- Backfill agents that already have a live bot.
update public.agent_instances agents
set telegram_status = case
  when exists (
    select 1 from public.telegram_sessions sessions
    where sessions.agent_id = agents.id and sessions.webhook_status = 'active'
  ) then 'active'
  when exists (
    select 1 from public.telegram_sessions sessions
    where sessions.agent_id = agents.id and sessions.webhook_status = 'queued'
  ) then 'queued'
  else 'mocked'
end
where agents.telegram_status is distinct from case
  when exists (
    select 1 from public.telegram_sessions sessions
    where sessions.agent_id = agents.id and sessions.webhook_status = 'active'
  ) then 'active'
  when exists (
    select 1 from public.telegram_sessions sessions
    where sessions.agent_id = agents.id and sessions.webhook_status = 'queued'
  ) then 'queued'
  else 'mocked'
end;

commit;
