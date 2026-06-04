-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5BE.1 rollback SQL packet for future Telegram chat authorization.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, forward review, and
-- rollback expectations are explicitly approved together.
-- All Telegram runtime gates must remain disabled before and during rollback.
-- No secrets, tokens, or environment values are included in this file.

-- Scope
-- - Drops public.resolve_telegram_chat_authorization(uuid,text,text,text).
-- - Drops public.telegram_chat_authorizations only if it contains no rows.
-- - Does not drop webhook receiver or update-claim objects.
-- - Does not modify schema.sql.
-- - Does not use CASCADE.

begin;

do $$
declare
  existing_rows bigint;
begin
  if to_regclass('public.telegram_chat_authorizations') is not null then
    execute 'select count(*) from public.telegram_chat_authorizations'
      into existing_rows;

    if existing_rows > 0 then
      raise exception
        'public.telegram_chat_authorizations contains rows; use a reviewed forward fix instead of rollback.';
    end if;
  end if;
end;
$$;

revoke all on function
  public.resolve_telegram_chat_authorization(uuid,text,text,text)
  from public, anon, authenticated, service_role;
drop function
  public.resolve_telegram_chat_authorization(uuid,text,text,text);

revoke all on public.telegram_chat_authorizations from public;
revoke all on public.telegram_chat_authorizations from anon;
revoke all on public.telegram_chat_authorizations from authenticated;
revoke all on public.telegram_chat_authorizations from service_role;
drop table public.telegram_chat_authorizations;

commit;

-- Required immediately after an approved rollback:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Confirm chat authorization object-existence checks return false.
