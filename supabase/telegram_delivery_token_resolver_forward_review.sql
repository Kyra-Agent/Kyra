-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5CF.1 forward SQL packet for future Telegram delivery token resolution.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, rollback review, and
-- verifier expectations are explicitly approved together.
-- All Telegram runtime gates must remain disabled until a separate runtime
-- wiring approval.
-- No secrets, tokens, environment values, payloads, or session rows are
-- included.

-- Scope
-- - Creates public.resolve_telegram_delivery_token(uuid).
-- - Resolves an active Telegram session to its backend-only token_secret_ref.
-- - Uses public.resolve_telegram_bot_token(text) inside the trusted boundary.
-- - Does not expose token_secret_ref to browser roles, public views, or webhook
--   session lookup payloads.
-- - Does not modify schema.sql.

begin;

do $$
begin
  if to_regclass('public.telegram_sessions') is null then
    raise exception 'public.telegram_sessions missing';
  end if;

  if to_regclass('public.telegram_bot_token_secrets') is null then
    raise exception 'public.telegram_bot_token_secrets missing';
  end if;

  if to_regprocedure('public.resolve_telegram_bot_token(text)') is null then
    raise exception 'public.resolve_telegram_bot_token(text) missing';
  end if;

  if to_regprocedure('public.resolve_telegram_delivery_token(uuid)') is not null then
    raise exception 'public.resolve_telegram_delivery_token(uuid) already exists';
  end if;
end;
$$;

create function public.resolve_telegram_delivery_token(
  p_telegram_session_id uuid
) returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_token_secret_ref text;
  v_bot_token text;
begin
  if p_telegram_session_id is null then
    raise exception 'invalid_telegram_session_id' using errcode = '22023';
  end if;

  select btrim(sessions.token_secret_ref)
  into v_token_secret_ref
  from public.telegram_sessions sessions
  join public.telegram_bot_token_secrets secrets
    on secrets.token_secret_ref = sessions.token_secret_ref
  where sessions.id = p_telegram_session_id
    and sessions.webhook_status = 'active'
    and sessions.token_secret_ref is not null
    and btrim(sessions.token_secret_ref) <> ''
    and secrets.revoked_at is null;

  if v_token_secret_ref is null or v_token_secret_ref = '' then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  v_bot_token := public.resolve_telegram_bot_token(v_token_secret_ref);

  if v_bot_token is null or btrim(v_bot_token) = '' then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  return v_bot_token;
exception
  when invalid_parameter_value then
    raise;
  when no_data_found then
    raise exception 'secret_not_found' using errcode = 'P0002';
  when others then
    raise exception 'telegram_delivery_token_resolve_failed' using errcode = 'XX000';
end;
$$;

revoke all on function public.resolve_telegram_delivery_token(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_telegram_delivery_token(uuid)
  to service_role;

commit;

-- Required immediately after an approved apply:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before delivery gate enablement if any required delivery token
--   resolver verifier result is false.
