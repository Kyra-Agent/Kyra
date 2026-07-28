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
  network text not null default 'robinhood_mainnet' check (
    network in ('robinhood_mainnet', 'robinhood_testnet')
  ),
  chain_action_status text not null default 'disabled' check (
    chain_action_status in ('disabled', 'ready', 'active', 'paused')
  ),
  telegram_status text not null default 'mocked' check (telegram_status in ('mocked', 'active', 'queued', 'review')),
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
  chain_key text not null default 'robinhood_mainnet' check (
    chain_key in ('robinhood_mainnet', 'robinhood_testnet')
  ),
  chain_id bigint not null default 4663 check (
    (chain_key = 'robinhood_mainnet' and chain_id = 4663)
    or (chain_key = 'robinhood_testnet' and chain_id = 46630)
  ),
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
  chain_key text not null default 'robinhood_mainnet' check (
    chain_key in ('robinhood_mainnet', 'robinhood_testnet')
  ),
  chain_id bigint not null default 4663 check (
    (chain_key = 'robinhood_mainnet' and chain_id = 4663)
    or (chain_key = 'robinhood_testnet' and chain_id = 46630)
  ),
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

create table if not exists public.prepared_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  request_id text not null,
  action_kind text not null check (
    action_kind in ('chain_status_check', 'robinhood_reviewed_transaction')
  ),
  chain_key text not null check (
    chain_key in ('robinhood_mainnet', 'robinhood_testnet')
  ),
  chain_id bigint not null check (
    (chain_key = 'robinhood_mainnet' and chain_id = 4663)
    or (chain_key = 'robinhood_testnet' and chain_id = 46630)
  ),
  status text not null check (
    status in (
      'preview_ready', 'review_required', 'approved',
      'rejected', 'expired', 'failed'
    )
  ),
  risk text not null check (risk in ('read-only', 'review', 'blocked')),
  route_summary text not null check (
    char_length(btrim(route_summary)) between 1 and 160
  ),
  value_summary text not null check (
    char_length(btrim(value_summary)) between 1 and 160
  ),
  approval_requirement text not null check (
    char_length(btrim(approval_requirement)) between 1 and 200
  ),
  safety_note text not null check (
    char_length(btrim(safety_note)) between 1 and 200
  ),
  provider text not null check (provider in ('chain_rpc', 'owner_dashboard')),
  recipient text,
  value_wei text,
  calldata text,
  policy_version smallint not null default 2,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint prepared_actions_request_unique
    unique (workspace_id, agent_id, request_id),
  constraint prepared_actions_request_id_format_check
    check (request_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'),
  constraint prepared_actions_expiry_after_creation_check
    check (expires_at is null or expires_at > created_at),
  constraint prepared_actions_updated_after_creation_check
    check (updated_at >= created_at),
  constraint prepared_actions_resolved_after_creation_check
    check (resolved_at is null or resolved_at >= created_at),
  constraint prepared_actions_transaction_shape_check check (
    (
      action_kind = 'chain_status_check'
      and provider = 'chain_rpc'
      and risk = 'read-only'
      and recipient is null
      and value_wei is null
      and calldata is null
      and policy_version in (1, 2)
    )
    or (
      action_kind = 'robinhood_reviewed_transaction'
      and chain_key = 'robinhood_mainnet'
      and chain_id = 4663
      and status = 'approved'
      and risk = 'review'
      and provider = 'owner_dashboard'
      and recipient ~* '^0x[0-9a-f]{40}$'
      and (
        (policy_version = 1 and value_wei = '0')
        or (
          policy_version = 2
          and value_wei = '100000000000000'
        )
      )
      and calldata = '0x'
      and expires_at is not null
    )
  )
);

create table if not exists public.chain_action_rate_limits (
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  chain_key text not null check (
    chain_key in ('robinhood_mainnet', 'robinhood_testnet')
  ),
  minute_window_started_at timestamptz not null,
  minute_count integer not null check (minute_count between 0 and 6),
  hour_window_started_at timestamptz not null,
  hour_count integer not null check (hour_count between 0 and 60),
  updated_at timestamptz not null default now(),
  primary key (agent_id, chain_key),
  constraint chain_action_rate_limits_window_order_check check (
    minute_window_started_at <= updated_at
    and hour_window_started_at <= updated_at
  )
);

