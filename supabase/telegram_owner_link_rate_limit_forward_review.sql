-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5DD forward SQL packet for durable Telegram owner-link rate limits.
-- This file is a local review artifact only. Do not run it in Supabase until
-- the forward, rollback, verifier, target-project baseline, and runtime-gate
-- state are explicitly approved together.
-- Owner-link issue and consume runtime gates must remain disabled.
-- No secrets, tokens, raw challenges, Telegram payloads, challenge rows,
-- authorization rows, processed updates, or limiter rows are included.

begin;

do $$
begin
  if to_regclass('public.telegram_owner_link_challenges') is null then
    raise exception 'public.telegram_owner_link_challenges missing';
  end if;

  if to_regclass('public.telegram_processed_updates') is null then
    raise exception 'public.telegram_processed_updates missing';
  end if;

  if to_regclass('public.telegram_sessions') is null then
    raise exception 'public.telegram_sessions missing';
  end if;

  if to_regclass('public.telegram_chat_authorizations') is null then
    raise exception 'public.telegram_chat_authorizations missing';
  end if;

  if to_regclass('public.agent_instances') is null then
    raise exception 'public.agent_instances missing';
  end if;

  if to_regclass('public.workspaces') is null then
    raise exception 'public.workspaces missing';
  end if;

  if to_regclass('public.telegram_owner_link_consume_rate_limits') is not null then
    raise exception 'public.telegram_owner_link_consume_rate_limits already exists';
  end if;

  if to_regclass('public.telegram_owner_link_challenges_agent_created_at_idx') is not null
    or to_regclass('public.telegram_owner_link_challenges_session_created_at_idx') is not null
    or to_regclass('public.telegram_owner_link_challenges_issuer_created_at_idx') is not null
  then
    raise exception 'Telegram owner-link issue-history index already exists';
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

create index telegram_owner_link_challenges_agent_created_at_idx
  on public.telegram_owner_link_challenges (agent_id, created_at desc);

create index telegram_owner_link_challenges_session_created_at_idx
  on public.telegram_owner_link_challenges (telegram_session_id, created_at desc);

create index telegram_owner_link_challenges_issuer_created_at_idx
  on public.telegram_owner_link_challenges (issued_by_user_id, created_at desc);

create table public.telegram_owner_link_consume_rate_limits (
  id uuid not null default gen_random_uuid(),
  telegram_session_id uuid not null,
  scope text not null,
  telegram_user_id text null,
  window_started_at timestamptz not null,
  attempt_count integer not null,
  blocked_until timestamptz null,
  updated_at timestamptz not null,
  constraint telegram_owner_link_consume_rate_limits_pkey
    primary key (id),
  constraint telegram_owner_link_consume_rate_limits_session_fkey
    foreign key (telegram_session_id)
    references public.telegram_sessions(id)
    on delete cascade,
  constraint telegram_owner_link_consume_rate_limits_scope_check
    check (scope in ('session', 'identity')),
  constraint telegram_owner_link_consume_rate_limits_scope_identity_check
    check (
      (
        scope = 'session'
        and telegram_user_id is null
        and blocked_until is null
      )
      or (
        scope = 'identity'
        and telegram_user_id is not null
        and telegram_user_id ~ '^[1-9][0-9]{0,15}$'
        and (blocked_until is null or attempt_count = 5)
      )
    ),
  constraint telegram_owner_link_consume_rate_limits_attempt_count_check
    check (
      (scope = 'session' and attempt_count between 0 and 30)
      or (scope = 'identity' and attempt_count between 0 and 5)
    ),
  constraint telegram_owner_link_consume_rate_limits_updated_after_window_ch
    check (updated_at >= window_started_at),
  constraint telegram_owner_link_consume_rate_limits_blocked_after_window_ch
    check (blocked_until is null or blocked_until >= window_started_at)
);

create unique index telegram_owner_link_consume_rate_limits_session_key
  on public.telegram_owner_link_consume_rate_limits (telegram_session_id)
  where scope = 'session';

