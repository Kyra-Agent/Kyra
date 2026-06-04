-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5BE.2 rollback SQL packet for future atomic Telegram update claims.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, forward review, and
-- rollback expectations are explicitly approved together.
-- All Telegram webhook runtime and claim adapter gates must remain disabled
-- before and during rollback.
-- No secrets, tokens, or environment values are included in this file.

-- Scope
-- - Drops public.claim_telegram_update(uuid,bigint).
-- - Drops public.telegram_processed_updates only if it contains no rows.
-- - Does not drop webhook receiver or chat authorization objects.
-- - Does not modify schema.sql.
-- - Does not use CASCADE.

begin;

do $$
declare
  existing_rows bigint;
begin
  if to_regclass('public.telegram_processed_updates') is not null then
    execute 'select count(*) from public.telegram_processed_updates'
      into existing_rows;

    if existing_rows > 0 then
      raise exception
        'public.telegram_processed_updates contains rows; use a reviewed forward fix instead of rollback.';
    end if;
  end if;
end;
$$;

revoke all on function public.claim_telegram_update(uuid,bigint)
  from public, anon, authenticated, service_role;
drop function public.claim_telegram_update(uuid,bigint);

revoke all on public.telegram_processed_updates from public;
revoke all on public.telegram_processed_updates from anon;
revoke all on public.telegram_processed_updates from authenticated;
revoke all on public.telegram_processed_updates from service_role;
drop table public.telegram_processed_updates;

commit;

-- Required immediately after an approved rollback:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Confirm atomic update claim object-existence checks return false.
