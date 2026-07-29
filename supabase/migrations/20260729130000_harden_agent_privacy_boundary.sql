begin;

drop policy if exists "Online demo agent instances are public readable"
on public.agent_instances;

create policy "Online demo agent instances are public readable"
on public.agent_instances
for select
to anon
using (status = 'online' and mode = 'demo');

revoke all on function public.enforce_demo_agent_limit()
from public, anon, authenticated, service_role;

revoke all on function public.owns_workspace(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.owns_workspace(uuid)
to authenticated, service_role;

commit;
