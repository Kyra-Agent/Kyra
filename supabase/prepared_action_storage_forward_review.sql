-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 6B forward SQL packet for prepared action owner-scoped storage.
-- This file is a local review artifact only. Do not run it in Supabase until
-- the forward, rollback, verifier, target-project baseline, and runtime-gate
-- state are explicitly approved together.
-- Base MCP provider calls, wallet prompts, signing, transaction submission, and
-- Telegram execution gates must remain disabled.
-- No secrets, raw provider payloads, raw calldata, wallet addresses, private
-- keys, seed phrases, Telegram token refs, API keys, or transaction hashes are
-- included.

begin;

do $$
begin
  if to_regclass('public.workspaces') is null then
    raise exception 'public.workspaces missing';
  end if;

  if to_regclass('public.agent_instances') is null then
    raise exception 'public.agent_instances missing';
  end if;

  if to_regprocedure('public.owns_workspace(uuid)') is null then
    raise exception 'public.owns_workspace(uuid) missing';
  end if;

  if to_regclass('public.prepared_actions') is not null then
    raise exception 'public.prepared_actions already exists';
  end if;

  if to_regclass('public.prepared_action_owner_summaries') is not null then
    raise exception 'public.prepared_action_owner_summaries already exists';
  end if;
end;
$$;

create table public.prepared_actions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  request_id text not null,
  action_kind text not null,
  chain text not null,
  status text not null,
  risk text not null,
  route_summary text not null,
  value_summary text not null,
  approval_requirement text not null,
  safety_note text not null,
  provider text not null,
  provider_payload_ref text null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint prepared_actions_pkey
    primary key (id),
  constraint prepared_actions_workspace_fkey
    foreign key (workspace_id)
    references public.workspaces(id)
    on delete cascade,
  constraint prepared_actions_agent_fkey
    foreign key (agent_id)
    references public.agent_instances(id)
    on delete cascade,
  constraint prepared_actions_request_unique
    unique (workspace_id, agent_id, request_id),
  constraint prepared_actions_action_kind_check
    check (action_kind in ('base_mcp_status_check')),
  constraint prepared_actions_chain_check
    check (chain in ('base')),
  constraint prepared_actions_status_check
    check (
      status in (
        'draft',
        'preparing',
        'preview_ready',
        'review_required',
        'approved',
        'rejected',
        'expired',
        'failed'
      )
    ),
  constraint prepared_actions_risk_check
    check (risk in ('read-only', 'review', 'blocked')),
  constraint prepared_actions_provider_check
    check (provider in ('base_mcp')),
  constraint prepared_actions_route_summary_len
    check (char_length(btrim(route_summary)) between 1 and 160),
  constraint prepared_actions_value_summary_len
    check (char_length(btrim(value_summary)) between 1 and 160),
  constraint prepared_actions_approval_requirement_len
    check (char_length(btrim(approval_requirement)) between 1 and 200),
  constraint prepared_actions_safety_note_len
    check (char_length(btrim(safety_note)) between 1 and 200),
  constraint prepared_actions_request_id_format_check
    check (request_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'),
  constraint prepared_actions_provider_payload_ref_format_check
    check (
      provider_payload_ref is null
      or provider_payload_ref ~ '^prepared:base-mcp:[0-9a-f-]{36}:[A-Za-z0-9:_-]{8,128}$'
    ),
  constraint prepared_actions_expires_future_check
    check (expires_at is null or expires_at > created_at),
  constraint prepared_actions_updated_after_created_check
    check (updated_at >= created_at),
  constraint prepared_actions_resolved_after_created_check
    check (resolved_at is null or resolved_at >= created_at)
);

create index prepared_actions_workspace_created_idx
  on public.prepared_actions (workspace_id, created_at desc);

create index prepared_actions_agent_created_idx
  on public.prepared_actions (agent_id, created_at desc);

create index prepared_actions_expiry_idx
  on public.prepared_actions (expires_at)
  where expires_at is not null;

alter table public.prepared_actions
  enable row level security;

drop policy if exists "Workspace owners can read prepared actions"
  on public.prepared_actions;
create policy "Workspace owners can read prepared actions"
on public.prepared_actions
for select
using (public.owns_workspace(workspace_id));

create or replace view public.prepared_action_owner_summaries
with (security_invoker = true)
as
select
  prepared_actions.id,
  prepared_actions.workspace_id,
  prepared_actions.agent_id,
  prepared_actions.action_kind,
  prepared_actions.chain,
  prepared_actions.status,
  prepared_actions.risk,
  prepared_actions.route_summary,
  prepared_actions.value_summary,
  prepared_actions.approval_requirement,
  prepared_actions.expires_at,
  prepared_actions.created_at,
  prepared_actions.safety_note
from public.prepared_actions prepared_actions;

revoke all privileges on public.prepared_actions from public;
revoke all privileges on public.prepared_actions from anon;
revoke all privileges on public.prepared_actions from authenticated;
revoke all privileges on public.prepared_actions from service_role;
revoke all privileges on public.prepared_action_owner_summaries from public;
revoke all privileges on public.prepared_action_owner_summaries from anon;
revoke all privileges on public.prepared_action_owner_summaries from authenticated;
revoke all privileges on public.prepared_action_owner_summaries from service_role;

grant select (
  id,
  workspace_id,
  agent_id,
  action_kind,
  chain,
  status,
  risk,
  route_summary,
  value_summary,
  approval_requirement,
  expires_at,
  created_at,
  safety_note
) on public.prepared_actions to authenticated;
grant select on public.prepared_action_owner_summaries to authenticated;
grant select, insert, update on public.prepared_actions to service_role;
grant select on public.prepared_action_owner_summaries to service_role;

commit;
