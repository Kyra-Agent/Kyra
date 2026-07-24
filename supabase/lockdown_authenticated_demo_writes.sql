-- Phase 4C.2C: make production demo writes Edge-only.
--
-- This keeps signed-in users able to read their own dashboard records while
-- preventing browser/manual REST writes with the authenticated role. Demo
-- deploy and reset writes must use Supabase Edge Functions with service_role.

begin;

alter table public.workspaces enable row level security;
alter table public.agent_templates enable row level security;
alter table public.agent_instances enable row level security;
alter table public.wallet_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.activity_logs enable row level security;
alter table public.telegram_sessions enable row level security;

drop policy if exists "Users can manage their own workspaces" on public.workspaces;
drop policy if exists "Users can read their own workspaces" on public.workspaces;
create policy "Users can read their own workspaces"
on public.workspaces
for select
using (owner_user_id = auth.uid());

drop policy if exists "Workspace owners can manage agent instances" on public.agent_instances;
drop policy if exists "Workspace owners can read agent instances" on public.agent_instances;
create policy "Workspace owners can read agent instances"
on public.agent_instances
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Online demo agent instances are public readable" on public.agent_instances;
create policy "Online demo agent instances are public readable"
on public.agent_instances
for select
using (status = 'online' and mode = 'demo');

drop policy if exists "Workspace owners can manage wallet policies" on public.wallet_policies;
drop policy if exists "Workspace owners can read wallet policies" on public.wallet_policies;
create policy "Workspace owners can read wallet policies"
on public.wallet_policies
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can manage approval requests" on public.approval_requests;
drop policy if exists "Workspace owners can read approval requests" on public.approval_requests;
create policy "Workspace owners can read approval requests"
on public.approval_requests
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can read activity logs" on public.activity_logs;
create policy "Workspace owners can read activity logs"
on public.activity_logs
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can create activity logs" on public.activity_logs;

drop policy if exists "Workspace owners can manage telegram sessions" on public.telegram_sessions;
drop policy if exists "Workspace owners can read telegram sessions" on public.telegram_sessions;
create policy "Workspace owners can read telegram sessions"
on public.telegram_sessions
for select
using (
  exists (
    select 1
    from public.agent_instances agents
    where agents.id = telegram_sessions.agent_id
      and public.owns_workspace(agents.workspace_id)
  )
);

create or replace view public.telegram_session_summaries
with (security_invoker = true)
as
select
  sessions.id,
  sessions.agent_id,
  sessions.bot_handle,
  sessions.webhook_status,
  sessions.created_at,
  sessions.last_event_at
from public.telegram_sessions sessions;

revoke all privileges on public.workspaces from authenticated;
revoke all privileges on public.agent_instances from authenticated;
revoke all privileges on public.wallet_policies from authenticated;
revoke all privileges on public.approval_requests from authenticated;
revoke all privileges on public.activity_logs from authenticated;
revoke all privileges on public.telegram_sessions from authenticated;
revoke all privileges on public.telegram_session_summaries from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.agent_templates to anon, authenticated, service_role;
grant select on public.workspaces to authenticated;
grant select (
  public_slug,
  display_name,
  handle,
  status,
  mode,
  network,
  telegram_status,
  chain_action_status,
  created_at,
  last_sync_at,
  template_id
) on public.agent_instances to anon, authenticated;
grant select on public.agent_instances to authenticated;
grant select on public.wallet_policies to authenticated;
grant select on public.approval_requests to authenticated;
grant select on public.activity_logs to authenticated;
grant select (
  id,
  agent_id,
  bot_handle,
  webhook_status,
  created_at,
  last_event_at
) on public.telegram_sessions to authenticated;
grant select on public.telegram_session_summaries to authenticated;
grant select on public.public_agent_profiles to anon, authenticated;
grant execute on function public.owns_workspace(uuid) to authenticated;

grant usage on schema public to service_role;
grant select on public.agent_templates to service_role;
grant all on public.workspaces to service_role;
grant all on public.agent_instances to service_role;
grant all on public.wallet_policies to service_role;
grant all on public.approval_requests to service_role;
grant all on public.activity_logs to service_role;
grant all on public.telegram_sessions to service_role;
grant select on public.telegram_session_summaries to service_role;
grant select on public.public_agent_profiles to service_role;
grant execute on function public.owns_workspace(uuid) to service_role;

commit;