create table if not exists public.execution_results (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  prepared_action_id text not null check (char_length(prepared_action_id) between 1 and 160),
  submission_key text not null check (submission_key ~ '^[0-9a-f]{64}$'),
  chain_key text not null default 'robinhood_mainnet' check (chain_key = 'robinhood_mainnet'),
  chain_id bigint not null default 4663 check (chain_id = 4663),
  tx_hash text not null check (tx_hash ~* '^0x[0-9a-f]{64}$'),
  prepared_action_record_id uuid
    references public.prepared_actions(id) on delete restrict,
  receipt_block_number bigint,
  receipt_checked_at timestamptz,
  status text not null check (status in ('submitted', 'confirmed', 'failed')),
  failure_code text check (
    failure_code is null or failure_code in (
      'submission_failed', 'transaction_reverted', 'receipt_unavailable'
    )
  ),
  visibility text not null default 'owner-only' check (visibility = 'owner-only'),
  submitted_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint execution_results_status_fields_check check (
    (status = 'submitted' and failure_code is null and confirmed_at is null)
    or (status = 'confirmed' and failure_code is null and confirmed_at is not null)
    or (status = 'failed' and failure_code is not null and confirmed_at is null)
  ),
  unique (owner_user_id, submission_key),
  unique (chain_id, tx_hash)
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agent_instances(id) on delete set null,
  source text not null check (
    source in ('agent_instances', 'telegram_sessions', 'chain_action_routes', 'approval_requests')
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
  delivery_status text not null default 'processing',
  lease_expires_at timestamptz not null default (now() + interval '2 minutes'),
  attempt_count integer not null default 1,
  delivered_at timestamptz,
  constraint telegram_processed_updates_pkey
    primary key (telegram_session_id, telegram_update_id),
  constraint telegram_processed_updates_session_fkey
    foreign key (telegram_session_id)
    references public.telegram_sessions(id)
    on delete cascade,
  constraint telegram_processed_updates_id_nonnegative_check
    check (telegram_update_id >= 0),
  constraint telegram_processed_updates_delivery_status_check
    check (delivery_status in ('processing', 'delivered')),
  constraint telegram_processed_updates_attempt_count_check
    check (attempt_count between 1 and 25)
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
create index if not exists prepared_actions_workspace_created_idx
on public.prepared_actions(workspace_id, created_at desc);
create index if not exists prepared_actions_agent_created_idx
on public.prepared_actions(agent_id, created_at desc);
create index if not exists prepared_actions_chain_created_idx
on public.prepared_actions(chain_key, created_at desc);
create index if not exists prepared_actions_expiry_idx
on public.prepared_actions(expires_at)
where expires_at is not null;
create index if not exists execution_results_owner_updated_idx on public.execution_results(owner_user_id, updated_at desc);
create index if not exists execution_results_agent_updated_idx on public.execution_results(agent_id, updated_at desc);
create index if not exists activity_logs_agent_id_created_at_idx on public.activity_logs(agent_id, created_at desc);
create index if not exists execution_results_prepared_action_record_idx
on public.execution_results(prepared_action_record_id);
create unique index if not exists execution_results_one_result_per_intent_idx
on public.execution_results(prepared_action_record_id)
where prepared_action_record_id is not null;
create index if not exists telegram_processed_updates_retry_idx
on public.telegram_processed_updates(delivery_status, lease_expires_at)
where delivery_status = 'processing';
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

create or replace function public.enforce_chain_action_agent_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_chain_key text := v_payload ->> 'chain_key';
  v_chain_id bigint;
  v_expected_chain_id bigint;
  v_agent_network text;
  v_agent_status text;
begin
  if v_chain_key not in ('robinhood_mainnet', 'robinhood_testnet') then
    raise exception 'Chain action agent scope rejected';
  end if;

  select agents.network, agents.chain_action_status
  into v_agent_network, v_agent_status
  from public.agent_instances agents
  where agents.id = new.agent_id
    and agents.workspace_id = new.workspace_id;

  if not found or v_agent_network <> v_chain_key then
    raise exception 'Chain action agent scope rejected';
  end if;

  if v_payload ? 'chain_id' then
    v_chain_id := (v_payload ->> 'chain_id')::bigint;
    v_expected_chain_id := case v_chain_key
      when 'robinhood_mainnet' then 4663
      when 'robinhood_testnet' then 46630
      else null
    end;
    if v_chain_id is distinct from v_expected_chain_id then
      raise exception 'Chain action identity rejected';
    end if;
  end if;

  if tg_table_name = 'prepared_actions'
    and v_agent_status not in ('ready', 'active')
  then
    raise exception 'Agent chain action status rejected';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_agent_network_rebinding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.network is distinct from old.network
    and (
      exists (select 1 from public.wallet_policies where agent_id = old.id)
      or exists (select 1 from public.approval_requests where agent_id = old.id)
      or exists (select 1 from public.prepared_actions where agent_id = old.id)
      or exists (select 1 from public.chain_action_rate_limits where agent_id = old.id)
    )
  then
    raise exception 'Agent network rebind rejected';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_prepared_action_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.agent_id is distinct from old.agent_id
    or new.request_id is distinct from old.request_id
    or new.action_kind is distinct from old.action_kind
    or new.chain_key is distinct from old.chain_key
    or new.chain_id is distinct from old.chain_id
    or new.risk is distinct from old.risk
    or new.route_summary is distinct from old.route_summary
    or new.value_summary is distinct from old.value_summary
    or new.approval_requirement is distinct from old.approval_requirement
    or new.safety_note is distinct from old.safety_note
    or new.provider is distinct from old.provider
    or new.recipient is distinct from old.recipient
    or new.value_wei is distinct from old.value_wei
    or new.calldata is distinct from old.calldata
    or new.policy_version is distinct from old.policy_version
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Prepared action immutable fields cannot change';
  end if;

  return new;
end;
$$;

create or replace function public.consume_chain_action_rate_limit(
  p_owner_user_id uuid,
  p_workspace_id uuid,
  p_agent_id uuid,
  p_chain_key text
)
returns table (allowed boolean, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_started timestamptz;
  v_minute_count integer;
  v_hour_started timestamptz;
  v_hour_count integer;
begin
  if p_chain_key not in ('robinhood_mainnet', 'robinhood_testnet') then
    raise exception 'Chain action rate limit scope rejected';
  end if;

  if not exists (
    select 1
    from public.agent_instances agents
    join public.workspaces workspaces on workspaces.id = agents.workspace_id
    where agents.id = p_agent_id
      and agents.workspace_id = p_workspace_id
      and workspaces.owner_user_id = p_owner_user_id
      and agents.network = p_chain_key
      and agents.chain_action_status in ('ready', 'active')
  ) then
    raise exception 'Chain action rate limit scope rejected';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_agent_id::text || ':' || p_chain_key, 0)
  );

  select minute_window_started_at, minute_count,
         hour_window_started_at, hour_count
  into v_minute_started, v_minute_count, v_hour_started, v_hour_count
  from public.chain_action_rate_limits
  where agent_id = p_agent_id and chain_key = p_chain_key
  for update;

  if not found then
    insert into public.chain_action_rate_limits (
      agent_id, workspace_id, chain_key,
      minute_window_started_at, minute_count,
      hour_window_started_at, hour_count, updated_at
    ) values (
      p_agent_id, p_workspace_id, p_chain_key,
      v_now, 1, v_now, 1, v_now
    );
    return query select true, 'allowed'::text;
    return;
  end if;

  if v_minute_started <= v_now - interval '1 minute' then
    v_minute_started := v_now;
    v_minute_count := 0;
  end if;
  if v_hour_started <= v_now - interval '1 hour' then
    v_hour_started := v_now;
    v_hour_count := 0;
  end if;

  if v_minute_count >= 6 or v_hour_count >= 60 then
    return query select false, 'rate_limited'::text;
    return;
  end if;

  update public.chain_action_rate_limits
  set workspace_id = p_workspace_id,
      minute_window_started_at = v_minute_started,
      minute_count = v_minute_count + 1,
      hour_window_started_at = v_hour_started,
      hour_count = v_hour_count + 1,
      updated_at = v_now
  where agent_id = p_agent_id and chain_key = p_chain_key;

  return query select true, 'allowed'::text;
end;
$$;

create or replace function public.enforce_prepared_action_policy_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.action_kind = 'robinhood_reviewed_transaction'
    and new.policy_version <> 2
  then
    raise exception 'New owner transaction intents require policy version 2';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_chain_action_agent_scope()
from public, anon, authenticated, service_role;
revoke all on function public.enforce_agent_network_rebinding()
from public, anon, authenticated, service_role;
revoke all on function public.enforce_prepared_action_immutable_fields()
from public, anon, authenticated, service_role;
revoke all on function public.enforce_prepared_action_policy_on_insert()
from public, anon, authenticated;
revoke all on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
to service_role;

drop trigger if exists enforce_wallet_policy_agent_chain_scope on public.wallet_policies;
create trigger enforce_wallet_policy_agent_chain_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.wallet_policies
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_approval_request_agent_chain_scope on public.approval_requests;
create trigger enforce_approval_request_agent_chain_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.approval_requests
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_prepared_action_agent_scope on public.prepared_actions;
create trigger enforce_prepared_action_agent_scope
before insert or update of workspace_id, agent_id, chain_key, chain_id
on public.prepared_actions
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_prepared_action_immutable_fields on public.prepared_actions;
create trigger enforce_prepared_action_immutable_fields
before update on public.prepared_actions
for each row execute function public.enforce_prepared_action_immutable_fields();

drop trigger if exists enforce_prepared_action_policy_on_insert on public.prepared_actions;
create trigger enforce_prepared_action_policy_on_insert
before insert on public.prepared_actions
for each row execute function public.enforce_prepared_action_policy_on_insert();
drop trigger if exists enforce_chain_action_rate_limit_agent_scope on public.chain_action_rate_limits;
create trigger enforce_chain_action_rate_limit_agent_scope
before insert or update of workspace_id, agent_id, chain_key
on public.chain_action_rate_limits
for each row execute function public.enforce_chain_action_agent_scope();

drop trigger if exists enforce_agent_network_rebinding on public.agent_instances;
create trigger enforce_agent_network_rebinding
before update of network on public.agent_instances
for each row execute function public.enforce_agent_network_rebinding();

create or replace function public.enforce_execution_result_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workspaces workspaces
    join public.agent_instances agents
      on agents.workspace_id = workspaces.id
    join public.prepared_actions prepared
      on prepared.workspace_id = workspaces.id
      and prepared.agent_id = agents.id
    where workspaces.id = new.workspace_id
      and workspaces.owner_user_id = new.owner_user_id
      and agents.id = new.agent_id
      and prepared.id = new.prepared_action_record_id
      and prepared.request_id = new.prepared_action_id
      and prepared.action_kind = 'robinhood_reviewed_transaction'
      and prepared.chain_key = new.chain_key
      and prepared.chain_id = new.chain_id
      and prepared.status = 'approved'
      and prepared.expires_at > now()
  ) then
    raise exception 'execution_result_scope_mismatch' using errcode = '23514';
  end if;

  if new.receipt_checked_at is null then
    raise exception 'execution_result_receipt_verification_required'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_execution_result_scope()
