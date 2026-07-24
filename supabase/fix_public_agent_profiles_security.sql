drop view if exists public.public_agent_profiles;

drop policy if exists "Online demo agent instances are public readable" on public.agent_instances;
create policy "Online demo agent instances are public readable"
on public.agent_instances
for select
using (status = 'online' and mode = 'demo');

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
grant usage on schema public to anon, authenticated;
grant select on public.agent_templates to anon, authenticated;

create view public.public_agent_profiles
with (security_invoker = true)
as
select
  agents.public_slug,
  agents.display_name,
  agents.handle,
  agents.status,
  agents.mode,
  agents.network,
  agents.telegram_status,
  agents.chain_action_status,
  agents.created_at,
  agents.last_sync_at,
  templates.id as template_id,
  templates.name as template_name,
  templates.role as template_role,
  templates.status as template_status,
  templates.summary as template_summary,
  templates.best_for as template_best_for,
  templates.actions as template_actions,
  templates.modules as template_modules
from public.agent_instances agents
join public.agent_templates templates on templates.id = agents.template_id
where agents.status = 'online'
  and agents.mode = 'demo';

grant select on public.public_agent_profiles to anon, authenticated;
