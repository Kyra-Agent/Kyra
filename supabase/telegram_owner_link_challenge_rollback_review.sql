-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5CS rollback SQL packet for future Telegram owner-link challenges.
-- This file is a local review artifact only. Do not run it in Supabase until
-- rollback scope, target project, forward review, and verifier expectations
-- are explicitly approved.
-- All Telegram owner-link runtime gates must remain disabled before and
-- during rollback.
-- No secrets, tokens, environment values, payloads, raw challenges, or
-- authorization rows are included in this file.

-- Scope
-- - Drops public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz).
-- - Drops public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text).
-- - Drops public.telegram_owner_link_challenges only if it contains no rows.
-- - Does not drop telegram_chat_authorizations or telegram_processed_updates.
-- - Does not modify schema.sql.
-- - Does not use CASCADE.

begin;

do $$
declare
  existing_rows bigint;
begin
  if to_regclass('public.telegram_owner_link_challenges') is not null then
    execute 'select count(*) from public.telegram_owner_link_challenges'
      into existing_rows;

    if existing_rows > 0 then
      raise exception
        'public.telegram_owner_link_challenges contains rows; use a reviewed forward fix instead of rollback.';
    end if;
  end if;
end;
$$;

revoke all on function
  public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)
  from public, anon, authenticated, service_role;
drop function
  public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text);

revoke all on function
  public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
drop function
  public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz);

revoke all on public.telegram_owner_link_challenges from public;
revoke all on public.telegram_owner_link_challenges from anon;
revoke all on public.telegram_owner_link_challenges from authenticated;
revoke all on public.telegram_owner_link_challenges from service_role;
drop table public.telegram_owner_link_challenges;

commit;

-- Required immediately after an approved rollback:
-- - Run supabase/verify_telegram_owner_link_challenge_contract.sql.
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Confirm owner-link challenge object-existence checks return false.