from public, anon, authenticated;

drop trigger if exists enforce_execution_result_scope_on_write on public.execution_results;
create trigger enforce_execution_result_scope_on_write
before insert or update of
  owner_user_id,
  workspace_id,
  agent_id,
  prepared_action_id,
  prepared_action_record_id,
  chain_key,
  chain_id
on public.execution_results
for each row
execute function public.enforce_execution_result_scope();

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
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_delivery_status text;
  v_lease_expires_at timestamptz;
  v_attempt_count integer;
begin
  if not exists (
    select 1
    from public.telegram_sessions sessions
    where sessions.id = p_telegram_session_id
      and sessions.webhook_status = 'active'
      and p_telegram_update_id >= 0
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_telegram_session_id::text || ':' || p_telegram_update_id::text,
      0
    )
  );

  select updates.delivery_status,
         updates.lease_expires_at,
         updates.attempt_count
  into v_delivery_status, v_lease_expires_at, v_attempt_count
  from public.telegram_processed_updates updates
  where updates.telegram_session_id = p_telegram_session_id
    and updates.telegram_update_id = p_telegram_update_id
  for update;

  if not found then
    insert into public.telegram_processed_updates (
      telegram_session_id,
      telegram_update_id,
      delivery_status,
      lease_expires_at,
      attempt_count,
      delivered_at
    ) values (
      p_telegram_session_id,
      p_telegram_update_id,
      'processing',
      v_now + interval '2 minutes',
      1,
      null
    );

    return query select true, 'claimed'::text;
    return;
  end if;

  if v_delivery_status = 'delivered'
    or v_lease_expires_at > v_now
    or v_attempt_count >= 25
  then
    return query select false, 'duplicate'::text;
    return;
  end if;

  update public.telegram_processed_updates updates
  set delivery_status = 'processing',
      lease_expires_at = v_now + interval '2 minutes',
      attempt_count = updates.attempt_count + 1,
      delivered_at = null
  where updates.telegram_session_id = p_telegram_session_id
    and updates.telegram_update_id = p_telegram_update_id;

  return query select true, 'claimed'::text;
