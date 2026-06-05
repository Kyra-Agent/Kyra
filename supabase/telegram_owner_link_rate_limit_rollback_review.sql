-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5DD rollback SQL packet for durable Telegram owner-link rate limits.
-- This file is a local review artifact only. Do not run it in Supabase until
-- rollback scope, target project, forward review, verifier expectations, and
-- disabled owner-link runtime gates are explicitly confirmed together.
-- No secrets, tokens, payloads, raw challenges, challenge rows,
-- authorization rows, processed updates, or limiter rows are included.
-- This rollback does not use CASCADE.

begin;

do $$
declare
  existing_limiter_rows bigint;
begin
  if to_regclass('public.telegram_owner_link_consume_rate_limits') is null then
    raise exception 'public.telegram_owner_link_consume_rate_limits missing';
  end if;

  execute 'select count(*) from public.telegram_owner_link_consume_rate_limits'
    into existing_limiter_rows;

  if existing_limiter_rows > 0 then
    raise exception
      'public.telegram_owner_link_consume_rate_limits contains rows; use a reviewed forward fix instead of rollback.';
  end if;

  if to_regclass('public.telegram_owner_link_challenges_agent_created_at_idx') is null
    or to_regclass('public.telegram_owner_link_challenges_session_created_at_idx') is null
    or to_regclass('public.telegram_owner_link_challenges_issuer_created_at_idx') is null
  then
    raise exception 'Telegram owner-link issue-history index missing';
  end if;

  if to_regprocedure(
    'public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)'
  ) is null then
    raise exception 'public.issue_telegram_owner_link_challenge missing';
  end if;

  if to_regprocedure(
    'public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)'
  ) is null then
    raise exception 'public.consume_telegram_owner_link_challenge missing';
  end if;
end;
$$;

create or replace function public.issue_telegram_owner_link_challenge(
  p_agent_id uuid,
  p_telegram_session_id uuid,
  p_issued_by_user_id uuid,
  p_challenge_hash text,
  p_expires_at timestamptz
) returns table (
  issued boolean,
  status text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_agent_id uuid;
begin
  if p_agent_id is null
    or p_telegram_session_id is null
    or p_issued_by_user_id is null
    or p_challenge_hash is null
    or p_expires_at is null
  then
    return;
  end if;

  if p_challenge_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  if p_expires_at <= v_now
    or p_expires_at > v_now + interval '10 minutes'
  then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('telegram_owner_link_challenge'),
    pg_catalog.hashtext(p_agent_id::text)
  );

  select agents.id
  into v_agent_id
  from public.agent_instances agents
  join public.workspaces workspaces
    on workspaces.id = agents.workspace_id
  join public.telegram_sessions sessions
    on sessions.agent_id = agents.id
  where agents.id = p_agent_id
    and sessions.id = p_telegram_session_id
    and sessions.webhook_status = 'active'
    and workspaces.owner_user_id = p_issued_by_user_id
    and not exists (
      select 1
      from public.telegram_chat_authorizations authorizations
      where authorizations.agent_id = agents.id
        and authorizations.revoked_at is null
    )
  limit 1;

  if v_agent_id is null then
    return;
  end if;

  update public.telegram_owner_link_challenges challenges
  set revoked_at = v_now
  where (
      challenges.agent_id = p_agent_id
      or challenges.telegram_session_id = p_telegram_session_id
    )
    and challenges.consumed_at is null
    and challenges.revoked_at is null;

  insert into public.telegram_owner_link_challenges (
    agent_id,
    telegram_session_id,
    issued_by_user_id,
    challenge_hash,
    expires_at,
    created_at
  ) values (
    p_agent_id,
    p_telegram_session_id,
    p_issued_by_user_id,
    p_challenge_hash,
    p_expires_at,
    v_now
  );

  return query
  select true as issued, 'issued'::text as status;
end;
$$;

