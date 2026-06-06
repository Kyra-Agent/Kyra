-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5DI.5 rollback SQL packet for the Telegram disconnect session claim
-- RPC. This file is a local review artifact only.
-- Do not run it in Supabase until rollback timing and target project are
-- explicitly approved.

begin;

do $$
begin
  if to_regprocedure('public.claim_telegram_disconnect_session(uuid,uuid,text)') is null then
    raise exception 'public.claim_telegram_disconnect_session(uuid,uuid,text) missing';
  end if;
end;
$$;

revoke all on function public.claim_telegram_disconnect_session(uuid,uuid,text)
  from public, anon, authenticated, service_role;
drop function public.claim_telegram_disconnect_session(uuid,uuid,text);

commit;

-- Required immediately after an approved rollback:
-- - Run supabase/verify_telegram_disconnect_session_claim_contract.sql.
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Confirm only the disconnect claim RPC was removed.