end;
$$;

create or replace function public.mark_telegram_update_delivered(
  p_telegram_session_id uuid,
  p_telegram_update_id bigint
) returns table (
  marked boolean,
  status text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  update public.telegram_processed_updates updates
  set delivery_status = 'delivered',
      lease_expires_at = clock_timestamp(),
      delivered_at = clock_timestamp()
  where updates.telegram_session_id = p_telegram_session_id
    and updates.telegram_update_id = p_telegram_update_id
    and updates.delivery_status = 'processing';

  if found then
    return query select true, 'delivered'::text;
    return;
  end if;

  if exists (
    select 1
    from public.telegram_processed_updates updates
    where updates.telegram_session_id = p_telegram_session_id
      and updates.telegram_update_id = p_telegram_update_id
      and updates.delivery_status = 'delivered'
  ) then
    return query select false, 'duplicate'::text;
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
alter table public.prepared_actions enable row level security;
alter table public.chain_action_rate_limits enable row level security;
alter table public.execution_results enable row level security;
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

drop policy if exists "Workspace owners can read prepared actions" on public.prepared_actions;
create policy "Workspace owners can read prepared actions"
on public.prepared_actions
for select
to authenticated
using (public.owns_workspace(workspace_id));

drop policy if exists "Workspace owners can read execution results" on public.execution_results;
create policy "Workspace owners can read execution results"
on public.execution_results
for select
to authenticated
using (auth.uid() = owner_user_id and public.owns_workspace(workspace_id));

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

create or replace view public.prepared_action_owner_summaries
with (security_invoker = true)
as
select
  id,
  workspace_id,
  agent_id,
  action_kind,
  chain_key,
  chain_id,
  status,
  risk,
  route_summary,
  value_summary,
  approval_requirement,
  safety_note,
  expires_at,
  created_at,
  resolved_at
from public.prepared_actions;

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
  agents.chain_action_status,
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
revoke all privileges on public.prepared_actions from public, anon, authenticated, service_role;
revoke all privileges on public.prepared_action_owner_summaries from public, anon, authenticated, service_role;
revoke all privileges on public.chain_action_rate_limits from public, anon, authenticated, service_role;
revoke all privileges on public.execution_results from public, anon, authenticated;
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
revoke all on function public.mark_telegram_update_delivered(uuid,bigint)
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
  chain_action_status,
  created_at,
  last_sync_at,
  template_id
) on public.agent_instances to anon, authenticated;
grant select on public.agent_instances to authenticated;
grant select on public.wallet_policies to authenticated;
grant select on public.approval_requests to authenticated;
grant select (
  id,
  workspace_id,
  agent_id,
  action_kind,
  chain_key,
  chain_id,
  status,
  risk,
  route_summary,
  value_summary,
  approval_requirement,
  safety_note,
  expires_at,
  created_at,
  resolved_at
) on public.prepared_actions to authenticated;
grant select on public.prepared_action_owner_summaries to authenticated;
grant select, insert, update on public.chain_action_rate_limits to service_role;
grant select on public.execution_results to authenticated;
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
grant select, insert, update on public.prepared_actions to service_role;
grant all on public.execution_results to service_role;
grant all on public.activity_logs to service_role;
grant all on public.telegram_sessions to service_role;
grant select, insert, update on public.telegram_bot_token_secrets to service_role;
grant select, insert, update on public.telegram_webhook_secrets to service_role;
grant select, insert, update on public.telegram_chat_authorizations to service_role;
grant select, insert, update on public.telegram_processed_updates to service_role;
grant select, insert, update on public.telegram_owner_link_challenges to service_role;
grant select, insert, update on public.telegram_owner_link_consume_rate_limits to service_role;
grant select on public.prepared_action_owner_summaries to service_role;
grant select on public.telegram_session_summaries to service_role;
grant select on public.public_agent_profiles to service_role;
grant execute on function public.owns_workspace(uuid) to service_role;
grant execute on function public.resolve_telegram_webhook_session(text)
  to service_role;
grant execute on function public.resolve_telegram_chat_authorization(uuid,text,text,text)
  to service_role;
grant execute on function public.claim_telegram_update(uuid,bigint)
  to service_role;
grant execute on function public.mark_telegram_update_delivered(uuid,bigint)
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
