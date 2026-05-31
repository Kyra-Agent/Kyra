create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_templates (
  id text primary key,
  name text not null,
  role text not null,
  status text not null check (status in ('mvp', 'advanced', 'coming-soon')),
  summary text not null,
  best_for text not null,
  actions jsonb not null default '[]'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  terminal_seed text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_instances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id text not null references public.agent_templates(id),
  display_name text not null,
  handle text not null,
  public_slug text not null unique,
  status text not null default 'online' check (status in ('online', 'draft', 'paused')),
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  network text not null default 'base' check (network in ('base')),
  telegram_status text not null default 'mocked' check (telegram_status in ('mocked', 'active', 'queued', 'review')),
  base_mcp_status text not null default 'mocked' check (base_mcp_status in ('mocked', 'active', 'queued', 'review')),
  approval_policy_id uuid,
  created_at timestamptz not null default now(),
  last_sync_at timestamptz not null default now()
);

create table if not exists public.wallet_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  wallet_label text not null,
  wallet_address text,
  daily_limit_usdc numeric(18, 6),
  approval_required boolean not null default true,
  allowed_actions jsonb not null default '[]'::jsonb,
  status text not null default 'simulated' check (status in ('active', 'simulated', 'paused')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_instances_approval_policy_id_fkey'
  ) then
    alter table public.agent_instances
      add constraint agent_instances_approval_policy_id_fkey
      foreign key (approval_policy_id)
      references public.wallet_policies(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  scenario_id text,
  title text not null,
  command text not null,
  route text not null,
  risk text not null check (risk in ('normal', 'review', 'read-only')),
  status text not null default 'waiting_wallet' check (
    status in ('waiting_wallet', 'read_only_ready', 'review_required', 'approved', 'rejected')
  ),
  fee_payer text not null default 'connected_wallet' check (fee_payer in ('connected_wallet')),
  requires_wallet boolean not null default true,
  prepared_tx jsonb,
  tx_hash text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agent_instances(id) on delete set null,
  source text not null check (
    source in ('agent_instances', 'telegram_sessions', 'base_mcp_routes', 'approval_requests')
  ),
  level text not null default 'info' check (level in ('info', 'notice', 'warning')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  bot_handle text,
  webhook_status text not null default 'mocked' check (webhook_status in ('mocked', 'queued', 'active', 'paused')),
  token_secret_ref text,
  created_at timestamptz not null default now(),
  last_event_at timestamptz
);

create index if not exists workspaces_owner_user_id_idx on public.workspaces(owner_user_id);
create index if not exists agent_instances_workspace_id_idx on public.agent_instances(workspace_id);
create index if not exists agent_instances_public_slug_idx on public.agent_instances(public_slug);
create index if not exists wallet_policies_workspace_id_idx on public.wallet_policies(workspace_id);
create index if not exists approval_requests_agent_id_idx on public.approval_requests(agent_id);
create index if not exists activity_logs_agent_id_created_at_idx on public.activity_logs(agent_id, created_at desc);

create or replace function public.owns_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and owner_user_id = auth.uid()
  );
$$;

alter table public.workspaces enable row level security;
alter table public.agent_templates enable row level security;
alter table public.agent_instances enable row level security;
alter table public.wallet_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.activity_logs enable row level security;
alter table public.telegram_sessions enable row level security;

drop policy if exists "Templates are public readable" on public.agent_templates;
create policy "Templates are public readable"
on public.agent_templates
for select
using (true);

drop policy if exists "Users can manage their own workspaces" on public.workspaces;
create policy "Users can manage their own workspaces"
on public.workspaces
for all
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "Workspace owners can manage agent instances" on public.agent_instances;
create policy "Workspace owners can manage agent instances"
on public.agent_instances
for all
using (public.owns_workspace(workspace_id))
with check (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can manage wallet policies" on public.wallet_policies;
create policy "Workspace owners can manage wallet policies"
on public.wallet_policies
for all
using (public.owns_workspace(workspace_id))
with check (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can manage approval requests" on public.approval_requests;
create policy "Workspace owners can manage approval requests"
on public.approval_requests
for all
using (public.owns_workspace(workspace_id))
with check (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can read activity logs" on public.activity_logs;
create policy "Workspace owners can read activity logs"
on public.activity_logs
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can create activity logs" on public.activity_logs;
create policy "Workspace owners can create activity logs"
on public.activity_logs
for insert
with check (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can manage telegram sessions" on public.telegram_sessions;
create policy "Workspace owners can manage telegram sessions"
on public.telegram_sessions
for all
using (
  exists (
    select 1
    from public.agent_instances agents
    where agents.id = telegram_sessions.agent_id
      and public.owns_workspace(agents.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.agent_instances agents
    where agents.id = telegram_sessions.agent_id
      and public.owns_workspace(agents.workspace_id)
  )
);

create or replace view public.public_agent_profiles as
select
  agents.public_slug,
  agents.display_name,
  agents.handle,
  agents.status,
  agents.mode,
  agents.network,
  agents.telegram_status,
  agents.base_mcp_status,
  agents.created_at,
  agents.last_sync_at,
  templates.id as template_id,
  templates.name as template_name,
  templates.role as template_role,
  templates.summary as template_summary,
  templates.best_for as template_best_for,
  templates.actions as template_actions,
  templates.modules as template_modules
from public.agent_instances agents
join public.agent_templates templates on templates.id = agents.template_id
where agents.status = 'online'
  and agents.mode = 'demo';

grant usage on schema public to anon, authenticated;
grant select on public.agent_templates to anon, authenticated;
grant select on public.public_agent_profiles to anon, authenticated;
grant all on public.workspaces to authenticated;
grant all on public.agent_instances to authenticated;
grant all on public.wallet_policies to authenticated;
grant all on public.approval_requests to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant all on public.telegram_sessions to authenticated;
grant execute on function public.owns_workspace(uuid) to authenticated;