create or replace function public.consume_telegram_owner_link_challenge(
  p_telegram_session_id uuid,
  p_telegram_update_id bigint,
  p_telegram_user_id text,
  p_telegram_chat_id text,
  p_challenge_hash text
) returns table (
  linked boolean,
  status text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_agent_id uuid;
  v_eligible boolean := false;
  v_claimed boolean := false;
  v_linked boolean := false;
begin
  if p_telegram_session_id is null
    or p_telegram_update_id is null
    or p_telegram_user_id is null
    or p_telegram_chat_id is null
    or p_challenge_hash is null
  then
    return;
  end if;

  if p_telegram_update_id < 0
    or p_telegram_user_id <> p_telegram_chat_id
    or p_telegram_user_id !~ '^[1-9][0-9]*$'
    or p_challenge_hash !~ '^[0-9a-f]{64}$'
  then
    return;
  end if;

  select challenges.agent_id
  into v_agent_id
  from public.telegram_owner_link_challenges challenges
  join public.telegram_sessions sessions
    on sessions.id = challenges.telegram_session_id
  join public.agent_instances agents
    on agents.id = challenges.agent_id
  join public.workspaces workspaces
    on workspaces.id = agents.workspace_id
  where challenges.telegram_session_id = p_telegram_session_id
    and sessions.agent_id = challenges.agent_id
    and challenges.challenge_hash = p_challenge_hash
    and challenges.consumed_at is null
    and challenges.revoked_at is null
    and challenges.expires_at > pg_catalog.now()
    and sessions.webhook_status = 'active'
    and workspaces.owner_user_id = challenges.issued_by_user_id
    and not exists (
      select 1
      from public.telegram_chat_authorizations authorizations
      where authorizations.agent_id = challenges.agent_id
        and authorizations.revoked_at is null
    )
  limit 1;

  if v_agent_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('telegram_owner_link_challenge'),
    pg_catalog.hashtext(v_agent_id::text)
  );

  with eligible_challenge as (
    select
      challenges.id,
      challenges.agent_id
    from public.telegram_owner_link_challenges challenges
    join public.telegram_sessions sessions
      on sessions.id = challenges.telegram_session_id
    join public.agent_instances agents
      on agents.id = challenges.agent_id
    join public.workspaces workspaces
      on workspaces.id = agents.workspace_id
    where challenges.agent_id = v_agent_id
      and challenges.telegram_session_id = p_telegram_session_id
      and sessions.agent_id = challenges.agent_id
      and challenges.challenge_hash = p_challenge_hash
      and challenges.consumed_at is null
      and challenges.revoked_at is null
      and challenges.expires_at > pg_catalog.now()
      and sessions.webhook_status = 'active'
      and workspaces.owner_user_id = challenges.issued_by_user_id
      and p_telegram_user_id = p_telegram_chat_id
      and p_telegram_update_id >= 0
      and not exists (
        select 1
        from public.telegram_chat_authorizations authorizations
        where authorizations.agent_id = challenges.agent_id
          and authorizations.revoked_at is null
      )
    for update of challenges
  ),
  inserted_update as (
    insert into public.telegram_processed_updates (
      telegram_session_id,
      telegram_update_id
    )
    select
      p_telegram_session_id,
      p_telegram_update_id
    from eligible_challenge
    on conflict on constraint telegram_processed_updates_pkey do nothing
    returning true
  ),
  consumed_challenge as (
    update public.telegram_owner_link_challenges challenges
    set consumed_at = v_now
    from eligible_challenge
    where challenges.id = eligible_challenge.id
      and exists(select 1 from inserted_update)
      and challenges.consumed_at is null
      and challenges.revoked_at is null
    returning challenges.agent_id
  ),
  inserted_authorization as (
    insert into public.telegram_chat_authorizations (
      agent_id,
      telegram_user_id,
      telegram_chat_id,
      role,
      command_scope,
      created_at
    )
    select
      consumed_challenge.agent_id,
      p_telegram_user_id,
      p_telegram_chat_id,
      'owner',
      'read_only',
      v_now
    from consumed_challenge
    returning true
  )
  select
    exists(select 1 from eligible_challenge),
    exists(select 1 from inserted_update),
    exists(select 1 from inserted_authorization)
  into v_eligible, v_claimed, v_linked;

  if not v_eligible then
    return;
  end if;

  if not v_claimed then
    return query
    select false as linked, 'duplicate'::text as status;
    return;
  end if;

  if not v_linked then
    raise exception 'telegram_owner_link_consume_failed'
      using errcode = 'XX000';
  end if;

  return query
  select true as linked, 'linked'::text as status;
end;
$$;

revoke all on function
  public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function
  public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)
  to service_role;

revoke all on function
  public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)
  to service_role;

drop index public.telegram_owner_link_challenges_agent_created_at_idx;
drop index public.telegram_owner_link_challenges_session_created_at_idx;
drop index public.telegram_owner_link_challenges_issuer_created_at_idx;

revoke all on public.telegram_owner_link_consume_rate_limits from public;
revoke all on public.telegram_owner_link_consume_rate_limits from anon;
revoke all on public.telegram_owner_link_consume_rate_limits from authenticated;
revoke all on public.telegram_owner_link_consume_rate_limits from service_role;
drop table public.telegram_owner_link_consume_rate_limits;

commit;

-- Required immediately after an approved rollback:
-- - Run supabase/verify_telegram_owner_link_rate_limit_contract.sql.
-- - Run supabase/verify_telegram_owner_link_challenge_contract.sql.
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Confirm rate-limit object-existence checks return false.
