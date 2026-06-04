-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5BE.1 forward SQL packet for future Telegram chat authorization.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, rollback review, and
-- verifier expectations are explicitly approved together.
-- All Telegram runtime gates must remain disabled until a separate runtime
-- wiring approval.
-- No secrets, tokens, environment values, or authorization rows are included.

-- Scope
-- - Creates public.telegram_chat_authorizations.
-- - Creates public.resolve_telegram_chat_authorization(uuid,text,text,text).
-- - Supports only an exact active owner-linked user-plus-chat pair and
--   read-only command kind.
-- - Does not create webhook receiver or update-claim objects.
-- - Does not modify schema.sql.

begin;

do $$
begin
  if to_regclass('public.telegram_chat_authorizations') is not null then
    raise exception 'public.telegram_chat_authorizations already exists';
  end if;

  if to_regprocedure(
    'public.resolve_telegram_chat_authorization(uuid,text,text,text)'
  ) is not null then
    raise exception
      'public.resolve_telegram_chat_authorization(uuid,text,text,text) already exists';
  end if;
end;
$$;

create table public.telegram_chat_authorizations (
  id uuid not null default gen_random_uuid(),
  agent_id uuid not null,
  telegram_user_id text not null,
  telegram_chat_id text not null,
  role text not null default 'owner',
  command_scope text not null default 'read_only',
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
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

create unique index telegram_chat_authorizations_active_agent_key
  on public.telegram_chat_authorizations (agent_id)
  where revoked_at is null;

alter table public.telegram_chat_authorizations enable row level security;

revoke all on public.telegram_chat_authorizations from public;
revoke all on public.telegram_chat_authorizations from anon;
revoke all on public.telegram_chat_authorizations from authenticated;
revoke all on public.telegram_chat_authorizations from service_role;
grant select, insert, update on public.telegram_chat_authorizations
  to service_role;

create function public.resolve_telegram_chat_authorization(
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

revoke all on function
  public.resolve_telegram_chat_authorization(uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.resolve_telegram_chat_authorization(uuid,text,text,text)
  to service_role;

commit;

-- Required immediately after an approved apply:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before row creation or runtime wiring if any required chat
--   authorization verifier result is false.
