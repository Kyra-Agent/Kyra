begin;

create or replace function public.remove_owned_demo_agent(
  p_owner_user_id uuid,
  p_agent_id uuid
)
returns table (
  ok boolean,
  status text,
  display_name text,
  remaining_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_display_name text;
  v_chain_action_status text;
  v_remaining_count integer;
begin
  if p_owner_user_id is null or p_agent_id is null then
    return query select false, 'invalid_request'::text, null::text, null::integer;
    return;
  end if;

  select agents.workspace_id, agents.display_name, agents.chain_action_status
    into v_workspace_id, v_display_name, v_chain_action_status
  from public.agent_instances agents
  join public.workspaces workspaces
    on workspaces.id = agents.workspace_id
  where agents.id = p_agent_id
    and agents.mode = 'demo'
    and workspaces.mode = 'demo'
    and workspaces.owner_user_id = p_owner_user_id
  for update of agents;

  if v_workspace_id is null then
    return query select false, 'not_found'::text, null::text, null::integer;
    return;
  end if;

  if v_chain_action_status = 'active' then
    return query select false, 'agent_active'::text, v_display_name, null::integer;
    return;
  end if;

  if exists (
    select 1
    from public.telegram_sessions sessions
    where sessions.agent_id = p_agent_id
      and sessions.webhook_status in ('active', 'queued')
  ) or exists (
    select 1
    from public.telegram_bot_token_secrets secrets
    where secrets.agent_id = p_agent_id
      and secrets.revoked_at is null
  ) then
    return query select false, 'telegram_disconnect_required'::text, v_display_name, null::integer;
    return;
  end if;

  if exists (
    select 1
    from public.approval_requests approvals
    where approvals.agent_id = p_agent_id
      and (
        approvals.tx_hash is not null
        or approvals.status = 'approved'
      )
  ) or exists (
    select 1
    from public.prepared_actions actions
    where actions.agent_id = p_agent_id
      and actions.status = 'approved'
  ) then
    return query select false, 'execution_history_present'::text, v_display_name, null::integer;
    return;
  end if;

  delete from public.agent_instances agents
  where agents.id = p_agent_id
    and agents.workspace_id = v_workspace_id;

  select count(*)::integer
    into v_remaining_count
  from public.agent_instances agents
  where agents.workspace_id = v_workspace_id
    and agents.mode = 'demo';

  return query select true, 'removed'::text, v_display_name, v_remaining_count;
end;
$$;

revoke all on function public.remove_owned_demo_agent(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.remove_owned_demo_agent(uuid, uuid)
  to service_role;

commit;
