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

create table if not exists public.telegram_webhook_secrets (
  webhook_secret_ref text not null,
  webhook_secret_hash text not null,
  telegram_session_id uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint telegram_webhook_secrets_pkey
    primary key (webhook_secret_ref),
  constraint telegram_webhook_secrets_session_fkey
    foreign key (telegram_session_id)
    references public.telegram_sessions(id)
    on delete cascade,
  constraint telegram_webhook_secrets_ref_not_blank_check
    check (length(btrim(webhook_secret_ref)) > 0),
  constraint telegram_webhook_secrets_ref_format_check
    check (
      webhook_secret_ref ~
      '^webhook:telegram:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  constraint telegram_webhook_secrets_hash_not_blank_check
    check (length(btrim(webhook_secret_hash)) > 0),
  constraint telegram_webhook_secrets_hash_format_check
    check (webhook_secret_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.telegram_chat_authorizations (
  id uuid not null default gen_random_uuid(),
  agent_id uuid not null,
  telegram_user_id text not null,
  telegram_chat_id text not null,
  role text not null default 'owner',
  command_scope text not null default 'read_only',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint telegram_chat_authorizations_pkey
    primary key (id),
  constraint telegram_chat_authorizations_agent_fkey
    foreign key (agent_id)
    references public.agent_instances(id)
    on delete cascade,
  constraint telegram_chat_authorizations_user_not_blank_check
    check (length(btrim(telegram_user_id)) > 0),
  constraint telegram_chat_authorizations_user_format_check
    check (telegram_user_id ~ '^[1-9][0-9]*$'),
  constraint telegram_chat_authorizations_chat_not_blank_check
    check (length(btrim(telegram_chat_id)) > 0),
  constraint telegram_chat_authorizations_chat_format_check
    check (telegram_chat_id ~ '^-?[1-9][0-9]*$'),
  constraint telegram_chat_authorizations_owner_role_check
    check (role = 'owner'),
  constraint telegram_chat_authorizations_read_only_scope_check
    check (command_scope = 'read_only')
);

create table if not exists public.telegram_processed_updates (
  telegram_session_id uuid not null,
  telegram_update_id bigint not null,
  created_at timestamptz not null default now(),
  constraint telegram_processed_updates_pkey
    primary key (telegram_session_id, telegram_update_id),
  constraint telegram_processed_updates_session_fkey
    foreign key (telegram_session_id)
    references public.telegram_sessions(id)
    on delete cascade,
  constraint telegram_processed_updates_id_nonnegative_check
    check (telegram_update_id >= 0)
);

create index if not exists workspaces_owner_user_id_idx on public.workspaces(owner_user_id);
create unique index if not exists workspaces_owner_demo_unique_idx
on public.workspaces(owner_user_id)
where mode = 'demo';
create index if not exists agent_instances_workspace_id_idx on public.agent_instances(workspace_id);
create index if not exists agent_instances_public_slug_idx on public.agent_instances(public_slug);
create index if not exists wallet_policies_workspace_id_idx on public.wallet_policies(workspace_id);
create index if not exists approval_requests_agent_id_idx on public.approval_requests(agent_id);
create index if not exists activity_logs_agent_id_created_at_idx on public.activity_logs(agent_id, created_at desc);
create unique index if not exists telegram_chat_authorizations_active_agent_key
on public.telegram_chat_authorizations(agent_id)
where revoked_at is null;
create unique index if not exists telegram_webhook_secrets_active_session_key
on public.telegram_webhook_secrets(telegram_session_id)
where revoked_at is null;
create unique index if not exists telegram_webhook_secrets_active_hash_key
on public.telegram_webhook_secrets(webhook_secret_hash)
where revoked_at is null;

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

drop trigger if exists enforce_demo_agent_limit_on_insert on public.agent_instances;
create trigger enforce_demo_agent_limit_on_insert
before insert on public.agent_instances
for each row
execute function public.enforce_demo_agent_limit();

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

create or replace function public.resolve_telegram_webhook_session(
  p_webhook_secret_hash text
) returns table (
  session_id uuid,
  agent_id uuid,
  workspace_id uuid,
  owner_user_id uuid,
  bot_handle text,
  webhook_status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    sessions.id as session_id,
    sessions.agent_id,
    agents.workspace_id,
    workspaces.owner_user_id,
    sessions.bot_handle,
    sessions.webhook_status
  from public.telegram_webhook_secrets secrets
  join public.telegram_sessions sessions
    on sessions.id = secrets.telegram_session_id
  join public.agent_instances agents
    on agents.id = sessions.agent_id
  join public.workspaces workspaces
    on workspaces.id = agents.workspace_id
  where secrets.webhook_secret_hash = p_webhook_secret_hash
    and secrets.revoked_at is null
    and sessions.webhook_status = 'active'
  limit 2;
$$;

create or replace function public.resolve_telegram_chat_authorization(
  p_agent_id uuid,
  p_telegram_user_id text,
  p_telegram_chat_id text,
  p_command_kind text
) returns table (
  authorized boolean,
  role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    true as authorized,
    authorizations.role
  from public.telegram_chat_authorizations authorizations
  where authorizations.agent_id = p_agent_id
    and authorizations.telegram_user_id = p_telegram_user_id
    and authorizations.telegram_chat_id = p_telegram_chat_id
    and authorizations.role = 'owner'
    and authorizations.command_scope = 'read_only'
    and p_command_kind = 'read_only'
    and authorizations.revoked_at is null
  limit 2;
$$;

create or replace function public.claim_telegram_update(
  p_telegram_session_id uuid,
  p_telegram_update_id bigint
) returns table (
  claimed boolean,
  status text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  with eligible_session as (
    select sessions.id
    from public.telegram_sessions sessions
    where sessions.id = p_telegram_session_id
      and sessions.webhook_status = 'active'
      and p_telegram_update_id >= 0
  ),
  inserted as (
    insert into public.telegram_processed_updates (
      telegram_session_id,
      telegram_update_id
    )
    select
      eligible_session.id,
      p_telegram_update_id
    from eligible_session
    on conflict on constraint telegram_processed_updates_pkey do nothing
    returning true
  )
  select
    exists(select 1 from inserted) as claimed,
    case
      when exists(select 1 from inserted) then 'claimed'
      else 'duplicate'
    end as status
  from eligible_session;
$$;

alter table public.workspaces enable row level security;
alter table public.agent_templates enable row level security;
alter table public.agent_instances enable row level security;
alter table public.wallet_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.activity_logs enable row level security;
alter table public.telegram_sessions enable row level security;
alter table public.telegram_webhook_secrets enable row level security;
alter table public.telegram_chat_authorizations enable row level security;
alter table public.telegram_processed_updates enable row level security;

drop policy if exists "Templates are public readable" on public.agent_templates;
create policy "Templates are public readable"
on public.agent_templates
for select
using (true);

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

create or replace view public.public_agent_profiles
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
  agents.base_mcp_status,
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

grant usage on schema public to anon, authenticated, service_role;
grant select on public.agent_templates to anon, authenticated, service_role;

revoke all privileges on public.workspaces from authenticated;
revoke all privileges on public.agent_instances from authenticated;
revoke all privileges on public.wallet_policies from authenticated;
revoke all privileges on public.approval_requests from authenticated;
revoke all privileges on public.activity_logs from authenticated;
revoke all privileges on public.telegram_sessions from authenticated;
revoke all privileges on public.telegram_webhook_secrets from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_chat_authorizations from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_processed_updates from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_session_summaries from anon, authenticated;
revoke all on function public.resolve_telegram_webhook_session(text)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_telegram_chat_authorization(uuid,text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_telegram_update(uuid,bigint)
  from public, anon, authenticated, service_role;

grant select on public.workspaces to authenticated;
grant select (
  public_slug,
  display_name,
  handle,
  status,
  mode,
  network,
  telegram_status,
  base_mcp_status,
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

grant all on public.workspaces to service_role;
grant all on public.agent_instances to service_role;
grant all on public.wallet_policies to service_role;
grant all on public.approval_requests to service_role;
grant all on public.activity_logs to service_role;
grant all on public.telegram_sessions to service_role;
grant select, insert, update on public.telegram_webhook_secrets to service_role;
grant select, insert, update on public.telegram_chat_authorizations to service_role;
grant select, insert on public.telegram_processed_updates to service_role;
grant select on public.telegram_session_summaries to service_role;
grant select on public.public_agent_profiles to service_role;
grant execute on function public.owns_workspace(uuid) to service_role;
grant execute on function public.resolve_telegram_webhook_session(text)
  to service_role;
grant execute on function public.resolve_telegram_chat_authorization(uuid,text,text,text)
  to service_role;
grant execute on function public.claim_telegram_update(uuid,bigint)
  to service_role;
