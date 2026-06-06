-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5DI.5 forward SQL packet for future Telegram operator disconnect.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, rollback review, and
-- verifier expectations are explicitly approved together.
-- Telegram disconnect runtime gates must remain disabled until a separate
-- Edge deploy, smoke test, and gate enablement approval.
-- No secrets, raw tokens, webhook secrets, Telegram payloads, or session rows
-- are included.

-- Scope
-- - Creates public.claim_telegram_disconnect_session(uuid,uuid,text).
-- - Atomically transitions one owned active Telegram session to paused.
-- - Returns only bounded backend-only references for service-role runtime use.
-- - Does not resolve raw BotFather tokens.
-- - Does not call Telegram APIs.
-- - Does not create new tables or modify schema.sql.

begin;

do $$
begin
  if to_regclass('public.telegram_sessions') is null then
    raise exception 'public.telegram_sessions missing';
  end if;

  if to_regclass('public.telegram_bot_token_secrets') is null then
    raise exception 'public.telegram_bot_token_secrets missing';
  end if;

  if to_regclass('public.telegram_webhook_secrets') is null then
    raise exception 'public.telegram_webhook_secrets missing';
  end if;

  if to_regclass('public.agent_instances') is null then
    raise exception 'public.agent_instances missing';
  end if;

  if to_regclass('public.workspaces') is null then
    raise exception 'public.workspaces missing';
  end if;

  if to_regprocedure('public.claim_telegram_disconnect_session(uuid,uuid,text)') is not null then
    raise exception 'public.claim_telegram_disconnect_session(uuid,uuid,text) already exists';
  end if;
end;
$$;

create function public.claim_telegram_disconnect_session(
  p_agent_id uuid,
  p_owner_user_id uuid,
  p_action text
) returns table (
  claimed boolean,
  status text,
  telegram_session_id uuid,
  agent_id uuid,
  bot_handle text,
  token_secret_ref text,
  webhook_secret_ref text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_action text;
  v_agent_exists boolean;
  v_owner_matches boolean;
  v_active_count integer;
  v_session_id uuid;
  v_bot_handle text;
  v_token_secret_ref text;
  v_webhook_secret_ref text;
  v_claimed_session_id uuid;
begin
  v_action := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));

  if p_agent_id is null or p_owner_user_id is null then
    return query
      select
        false,
        'invalid_request'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_action not in ('pause', 'disconnect', 'revoke') then
    return query
      select
        false,
        'invalid_action'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('telegram_disconnect_session'),
    pg_catalog.hashtext(p_agent_id::text)
  );

  select exists (
    select 1
    from public.agent_instances agents
    where agents.id = p_agent_id
  )
  into v_agent_exists;

  if not v_agent_exists then
    return query
      select
        false,
        'not_found'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select exists (
    select 1
    from public.agent_instances agents
    join public.workspaces workspaces
      on workspaces.id = agents.workspace_id
    where agents.id = p_agent_id
      and workspaces.owner_user_id = p_owner_user_id
  )
  into v_owner_matches;

  if not v_owner_matches then
    return query
      select
        false,
        'forbidden'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select count(*)
  into v_active_count
  from public.telegram_sessions sessions
  where sessions.agent_id = p_agent_id
    and sessions.webhook_status = 'active';

  if v_active_count = 0 then
    return query
      select
        false,
        'not_found'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_active_count > 1 then
    return query
      select
        false,
        'conflict'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select
    sessions.id,
    sessions.bot_handle,
    pg_catalog.btrim(token_secrets.token_secret_ref),
    pg_catalog.btrim(webhook_secrets.webhook_secret_ref)
  into
    v_session_id,
    v_bot_handle,
    v_token_secret_ref,
    v_webhook_secret_ref
  from public.telegram_sessions sessions
  left join public.telegram_bot_token_secrets token_secrets
    on token_secrets.token_secret_ref = sessions.token_secret_ref
   and token_secrets.agent_id = p_agent_id
   and token_secrets.owner_user_id = p_owner_user_id
   and token_secrets.revoked_at is null
  left join public.telegram_webhook_secrets webhook_secrets
    on webhook_secrets.telegram_session_id = sessions.id
   and webhook_secrets.revoked_at is null
  where sessions.agent_id = p_agent_id
    and sessions.webhook_status = 'active'
  limit 1;

  if v_action in ('disconnect', 'revoke')
    and (
      v_token_secret_ref is null
      or v_token_secret_ref = ''
      or v_webhook_secret_ref is null
      or v_webhook_secret_ref = ''
    )
  then
    return query
      select
        false,
        'missing_secret_ref'::text,
        v_session_id,
        p_agent_id,
        v_bot_handle,
        null::text,
        null::text;
    return;
  end if;

  update public.telegram_sessions sessions
  set webhook_status = 'paused'
  where sessions.id = v_session_id
    and sessions.webhook_status = 'active'
  returning sessions.id
  into v_claimed_session_id;

  if v_claimed_session_id is null then
    return query
      select
        false,
        'not_found'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  return query
    select
      true,
      'claimed'::text,
      v_claimed_session_id,
      p_agent_id,
      v_bot_handle,
      case when v_action in ('disconnect', 'revoke') then v_token_secret_ref else null::text end,
      case when v_action in ('disconnect', 'revoke') then v_webhook_secret_ref else null::text end;
end;
$$;

revoke all on function public.claim_telegram_disconnect_session(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_telegram_disconnect_session(uuid,uuid,text)
  to service_role;

commit;

-- Required immediately after an approved apply:
-- - Run supabase/verify_telegram_disconnect_session_claim_contract.sql.
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before Edge runtime wiring if any required verifier result is false.
