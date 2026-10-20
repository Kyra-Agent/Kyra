begin;

-- Owner-controlled settings that shape how a deployed agent answers: tone,
-- focus instructions, project knowledge, which template actions and modules
-- are on, and the owner's risk preferences. Owners read their own rows; all
-- writes go through the deploy-agent and agent-settings Edge Functions.
-- Public agent profiles never read this table.
create table if not exists public.agent_settings (
  agent_id uuid primary key
    references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  persona text not null default 'professional',
  instructions text not null default '',
  knowledge text not null default '',
  enabled_actions text[] not null default '{}',
  enabled_modules text[] not null default '{}',
  risk_profile text not null default 'balanced',
  max_review_usd integer,
  updated_at timestamptz not null default now(),
  constraint agent_settings_persona_check
    check (persona in ('professional', 'friendly', 'concise', 'bold')),
  constraint agent_settings_instructions_check
    check (char_length(instructions) <= 1000),
  constraint agent_settings_knowledge_check
    check (char_length(knowledge) <= 4000),
  constraint agent_settings_actions_check
    check (cardinality(enabled_actions) <= 12),
  constraint agent_settings_modules_check
    check (
      cardinality(enabled_modules) <= 5
      and enabled_modules <@ array['NIRA-01', 'VEXA-02', 'ASTRA-03', 'NOVA-04', 'NYX-05']::text[]
    ),
  constraint agent_settings_risk_profile_check
    check (risk_profile in ('conservative', 'balanced', 'aggressive')),
  constraint agent_settings_max_review_check
    check (max_review_usd is null or max_review_usd between 1 and 10000000)
);

create index if not exists agent_settings_workspace_idx
  on public.agent_settings (workspace_id);

alter table public.agent_settings enable row level security;

drop policy if exists "Workspace owners can read agent settings"
  on public.agent_settings;
create policy "Workspace owners can read agent settings"
  on public.agent_settings
  for select
  to authenticated
  using ((select public.owns_workspace(workspace_id)));

revoke all privileges on public.agent_settings
  from public, anon, authenticated, service_role;
grant select on public.agent_settings to authenticated;
grant select, insert, update, delete on public.agent_settings to service_role;

-- Hygiene: API roles never need these table privileges.
revoke truncate, trigger, references on all tables in schema public
  from anon, authenticated;

commit;
