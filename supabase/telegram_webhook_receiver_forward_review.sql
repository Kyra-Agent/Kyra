-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5AR.1 forward SQL packet for future Telegram webhook receiver lookup.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, rollback review, and
-- verifier expectations are explicitly approved together.
-- Runtime gates must remain disabled until a separate runtime wiring approval.
-- No secrets, tokens, or environment values are included in this file.

-- Scope
-- - Creates public.telegram_webhook_secrets.
-- - Creates public.resolve_telegram_webhook_session(text).
-- - Does not create chat authorization tables or command processing objects.
-- - Does not modify schema.sql.
-- - Does not create, read, or store raw BotFather tokens or raw webhook secrets.

begin;

do $$
begin
  if to_regclass('public.telegram_webhook_secrets') is not null then
    raise exception 'public.telegram_webhook_secrets already exists';
  end if;

  if to_regprocedure('public.resolve_telegram_webhook_session(text)') is not null then
    raise exception 'public.resolve_telegram_webhook_session(text) already exists';
  end if;
end;
$$;

create table public.telegram_webhook_secrets (
  webhook_secret_ref text not null,
  webhook_secret_hash text not null,
  telegram_session_id uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
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

create unique index telegram_webhook_secrets_active_session_key
  on public.telegram_webhook_secrets (telegram_session_id)
  where revoked_at is null;

create unique index telegram_webhook_secrets_active_hash_key
  on public.telegram_webhook_secrets (webhook_secret_hash)
  where revoked_at is null;

alter table public.telegram_webhook_secrets enable row level security;

revoke all on public.telegram_webhook_secrets from public;
revoke all on public.telegram_webhook_secrets from anon;
revoke all on public.telegram_webhook_secrets from authenticated;
revoke all on public.telegram_webhook_secrets from service_role;
grant select, insert, update on public.telegram_webhook_secrets to service_role;

create function public.resolve_telegram_webhook_session(
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

revoke all on function public.resolve_telegram_webhook_session(text)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_telegram_webhook_session(text)
  to service_role;

commit;

-- Required immediately after approved apply:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before runtime wiring if any required webhook receiver result is false.
