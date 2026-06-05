-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5CF.1 rollback SQL packet for Telegram delivery token resolution.
-- This file is a local review artifact only. Do not run it in Supabase until
-- rollback scope, target project, and verifier expectations are explicitly
-- approved.
-- No secrets, tokens, environment values, payloads, or session rows are
-- included.

begin;

drop function if exists public.resolve_telegram_delivery_token(uuid);

commit;

-- Required immediately after an approved rollback:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Confirm only the delivery token resolver object was removed.
-- - Keep Telegram runtime delivery disabled.
