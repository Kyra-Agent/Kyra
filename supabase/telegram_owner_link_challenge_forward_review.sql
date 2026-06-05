-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5CS forward SQL packet for future Telegram owner-link challenges.
-- This file is a local review artifact only. Do not run it in Supabase until
-- schema/RLS/grant approval, target-project baseline, rollback review, and
-- verifier expectations are explicitly approved together.
-- All Telegram owner-link runtime gates must remain disabled until a separate
-- runtime wiring approval.
-- No secrets, tokens, raw challenges, Telegram payloads, environment values,
-- challenge rows, or authorization rows are included.

-- Scope
-- - Creates public.telegram_owner_link_challenges.
-- - Creates public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz).
-- - Creates public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text).
-- - Supports only short-lived personal owner linking for an active Telegram
--   session and exact private Telegram user/chat identity.
-- - Stores only challenge_hash, never the raw challenge.
-- - Does not modify schema.sql.

begin;

do $$
begin
  if to_regclass('public.agent_instances') is null then
    raise exception 'public.agent_instances missing';
  end if;

  if to_regclass('public.workspaces') is null then
    raise exception 'public.workspaces missing';
  end if;

  if to_regclass('public.telegram_sessions') is null then
    raise exception 'public.telegram_sessions missing';
  end if;

  if to_regclass('public.telegram_chat_authorizations') is null then
    raise exception 'public.telegram_chat_authorizations missing';
  end if;

  if to_regclass('public.telegram_processed_updates') is null then
    raise exception 'public.telegram_processed_updates missing';
  end if;

  if to_regclass('public.telegram_owner_link_challenges') is not null then
    raise exception 'public.telegram_owner_link_challenges already exists';
  end if;

  if to_regprocedure(
    'public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)'
  ) is not null then
    raise exception
      'public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz) already exists';
  end if;

  if to_regprocedure(
    'public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)'
  ) is not null then
    raise exception
      'public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text) already exists';
  end if;
end;
$$;

create table public.telegram_owner_link_challenges (
  id uuid not null default gen_random_uuid(),
  agent_id uuid not null,
  telegram_session_id uuid not null,
  issued_by_user_id uuid not null,
  challenge_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz null,
  revoked_at timestamptz null,
  constraint telegram_owner_link_challenges_pkey
    primary key (id),
  constraint telegram_owner_link_challenges_agent_fkey
    foreign key (agent_id)
    references public.agent_instances(id)
    on delete cascade,
  constraint telegram_owner_link_challenges_session_fkey
    foreign key (telegram_session_id)
    references public.telegram_sessions(id)
    on delete cascade,
  constraint telegram_owner_link_challenges_issuer_fkey
    foreign key (issued_by_user_id)
    references auth.users(id)
    on delete cascade,
  constraint telegram_owner_link_challenges_hash_not_blank_check
    check (length(btrim(challenge_hash)) > 0),
  constraint telegram_owner_link_challenges_hash_format_check
    check (challenge_hash ~ '^[0-9a-f]{64}$'),
  constraint telegram_owner_link_challenges_expiry_after_creation_check
    check (expires_at > created_at),
  constraint telegram_owner_link_challenges_consumed_after_creation_check
    check (consumed_at is null or consumed_at >= created_at),
  constraint telegram_owner_link_challenges_revoked_after_creation_check
    check (revoked_at is null or revoked_at >= created_at)
);

create unique index telegram_owner_link_challenges_active_agent_key
  on public.telegram_owner_link_challenges (agent_id)
  where consumed_at is null and revoked_at is null;

create unique index telegram_owner_link_challenges_active_session_key
  on public.telegram_owner_link_challenges (telegram_session_id)
  where consumed_at is null and revoked_at is null;

create unique index telegram_owner_link_challenges_active_hash_key
  on public.telegram_owner_link_challenges (challenge_hash)
  where consumed_at is null and revoked_at is null;

alter table public.telegram_owner_link_challenges enable row level security;

revoke all on public.telegram_owner_link_challenges from public;
revoke all on public.telegram_owner_link_challenges from anon;
revoke all on public.telegram_owner_link_challenges from authenticated;
revoke all on public.telegram_owner_link_challenges from service_role;
grant select, insert, update on public.telegram_owner_link_challenges
  to service_role;

create function public.issue_telegram_owner_link_challenge(
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

create function public.consume_telegram_owner_link_challenge(
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

commit;

-- Required immediately after an approved apply:
-- - Run supabase/verify_telegram_owner_link_challenge_contract.sql.
-- - Run supabase/verify_authenticated_demo_write_lockdown.sql.
-- - Stop before owner-link runtime wiring if any required verifier result is
--   false.