create unique index telegram_owner_link_consume_rate_limits_identity_key
  on public.telegram_owner_link_consume_rate_limits (
    telegram_session_id,
    telegram_user_id
  )
  where scope = 'identity';

alter table public.telegram_owner_link_consume_rate_limits
  enable row level security;

revoke all on public.telegram_owner_link_consume_rate_limits from public;
revoke all on public.telegram_owner_link_consume_rate_limits from anon;
revoke all on public.telegram_owner_link_consume_rate_limits from authenticated;
revoke all on public.telegram_owner_link_consume_rate_limits from service_role;
grant select, insert, update
  on public.telegram_owner_link_consume_rate_limits
  to service_role;

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
  v_agent_issue_count bigint := 0;
  v_session_issue_count bigint := 0;
  v_owner_issue_count bigint := 0;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('telegram_owner_link_issue_owner'),
    pg_catalog.hashtext(p_issued_by_user_id::text)
  );

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

  select count(*)
  into v_agent_issue_count
  from (
    select 1
    from public.telegram_owner_link_challenges challenges
    where challenges.agent_id = p_agent_id
      and challenges.created_at >= v_now - interval '15 minutes'
    limit 3
  ) recent_agent_issues;

  select count(*)
  into v_session_issue_count
  from (
    select 1
    from public.telegram_owner_link_challenges challenges
    where challenges.telegram_session_id = p_telegram_session_id
      and challenges.created_at >= v_now - interval '15 minutes'
    limit 3
  ) recent_session_issues;

  select count(*)
  into v_owner_issue_count
  from (
    select 1
    from public.telegram_owner_link_challenges challenges
    where challenges.issued_by_user_id = p_issued_by_user_id
      and challenges.created_at >= v_now - interval '24 hours'
    limit 20
  ) recent_owner_issues;

  if v_agent_issue_count >= 3
    or v_session_issue_count >= 3
    or v_owner_issue_count >= 20
  then
    return query
    select false as issued, 'rate_limited'::text as status;
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
  v_claimed boolean := false;
  v_eligible boolean := false;
  v_linked boolean := false;
  v_identity_window_started_at timestamptz;
  v_identity_attempt_count integer;
  v_identity_blocked_until timestamptz;
  v_session_window_started_at timestamptz;
  v_session_attempt_count integer;
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
    or p_telegram_user_id !~ '^[1-9][0-9]{0,15}$'
    or p_challenge_hash !~ '^[0-9a-f]{64}$'
  then
    return;
  end if;

  select sessions.agent_id
  into v_agent_id
  from public.telegram_sessions sessions
  where sessions.id = p_telegram_session_id
    and sessions.webhook_status = 'active'
  limit 1;

  if v_agent_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('telegram_owner_link_consume_session'),
    pg_catalog.hashtext(p_telegram_session_id::text)
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('telegram_owner_link_consume_identity'),
    pg_catalog.hashtext(
      p_telegram_session_id::text || ':' || p_telegram_user_id
    )
  );

  select sessions.agent_id
  into v_agent_id
  from public.telegram_sessions sessions
  where sessions.id = p_telegram_session_id
    and sessions.webhook_status = 'active'
  limit 1;

  if v_agent_id is null then
    return;
  end if;

  insert into public.telegram_processed_updates (
    telegram_session_id,
    telegram_update_id
  ) values (
    p_telegram_session_id,
    p_telegram_update_id
  )
  on conflict on constraint telegram_processed_updates_pkey do nothing
  returning true
  into v_claimed;

  if not coalesce(v_claimed, false) then
    return query
    select false as linked, 'duplicate'::text as status;
    return;
  end if;

  select
    limits.window_started_at,
    limits.attempt_count,
    limits.blocked_until
  into
    v_identity_window_started_at,
    v_identity_attempt_count,
    v_identity_blocked_until
  from public.telegram_owner_link_consume_rate_limits limits
  where limits.telegram_session_id = p_telegram_session_id
    and limits.scope = 'identity'
    and limits.telegram_user_id = p_telegram_user_id
  limit 1
  for update;

  if not found then
    insert into public.telegram_owner_link_consume_rate_limits (
      telegram_session_id,
      scope,
      telegram_user_id,
      window_started_at,
      attempt_count,
      blocked_until,
      updated_at
    ) values (
      p_telegram_session_id,
      'identity',
      p_telegram_user_id,
      v_now,
      1,
      null,
      v_now
    );
  elsif v_identity_blocked_until is not null
    and v_identity_blocked_until > v_now
  then
    update public.telegram_owner_link_consume_rate_limits limits
    set updated_at = v_now
    where limits.telegram_session_id = p_telegram_session_id
      and limits.scope = 'identity'
      and limits.telegram_user_id = p_telegram_user_id;
    return;
  elsif v_identity_window_started_at <= v_now - interval '10 minutes' then
    update public.telegram_owner_link_consume_rate_limits limits
    set
      window_started_at = v_now,
      attempt_count = 1,
      blocked_until = null,
      updated_at = v_now
    where limits.telegram_session_id = p_telegram_session_id
      and limits.scope = 'identity'
      and limits.telegram_user_id = p_telegram_user_id;
  elsif v_identity_attempt_count >= 5 then
    update public.telegram_owner_link_consume_rate_limits limits
    set
      blocked_until = v_now + interval '30 minutes',
      updated_at = v_now
    where limits.telegram_session_id = p_telegram_session_id
      and limits.scope = 'identity'
      and limits.telegram_user_id = p_telegram_user_id;
    return;
  else
    update public.telegram_owner_link_consume_rate_limits limits
    set
      attempt_count = limits.attempt_count + 1,
      blocked_until = case
        when limits.attempt_count + 1 >= 5
          then v_now + interval '30 minutes'
        else null
      end,
      updated_at = v_now
    where limits.telegram_session_id = p_telegram_session_id
      and limits.scope = 'identity'
      and limits.telegram_user_id = p_telegram_user_id;
  end if;

  select
    limits.window_started_at,
    limits.attempt_count
  into
    v_session_window_started_at,
    v_session_attempt_count
  from public.telegram_owner_link_consume_rate_limits limits
  where limits.telegram_session_id = p_telegram_session_id
    and limits.scope = 'session'
  limit 1
  for update;

  if not found then
    insert into public.telegram_owner_link_consume_rate_limits (
      telegram_session_id,
      scope,
      telegram_user_id,
      window_started_at,
      attempt_count,
      blocked_until,
      updated_at
    ) values (
      p_telegram_session_id,
      'session',
      null,
      v_now,
      1,
      null,
      v_now
    );
  elsif v_session_window_started_at <= v_now - interval '10 minutes' then
    update public.telegram_owner_link_consume_rate_limits limits
    set
      window_started_at = v_now,
      attempt_count = 1,
      blocked_until = null,
      updated_at = v_now
    where limits.telegram_session_id = p_telegram_session_id
      and limits.scope = 'session';
  elsif v_session_attempt_count >= 30 then
    update public.telegram_owner_link_consume_rate_limits limits
    set updated_at = v_now
    where limits.telegram_session_id = p_telegram_session_id
      and limits.scope = 'session';
    return;
  else
    update public.telegram_owner_link_consume_rate_limits limits
    set
      attempt_count = limits.attempt_count + 1,
      updated_at = v_now
    where limits.telegram_session_id = p_telegram_session_id
      and limits.scope = 'session';
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
      and not exists (
        select 1
        from public.telegram_chat_authorizations authorizations
        where authorizations.agent_id = challenges.agent_id
          and authorizations.revoked_at is null
      )
    for update of challenges
  ),
  consumed_challenge as (
    update public.telegram_owner_link_challenges challenges
    set consumed_at = v_now
    from eligible_challenge
    where challenges.id = eligible_challenge.id
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
    exists(select 1 from inserted_authorization)
  into v_eligible, v_linked;

  if not v_eligible then
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

commit;

-- Required immediately after an approved apply:
-- - Run supabase/verify_telegram_owner_link_rate_limit_contract.sql.
-- - Run supabase/verify_telegram_owner_link_challenge_contract.sql.
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before Edge adapter wiring or gate enablement if any required
--   verifier result is false.
