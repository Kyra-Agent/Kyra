create extension if not exists pgcrypto;
create extension if not exists supabase_vault cascade;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_templates (
  id text primary key,
  name text not null,
  role text not null,
  status text not null check (status in ('mvp', 'advanced', 'coming-soon')),
  summary text not null,
  best_for text not null,
  actions jsonb not null default '[]'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  terminal_seed text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_instances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id text not null references public.agent_templates(id),
  display_name text not null,
  handle text not null,
  public_slug text not null unique,
  status text not null default 'online' check (status in ('online', 'draft', 'paused')),
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  network text not null default 'base' check (network in ('base')),
  telegram_status text not null default 'mocked' check (telegram_status in ('mocked', 'active', 'queued', 'review')),
  base_mcp_status text not null default 'mocked' check (base_mcp_status in ('mocked', 'active', 'queued', 'review')),
  approval_policy_id uuid,
  created_at timestamptz not null default now(),
  last_sync_at timestamptz not null default now()
);

create table if not exists public.wallet_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  wallet_label text not null,
  wallet_address text,
  daily_limit_usdc numeric(18, 6),
  approval_required boolean not null default true,
  allowed_actions jsonb not null default '[]'::jsonb,
  status text not null default 'simulated' check (status in ('active', 'simulated', 'paused')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_instances_approval_policy_id_fkey'
  ) then
    alter table public.agent_instances
      add constraint agent_instances_approval_policy_id_fkey
      foreign key (approval_policy_id)
      references public.wallet_policies(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  scenario_id text,
  title text not null,
  command text not null,
  route text not null,
  risk text not null check (risk in ('normal', 'review', 'read-only')),
  status text not null default 'waiting_wallet' check (
    status in ('waiting_wallet', 'read_only_ready', 'review_required', 'approved', 'rejected')
  ),
  fee_payer text not null default 'connected_wallet' check (fee_payer in ('connected_wallet')),
  requires_wallet boolean not null default true,
  prepared_tx jsonb,
  tx_hash text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agent_instances(id) on delete set null,
  source text not null check (
    source in ('agent_instances', 'telegram_sessions', 'base_mcp_routes', 'approval_requests')
  ),
  level text not null default 'info' check (level in ('info', 'notice', 'warning')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  bot_handle text,
  webhook_status text not null default 'mocked' check (webhook_status in ('mocked', 'queued', 'active', 'paused')),
  token_secret_ref text,
  created_at timestamptz not null default now(),
  last_event_at timestamptz
);

create table if not exists public.telegram_bot_token_secrets (
  token_secret_ref text primary key,
  vault_secret_id uuid not null,
  agent_id uuid not null,
  owner_user_id uuid not null,
  telegram_bot_id text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.telegram_webhook_secrets (
  webhook_secret_ref text not null,
  webhook_secret_hash text not null,
  telegram_session_id uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint telegram_webhook_secrets_pkey
    primary key (webhook_secret_ref),
  constraint telegram_webhook_secrets_session_fkey
    foreign key (telegram_session_id)
    references public.telegram_sessions(id)
    on delete cascade,
  constraint telegram_webhook_secrets_ref_not_blank_check
    check (length(btrim(webhook_secret_ref)) > 0),
  constraint telegram_webhook_secrets_ref_format_check
    check (
      webhook_secret_ref ~
      '^webhook:telegram:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  constraint telegram_webhook_secrets_hash_not_blank_check
    check (length(btrim(webhook_secret_hash)) > 0),
  constraint telegram_webhook_secrets_hash_format_check
    check (webhook_secret_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.telegram_chat_authorizations (
  id uuid not null default gen_random_uuid(),
  agent_id uuid not null,
  telegram_user_id text not null,
  telegram_chat_id text not null,
  role text not null default 'owner',
  command_scope text not null default 'read_only',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint telegram_chat_authorizations_pkey
    primary key (id),
  constraint telegram_chat_authorizations_agent_fkey
    foreign key (agent_id)
    references public.agent_instances(id)
    on delete cascade,
  constraint telegram_chat_authorizations_user_not_blank_check
    check (length(btrim(telegram_user_id)) > 0),
  constraint telegram_chat_authorizations_user_format_check
    check (telegram_user_id ~ '^[1-9][0-9]*$'),
  constraint telegram_chat_authorizations_chat_not_blank_check
    check (length(btrim(telegram_chat_id)) > 0),
  constraint telegram_chat_authorizations_chat_format_check
    check (telegram_chat_id ~ '^-?[1-9][0-9]*$'),
  constraint telegram_chat_authorizations_owner_role_check
    check (role = 'owner'),
  constraint telegram_chat_authorizations_read_only_scope_check
    check (command_scope = 'read_only')
);

create table if not exists public.telegram_processed_updates (
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

create table if not exists public.telegram_owner_link_challenges (
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

create table if not exists public.telegram_owner_link_consume_rate_limits (
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

create index if not exists workspaces_owner_user_id_idx on public.workspaces(owner_user_id);
create unique index if not exists workspaces_owner_demo_unique_idx
on public.workspaces(owner_user_id)
where mode = 'demo';
create index if not exists agent_instances_workspace_id_idx on public.agent_instances(workspace_id);
create index if not exists agent_instances_public_slug_idx on public.agent_instances(public_slug);
create index if not exists wallet_policies_workspace_id_idx on public.wallet_policies(workspace_id);
create index if not exists approval_requests_agent_id_idx on public.approval_requests(agent_id);
create index if not exists activity_logs_agent_id_created_at_idx on public.activity_logs(agent_id, created_at desc);
create unique index if not exists telegram_bot_token_secrets_active_bot_id_key
on public.telegram_bot_token_secrets(telegram_bot_id)
where revoked_at is null;
create unique index if not exists telegram_chat_authorizations_active_agent_key
on public.telegram_chat_authorizations(agent_id)
where revoked_at is null;
create unique index if not exists telegram_webhook_secrets_active_session_key
on public.telegram_webhook_secrets(telegram_session_id)
where revoked_at is null;
create unique index if not exists telegram_webhook_secrets_active_hash_key
on public.telegram_webhook_secrets(webhook_secret_hash)
where revoked_at is null;
create unique index if not exists telegram_owner_link_challenges_active_agent_key
on public.telegram_owner_link_challenges(agent_id)
where consumed_at is null and revoked_at is null;
create unique index if not exists telegram_owner_link_challenges_active_session_key
on public.telegram_owner_link_challenges(telegram_session_id)
where consumed_at is null and revoked_at is null;
create unique index if not exists telegram_owner_link_challenges_active_hash_key
on public.telegram_owner_link_challenges(challenge_hash)
where consumed_at is null and revoked_at is null;
create index if not exists telegram_owner_link_challenges_agent_created_at_idx
on public.telegram_owner_link_challenges(agent_id, created_at desc);
create index if not exists telegram_owner_link_challenges_session_created_at_idx
on public.telegram_owner_link_challenges(telegram_session_id, created_at desc);
create index if not exists telegram_owner_link_challenges_issuer_created_at_idx
on public.telegram_owner_link_challenges(issued_by_user_id, created_at desc);
create unique index if not exists telegram_owner_link_consume_rate_limits_session_key
on public.telegram_owner_link_consume_rate_limits(telegram_session_id)
where scope = 'session';
create unique index if not exists telegram_owner_link_consume_rate_limits_identity_key
on public.telegram_owner_link_consume_rate_limits(telegram_session_id, telegram_user_id)
where scope = 'identity';

create or replace function public.enforce_demo_agent_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mode = 'demo' then
    perform pg_advisory_xact_lock(hashtext(new.workspace_id::text));

    if (
      select count(*)
      from public.agent_instances
      where workspace_id = new.workspace_id
        and mode = 'demo'
    ) >= 3 then
      raise exception 'Demo agent limit reached (3/3).';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_demo_agent_limit_on_insert on public.agent_instances;
create trigger enforce_demo_agent_limit_on_insert
before insert on public.agent_instances
for each row
execute function public.enforce_demo_agent_limit();

create or replace function public.owns_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function public.resolve_telegram_webhook_session(
  p_webhook_secret_hash text
) returns table (
  session_id uuid,
  agent_id uuid,
  workspace_id uuid,
  owner_user_id uuid,
  bot_handle text,
  webhook_status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    sessions.id as session_id,
    sessions.agent_id,
    agents.workspace_id,
    workspaces.owner_user_id,
    sessions.bot_handle,
    sessions.webhook_status
  from public.telegram_webhook_secrets secrets
  join public.telegram_sessions sessions
    on sessions.id = secrets.telegram_session_id
  join public.agent_instances agents
    on agents.id = sessions.agent_id
  join public.workspaces workspaces
    on workspaces.id = agents.workspace_id
  where secrets.webhook_secret_hash = p_webhook_secret_hash
    and secrets.revoked_at is null
    and sessions.webhook_status = 'active'
  limit 2;
$$;

create or replace function public.resolve_telegram_chat_authorization(
  p_agent_id uuid,
  p_telegram_user_id text,
  p_telegram_chat_id text,
  p_command_kind text
) returns table (
  authorized boolean,
  role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    true as authorized,
    authorizations.role
  from public.telegram_chat_authorizations authorizations
  where authorizations.agent_id = p_agent_id
    and authorizations.telegram_user_id = p_telegram_user_id
    and authorizations.telegram_chat_id = p_telegram_chat_id
    and authorizations.role = 'owner'
    and authorizations.command_scope = 'read_only'
    and p_command_kind = 'read_only'
    and authorizations.revoked_at is null
  limit 2;
$$;

create or replace function public.claim_telegram_update(
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

create or replace function public.store_telegram_bot_token(
  p_agent_id uuid,
  p_owner_user_id uuid,
  p_telegram_bot_id text,
  p_bot_token text
) returns text
language plpgsql
security definer
set search_path = pg_catalog, vault, pg_temp
as $$
declare
  v_token_secret_ref text;
  v_vault_secret_id uuid;
begin
  if p_agent_id is null then
    raise exception 'invalid_agent_id' using errcode = '22023';
  end if;

  if p_owner_user_id is null then
    raise exception 'invalid_owner_user_id' using errcode = '22023';
  end if;

  if p_telegram_bot_id is null or btrim(p_telegram_bot_id) = '' then
    raise exception 'invalid_telegram_bot_id' using errcode = '22023';
  end if;

  if p_bot_token is null or btrim(p_bot_token) = '' then
    raise exception 'invalid_bot_token' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.telegram_bot_token_secrets secrets
    where secrets.telegram_bot_id = btrim(p_telegram_bot_id)
      and secrets.revoked_at is null
  ) then
    raise exception 'telegram_bot_already_connected' using errcode = '23505';
  end if;

  v_vault_secret_id := vault.create_secret(
    btrim(p_bot_token),
    null::text,
    'Kyra Telegram BotFather token'
  );
  v_token_secret_ref := 'vault:telegram:' || v_vault_secret_id::text;

  insert into public.telegram_bot_token_secrets (
    token_secret_ref,
    vault_secret_id,
    agent_id,
    owner_user_id,
    telegram_bot_id
  ) values (
    v_token_secret_ref,
    v_vault_secret_id,
    p_agent_id,
    p_owner_user_id,
    btrim(p_telegram_bot_id)
  );

  return v_token_secret_ref;
exception
  when invalid_parameter_value then
    raise;
  when unique_violation then
    raise exception 'telegram_bot_already_connected' using errcode = '23505';
  when others then
    raise exception 'telegram_token_store_failed' using errcode = 'XX000';
end;
$$;

create or replace function public.resolve_telegram_bot_token(
  p_token_secret_ref text
) returns text
language plpgsql
security definer
set search_path = pg_catalog, vault, pg_temp
as $$
declare
  v_vault_secret_id uuid;
  v_bot_token text;
begin
  if p_token_secret_ref is null or btrim(p_token_secret_ref) = '' then
    raise exception 'invalid_token_secret_ref' using errcode = '22023';
  end if;

  select secrets.vault_secret_id
  into v_vault_secret_id
  from public.telegram_bot_token_secrets secrets
  where secrets.token_secret_ref = btrim(p_token_secret_ref)
    and secrets.revoked_at is null;

  if v_vault_secret_id is null then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  select decrypted.decrypted_secret
  into v_bot_token
  from vault.decrypted_secrets decrypted
  where decrypted.id = v_vault_secret_id;

  if v_bot_token is null or btrim(v_bot_token) = '' then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  return v_bot_token;
exception
  when invalid_parameter_value then
    raise;
  when no_data_found then
    raise exception 'secret_not_found' using errcode = 'P0002';
  when others then
    raise exception 'telegram_token_resolve_failed' using errcode = 'XX000';
end;
$$;

create or replace function public.revoke_telegram_bot_token(
  p_token_secret_ref text
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, vault, pg_temp
as $$
declare
  v_vault_secret_id uuid;
begin
  if p_token_secret_ref is null or btrim(p_token_secret_ref) = '' then
    raise exception 'invalid_token_secret_ref' using errcode = '22023';
  end if;

  select secrets.vault_secret_id
  into v_vault_secret_id
  from public.telegram_bot_token_secrets secrets
  where secrets.token_secret_ref = btrim(p_token_secret_ref)
    and secrets.revoked_at is null
  for update;

  if v_vault_secret_id is null then
    return false;
  end if;

  update public.telegram_bot_token_secrets secrets
  set revoked_at = now()
  where secrets.token_secret_ref = btrim(p_token_secret_ref)
    and secrets.revoked_at is null;

  return true;
exception
  when invalid_parameter_value then
    raise;
  when others then
    raise exception 'telegram_token_revoke_failed' using errcode = 'XX000';
end;
$$;

create or replace function public.resolve_telegram_delivery_token(
  p_telegram_session_id uuid
) returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_token_secret_ref text;
  v_bot_token text;
begin
  if p_telegram_session_id is null then
    raise exception 'invalid_telegram_session_id' using errcode = '22023';
  end if;

  select btrim(sessions.token_secret_ref)
  into v_token_secret_ref
  from public.telegram_sessions sessions
  join public.telegram_bot_token_secrets secrets
    on secrets.token_secret_ref = sessions.token_secret_ref
  where sessions.id = p_telegram_session_id
    and sessions.webhook_status = 'active'
    and sessions.token_secret_ref is not null
    and btrim(sessions.token_secret_ref) <> ''
    and secrets.revoked_at is null;

  if v_token_secret_ref is null or v_token_secret_ref = '' then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  v_bot_token := public.resolve_telegram_bot_token(v_token_secret_ref);

  if v_bot_token is null or btrim(v_bot_token) = '' then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  return v_bot_token;
exception
  when invalid_parameter_value then
    raise;
  when no_data_found then
    raise exception 'secret_not_found' using errcode = 'P0002';
  when others then
    raise exception 'telegram_delivery_token_resolve_failed' using errcode = 'XX000';
end;
$$;

create or replace function public.claim_telegram_disconnect_session(
  p_agent_id uuid,
  p_owner_user_id uuid,
  p_action text
) returns table (
  claimed boolean,
  status text,
  telegram_session_id uuid,
  agent_id uuid,
  bot_handle text,
  token_secret_ref text,
  webhook_secret_ref text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_action text;
  v_agent_exists boolean;
  v_owner_matches boolean;
  v_active_count integer;
  v_session_id uuid;
  v_bot_handle text;
  v_token_secret_ref text;
  v_webhook_secret_ref text;
  v_claimed_session_id uuid;
begin
  v_action := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));

  if p_agent_id is null or p_owner_user_id is null then
    return query
      select
        false,
        'invalid_request'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_action not in ('pause', 'disconnect', 'revoke') then
    return query
      select
        false,
        'invalid_action'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('telegram_disconnect_session'),
    pg_catalog.hashtext(p_agent_id::text)
  );

  select exists (
    select 1
    from public.agent_instances agents
    where agents.id = p_agent_id
  )
  into v_agent_exists;

  if not v_agent_exists then
    return query
      select
        false,
        'not_found'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select exists (
    select 1
    from public.agent_instances agents
    join public.workspaces workspaces
      on workspaces.id = agents.workspace_id
    where agents.id = p_agent_id
      and workspaces.owner_user_id = p_owner_user_id
  )
  into v_owner_matches;

  if not v_owner_matches then
    return query
      select
        false,
        'forbidden'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select count(*)
  into v_active_count
  from public.telegram_sessions sessions
  where sessions.agent_id = p_agent_id
    and sessions.webhook_status = 'active';

  if v_active_count = 0 then
    return query
      select
        false,
        'not_found'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_active_count > 1 then
    return query
      select
        false,
        'conflict'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select
    sessions.id,
    sessions.bot_handle,
    pg_catalog.btrim(token_secrets.token_secret_ref),
    pg_catalog.btrim(webhook_secrets.webhook_secret_ref)
  into
    v_session_id,
    v_bot_handle,
    v_token_secret_ref,
    v_webhook_secret_ref
  from public.telegram_sessions sessions
  left join public.telegram_bot_token_secrets token_secrets
    on token_secrets.token_secret_ref = sessions.token_secret_ref
   and token_secrets.agent_id = p_agent_id
   and token_secrets.owner_user_id = p_owner_user_id
   and token_secrets.revoked_at is null
  left join public.telegram_webhook_secrets webhook_secrets
    on webhook_secrets.telegram_session_id = sessions.id
   and webhook_secrets.revoked_at is null
  where sessions.agent_id = p_agent_id
    and sessions.webhook_status = 'active'
  limit 1;

  if v_action in ('disconnect', 'revoke')
    and (
      v_token_secret_ref is null
      or v_token_secret_ref = ''
      or v_webhook_secret_ref is null
      or v_webhook_secret_ref = ''
    )
  then
    return query
      select
        false,
        'missing_secret_ref'::text,
        v_session_id,
        p_agent_id,
        v_bot_handle,
        null::text,
        null::text;
    return;
  end if;

  update public.telegram_sessions sessions
  set webhook_status = 'paused'
  where sessions.id = v_session_id
    and sessions.webhook_status = 'active'
  returning sessions.id
  into v_claimed_session_id;

  if v_claimed_session_id is null then
    return query
      select
        false,
        'not_found'::text,
        null::uuid,
        p_agent_id,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  return query
    select
      true,
      'claimed'::text,
      v_claimed_session_id,
      p_agent_id,
      v_bot_handle,
      case when v_action in ('disconnect', 'revoke') then v_token_secret_ref else null::text end,
      case when v_action in ('disconnect', 'revoke') then v_webhook_secret_ref else null::text end;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.agent_templates enable row level security;
alter table public.agent_instances enable row level security;
alter table public.wallet_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.activity_logs enable row level security;
alter table public.telegram_sessions enable row level security;
alter table public.telegram_bot_token_secrets enable row level security;
alter table public.telegram_webhook_secrets enable row level security;
alter table public.telegram_chat_authorizations enable row level security;
alter table public.telegram_processed_updates enable row level security;
alter table public.telegram_owner_link_challenges enable row level security;
alter table public.telegram_owner_link_consume_rate_limits enable row level security;

drop policy if exists "Templates are public readable" on public.agent_templates;
create policy "Templates are public readable"
on public.agent_templates
for select
using (true);

drop policy if exists "Users can manage their own workspaces" on public.workspaces;
drop policy if exists "Users can read their own workspaces" on public.workspaces;
create policy "Users can read their own workspaces"
on public.workspaces
for select
using (owner_user_id = auth.uid());

drop policy if exists "Workspace owners can manage agent instances" on public.agent_instances;
drop policy if exists "Workspace owners can read agent instances" on public.agent_instances;
create policy "Workspace owners can read agent instances"
on public.agent_instances
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Online demo agent instances are public readable" on public.agent_instances;
create policy "Online demo agent instances are public readable"
on public.agent_instances
for select
using (status = 'online' and mode = 'demo');

drop policy if exists "Workspace owners can manage wallet policies" on public.wallet_policies;
drop policy if exists "Workspace owners can read wallet policies" on public.wallet_policies;
create policy "Workspace owners can read wallet policies"
on public.wallet_policies
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can manage approval requests" on public.approval_requests;
drop policy if exists "Workspace owners can read approval requests" on public.approval_requests;
create policy "Workspace owners can read approval requests"
on public.approval_requests
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can read activity logs" on public.activity_logs;
create policy "Workspace owners can read activity logs"
on public.activity_logs
for select
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can create activity logs" on public.activity_logs;

drop policy if exists "Workspace owners can manage telegram sessions" on public.telegram_sessions;
drop policy if exists "Workspace owners can read telegram sessions" on public.telegram_sessions;
create policy "Workspace owners can read telegram sessions"
on public.telegram_sessions
for select
using (
  exists (
    select 1
    from public.agent_instances agents
    where agents.id = telegram_sessions.agent_id
      and public.owns_workspace(agents.workspace_id)
  )
);

create or replace view public.telegram_session_summaries
with (security_invoker = true)
as
select
  sessions.id,
  sessions.agent_id,
  sessions.bot_handle,
  sessions.webhook_status,
  sessions.created_at,
  sessions.last_event_at
from public.telegram_sessions sessions;

create or replace view public.public_agent_profiles
with (security_invoker = true)
as
select
  agents.public_slug,
  agents.display_name,
  agents.handle,
  agents.status,
  agents.mode,
  agents.network,
  agents.telegram_status,
  agents.base_mcp_status,
  agents.created_at,
  agents.last_sync_at,
  templates.id as template_id,
  templates.name as template_name,
  templates.role as template_role,
  templates.status as template_status,
  templates.summary as template_summary,
  templates.best_for as template_best_for,
  templates.actions as template_actions,
  templates.modules as template_modules
from public.agent_instances agents
join public.agent_templates templates on templates.id = agents.template_id
where agents.status = 'online'
  and agents.mode = 'demo';

grant usage on schema public to anon, authenticated, service_role;
grant select on public.agent_templates to anon, authenticated, service_role;

revoke all privileges on public.workspaces from authenticated;
revoke all privileges on public.agent_instances from authenticated;
revoke all privileges on public.wallet_policies from authenticated;
revoke all privileges on public.approval_requests from authenticated;
revoke all privileges on public.activity_logs from authenticated;
revoke all privileges on public.telegram_sessions from authenticated;
revoke all privileges on public.telegram_bot_token_secrets from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_webhook_secrets from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_chat_authorizations from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_processed_updates from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_owner_link_challenges from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_owner_link_consume_rate_limits from public, anon, authenticated, service_role;
revoke all privileges on public.telegram_session_summaries from anon, authenticated;
revoke all on function public.resolve_telegram_webhook_session(text)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_telegram_chat_authorization(uuid,text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_telegram_update(uuid,bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.store_telegram_bot_token(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_telegram_bot_token(text)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_telegram_bot_token(text)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_telegram_delivery_token(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_telegram_disconnect_session(uuid,uuid,text)
  from public, anon, authenticated, service_role;

grant select on public.workspaces to authenticated;
grant select (
  public_slug,
  display_name,
  handle,
  status,
  mode,
  network,
  telegram_status,
  base_mcp_status,
  created_at,
  last_sync_at,
  template_id
) on public.agent_instances to anon, authenticated;
grant select on public.agent_instances to authenticated;
grant select on public.wallet_policies to authenticated;
grant select on public.approval_requests to authenticated;
grant select on public.activity_logs to authenticated;
grant select (
  id,
  agent_id,
  bot_handle,
  webhook_status,
  created_at,
  last_event_at
) on public.telegram_sessions to authenticated;
grant select on public.telegram_session_summaries to authenticated;
grant select on public.public_agent_profiles to anon, authenticated;
grant execute on function public.owns_workspace(uuid) to authenticated;

grant all on public.workspaces to service_role;
grant all on public.agent_instances to service_role;
grant all on public.wallet_policies to service_role;
grant all on public.approval_requests to service_role;
grant all on public.activity_logs to service_role;
grant all on public.telegram_sessions to service_role;
grant select, insert, update on public.telegram_bot_token_secrets to service_role;
grant select, insert, update on public.telegram_webhook_secrets to service_role;
grant select, insert, update on public.telegram_chat_authorizations to service_role;
grant select, insert on public.telegram_processed_updates to service_role;
grant select, insert, update on public.telegram_owner_link_challenges to service_role;
grant select, insert, update on public.telegram_owner_link_consume_rate_limits to service_role;
grant select on public.telegram_session_summaries to service_role;
grant select on public.public_agent_profiles to service_role;
grant execute on function public.owns_workspace(uuid) to service_role;
grant execute on function public.resolve_telegram_webhook_session(text)
  to service_role;
grant execute on function public.resolve_telegram_chat_authorization(uuid,text,text,text)
  to service_role;
grant execute on function public.claim_telegram_update(uuid,bigint)
  to service_role;
grant execute on function public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)
  to service_role;
grant execute on function public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)
  to service_role;
grant execute on function public.store_telegram_bot_token(uuid, uuid, text, text)
  to service_role;
grant execute on function public.resolve_telegram_bot_token(text)
  to service_role;
grant execute on function public.revoke_telegram_bot_token(text)
  to service_role;
grant execute on function public.resolve_telegram_delivery_token(uuid)
  to service_role;
grant execute on function public.claim_telegram_disconnect_session(uuid,uuid,text)
  to service_role;
