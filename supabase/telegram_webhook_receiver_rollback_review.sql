-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5AR.1 rollback SQL packet for future Telegram webhook receiver lookup.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, forward review, and
-- rollback expectations are explicitly approved together.
-- Runtime gates must remain disabled until a separate runtime wiring approval.
-- No secrets, tokens, or environment values are included in this file.

-- Scope
-- - Drops public.resolve_telegram_webhook_session(text).
-- - Drops public.telegram_webhook_secrets only if it contains no rows.
-- - Does not drop chat authorization tables or command processing objects.
-- - Does not modify schema.sql.
-- - Does not create, read, or store raw BotFather tokens or raw webhook secrets.

begin;

do $$
declare
  existing_rows bigint;
begin
  if to_regclass('public.telegram_webhook_secrets') is not null then
    execute 'select count(*) from public.telegram_webhook_secrets'
      into existing_rows;

    if existing_rows > 0 then
      raise exception
        'public.telegram_webhook_secrets contains rows; use a reviewed forward fix instead of rollback.';
    end if;
  end if;
end;
$$;

revoke all on function public.resolve_telegram_webhook_session(text)
  from public, anon, authenticated, service_role;
drop function public.resolve_telegram_webhook_session(text);

revoke all on public.telegram_webhook_secrets from public;
revoke all on public.telegram_webhook_secrets from anon;
revoke all on public.telegram_webhook_secrets from authenticated;
revoke all on public.telegram_webhook_secrets from service_role;
drop table public.telegram_webhook_secrets;

commit;

-- Required immediately after approved rollback:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before runtime wiring if any required webhook receiver result is false.
