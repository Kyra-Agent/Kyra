-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5BE.2 forward SQL packet for future atomic Telegram update claims.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, rollback review, and
-- verifier expectations are explicitly approved together.
-- All Telegram webhook runtime and claim adapter gates must remain disabled
-- until a separate runtime wiring approval.
-- No secrets, tokens, environment values, payloads, or claim rows are included.

-- Scope
-- - Creates public.telegram_processed_updates.
-- - Creates public.claim_telegram_update(uuid,bigint).
-- - Implements only active-session atomic claim and duplicate detection.
-- - Does not create webhook receiver or chat authorization objects.
-- - Does not add retention or delivery-status behavior.
-- - Does not modify schema.sql.

begin;

do $$
begin
  if to_regclass('public.telegram_processed_updates') is not null then
    raise exception 'public.telegram_processed_updates already exists';
  end if;

  if to_regprocedure('public.claim_telegram_update(uuid,bigint)') is not null then
    raise exception 'public.claim_telegram_update(uuid,bigint) already exists';
  end if;
end;
$$;

create table public.telegram_processed_updates (
  telegram_session_id uuid not null,
  telegram_update_id bigint not null,
  created_at timestamptz not null default now(),
  constraint telegram_processed_updates_pkey
    primary key (telegram_session_id, telegram_update_id),
  constraint telegram_processed_updates_session_fkey
    foreign key (telegram_session_id)
    references public.telegram_sessions(id)
    on delete cascade,
  constraint telegram_processed_updates_id_nonnegative_check
    check (telegram_update_id >= 0)
);

alter table public.telegram_processed_updates enable row level security;

revoke all on public.telegram_processed_updates from public;
revoke all on public.telegram_processed_updates from anon;
revoke all on public.telegram_processed_updates from authenticated;
revoke all on public.telegram_processed_updates from service_role;
grant select, insert on public.telegram_processed_updates to service_role;

create function public.claim_telegram_update(
  p_telegram_session_id uuid,
  p_telegram_update_id bigint
) returns table (
  claimed boolean,
  status text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  with eligible_session as (
    select sessions.id
    from public.telegram_sessions sessions
    where sessions.id = p_telegram_session_id
      and sessions.webhook_status = 'active'
      and p_telegram_update_id >= 0
  ),
  inserted as (
    insert into public.telegram_processed_updates (
      telegram_session_id,
      telegram_update_id
    )
    select
      eligible_session.id,
      p_telegram_update_id
    from eligible_session
    on conflict on constraint telegram_processed_updates_pkey do nothing
    returning true
  )
  select
    exists(select 1 from inserted) as claimed,
    case
      when exists(select 1 from inserted) then 'claimed'
      else 'duplicate'
    end as status
  from eligible_session;
$$;

revoke all on function public.claim_telegram_update(uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_telegram_update(uuid,bigint)
  to service_role;

commit;

-- Required immediately after an approved apply:
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before claim adapter or webhook runtime wiring if any required atomic
--   update claim verifier result is false.
