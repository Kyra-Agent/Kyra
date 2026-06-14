-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 6B rollback SQL packet for prepared action owner-scoped storage.
-- This file is a local review artifact only. Do not run it in Supabase until
-- rollback scope, target project, forward review, verifier expectations, and
-- disabled Base MCP runtime gates are explicitly confirmed together.
-- No secrets, raw provider payloads, raw calldata, wallet addresses, Telegram
-- token refs, API keys, transaction hashes, or prepared-action rows are
-- included.
-- This rollback does not use CASCADE.

begin;

do $$
declare
  existing_prepared_action_rows bigint;
begin
  if to_regclass('public.prepared_actions') is null then
    raise exception 'public.prepared_actions missing';
  end if;

  if to_regclass('public.prepared_action_owner_summaries') is null then
    raise exception 'public.prepared_action_owner_summaries missing';
  end if;

  execute 'select count(*) from public.prepared_actions'
    into existing_prepared_action_rows;

  if existing_prepared_action_rows > 0 then
    raise exception
      'public.prepared_actions contains rows; use a reviewed forward fix instead of rollback.';
  end if;
end;
$$;

revoke all privileges on public.prepared_action_owner_summaries from public;
revoke all privileges on public.prepared_action_owner_summaries from anon;
revoke all privileges on public.prepared_action_owner_summaries from authenticated;
revoke all privileges on public.prepared_action_owner_summaries from service_role;
revoke all privileges on public.prepared_actions from public;
revoke all privileges on public.prepared_actions from anon;
revoke all privileges on public.prepared_actions from authenticated;
revoke all privileges on public.prepared_actions from service_role;

drop view public.prepared_action_owner_summaries;
drop table public.prepared_actions;

commit;
