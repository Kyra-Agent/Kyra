begin;

create table public.swap_execution_intents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  quote_review_id uuid not null references public.swap_quote_reviews(id) on delete cascade,
  request_id text not null,
  step text not null,
  chain_key text not null,
  chain_id bigint not null,
  sender_address text not null,
  transaction_to text not null,
  transaction_data text not null,
  transaction_value_wei text not null,
  token_address text null,
  spender_address text null,
  allowance_amount_atomic text null,
  status text not null default 'approved',
  policy_version integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint swap_execution_intents_request_unique
    unique (owner_user_id, workspace_id, agent_id, request_id),
  constraint swap_execution_intents_step_check
    check (step in ('allowance_set', 'swap', 'allowance_revoke')),
  constraint swap_execution_intents_chain_check
    check (chain_key = 'robinhood_mainnet' and chain_id = 4663),
  constraint swap_execution_intents_request_id_check
    check (request_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'),
  constraint swap_execution_intents_addresses_check
    check (
      sender_address ~ '^0x[0-9A-Fa-f]{40}$'
      and transaction_to ~ '^0x[0-9A-Fa-f]{40}$'
      and (token_address is null or token_address ~ '^0x[0-9A-Fa-f]{40}$')
      and (spender_address is null or spender_address ~ '^0x[0-9A-Fa-f]{40}$')
    ),
  constraint swap_execution_intents_transaction_check
    check (
      transaction_data ~ '^0x[0-9A-Fa-f]+$'
      and mod(char_length(transaction_data), 2) = 0
      and char_length(transaction_data) <= 32770
      and transaction_value_wei ~ '^(0|[1-9][0-9]*)$'
    ),
  constraint swap_execution_intents_step_shape_check
    check (
      (
        step = 'swap'
        and token_address is null
        and spender_address is null
        and allowance_amount_atomic is null
      )
      or (
        step in ('allowance_set', 'allowance_revoke')
        and token_address is not null
        and lower(token_address) = lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
        and spender_address is not null
        and allowance_amount_atomic is not null
        and allowance_amount_atomic ~ '^(0|[1-9][0-9]*)$'
        and transaction_value_wei = '0'
      )
    ),
  constraint swap_execution_intents_status_check
    check (status = 'approved'),
  constraint swap_execution_intents_policy_check
    check (policy_version = 1),
  constraint swap_execution_intents_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);

create table public.swap_execution_results (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  intent_id uuid not null references public.swap_execution_intents(id) on delete cascade,
  request_id text not null,
  step text not null,
  chain_key text not null,
  chain_id bigint not null,
  submission_key text not null,
  tx_hash text not null,
  status text not null,
  failure_code text null,
  receipt_block_number bigint null,
  receipt_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint swap_execution_results_intent_unique unique (intent_id),
  constraint swap_execution_results_chain_tx_unique unique (chain_id, tx_hash),
  constraint swap_execution_results_submission_unique unique (submission_key),
  constraint swap_execution_results_step_check
    check (step in ('allowance_set', 'swap', 'allowance_revoke')),
  constraint swap_execution_results_chain_check
    check (chain_key = 'robinhood_mainnet' and chain_id = 4663),
  constraint swap_execution_results_hash_check
    check (
      tx_hash ~ '^0x[0-9a-f]{64}$'
      and submission_key ~ '^[0-9a-f]{64}$'
    ),
  constraint swap_execution_results_status_check
    check (
      (status = 'submitted' and failure_code is null and receipt_block_number is null)
      or (
        status = 'confirmed'
        and failure_code is null
        and receipt_block_number is not null
      )
      or (
        status = 'failed'
        and failure_code = 'transaction_reverted'
        and receipt_block_number is not null
      )
    )
);

create index swap_execution_intents_owner_created_idx
  on public.swap_execution_intents(owner_user_id, created_at desc);
create index swap_execution_intents_quote_step_idx
  on public.swap_execution_intents(quote_review_id, step, created_at desc);
create index swap_execution_results_owner_updated_idx
  on public.swap_execution_results(owner_user_id, updated_at desc);

create or replace function public.enforce_swap_execution_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote public.swap_quote_reviews%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.quote_review_id::text || ':' || new.step, 0)
  );

  if not exists (
    select 1
    from public.workspaces workspaces
    join public.agent_instances agents
      on agents.workspace_id = workspaces.id
    where workspaces.id = new.workspace_id
      and workspaces.owner_user_id = new.owner_user_id
      and agents.id = new.agent_id
      and agents.network = 'robinhood_mainnet'
      and agents.chain_action_status in ('ready', 'active')
  ) then
    raise exception 'swap_execution_scope_mismatch' using errcode = '23514';
  end if;

  select *
  into quote
  from public.swap_quote_reviews reviews
  where reviews.id = new.quote_review_id
    and reviews.workspace_id = new.workspace_id
    and reviews.agent_id = new.agent_id
    and lower(reviews.taker_address) = lower(new.sender_address)
  for share;

  if not found then
    raise exception 'swap_quote_scope_mismatch' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.swap_execution_intents intents
    left join public.swap_execution_results results
      on results.intent_id = intents.id
    where intents.quote_review_id = new.quote_review_id
      and intents.step = new.step
      and (results.id is null or results.status <> 'failed')
  ) then
    raise exception 'swap_execution_step_already_active' using errcode = '23505';
  end if;

  if new.step = 'swap' then
    if quote.status <> 'quote_ready'
      or quote.expires_at <= now()
      or lower(new.transaction_to) <> lower(quote.transaction_to)
      or lower(new.transaction_data) <> lower(quote.transaction_data)
      or new.transaction_value_wei <> quote.transaction_value_wei
      or new.expires_at <> quote.expires_at
    then
      raise exception 'swap_execution_quote_mismatch' using errcode = '23514';
    end if;

    if lower(quote.sell_token_address) =
      lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
      and not exists (
        select 1
        from public.swap_execution_intents allowance_intents
        join public.swap_execution_results allowance_results
          on allowance_results.intent_id = allowance_intents.id
          and allowance_results.status = 'confirmed'
        join public.swap_quote_reviews allowance_quotes
          on allowance_quotes.id = allowance_intents.quote_review_id
        where allowance_intents.owner_user_id = new.owner_user_id
          and allowance_intents.workspace_id = new.workspace_id
          and allowance_intents.agent_id = new.agent_id
          and allowance_intents.step = 'allowance_set'
          and lower(allowance_intents.sender_address) = lower(new.sender_address)
          and lower(allowance_intents.token_address) = lower(quote.sell_token_address)
          and lower(allowance_intents.spender_address) = lower(quote.allowance_target)
          and allowance_intents.allowance_amount_atomic = quote.sell_amount_atomic
          and allowance_intents.quote_review_id <> quote.id
          and allowance_results.receipt_checked_at <= quote.quote_issued_at
      )
    then
      raise exception 'fresh_quote_after_allowance_required' using errcode = '23514';
    end if;
  elsif new.step = 'allowance_set' then
    if quote.status <> 'allowance_required'
      or quote.expires_at <= now()
      or lower(quote.sell_token_address) <>
        lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
      or quote.allowance_target is null
      or new.token_address is null
      or new.spender_address is null
      or new.allowance_amount_atomic is null
      or lower(new.transaction_to) <> lower(quote.sell_token_address)
      or lower(new.token_address) <> lower(quote.sell_token_address)
      or lower(new.spender_address) <> lower(quote.allowance_target)
      or new.allowance_amount_atomic <> quote.sell_amount_atomic
      or new.transaction_value_wei <> '0'
    then
      raise exception 'swap_allowance_scope_mismatch' using errcode = '23514';
    end if;
  else
    if lower(quote.sell_token_address) <>
        lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
      or quote.allowance_target is null
      or new.token_address is null
      or new.spender_address is null
      or new.allowance_amount_atomic is null
      or lower(new.transaction_to) <> lower(quote.sell_token_address)
      or lower(new.token_address) <> lower(quote.sell_token_address)
      or lower(new.spender_address) <> lower(quote.allowance_target)
      or new.allowance_amount_atomic <> '0'
      or new.transaction_value_wei <> '0'
      or not exists (
        select 1
        from public.swap_execution_intents allowance_intents
        join public.swap_execution_results allowance_results
          on allowance_results.intent_id = allowance_intents.id
          and allowance_results.status = 'confirmed'
        where allowance_intents.owner_user_id = new.owner_user_id
          and allowance_intents.workspace_id = new.workspace_id
          and allowance_intents.agent_id = new.agent_id
          and allowance_intents.step = 'allowance_set'
          and lower(allowance_intents.sender_address) = lower(new.sender_address)
          and lower(allowance_intents.token_address) = lower(new.token_address)
          and lower(allowance_intents.spender_address) = lower(new.spender_address)
      )
    then
      raise exception 'swap_revoke_scope_mismatch' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_swap_execution_intent()
from public, anon, authenticated;

create trigger enforce_swap_execution_intent_on_insert
before insert on public.swap_execution_intents
for each row execute function public.enforce_swap_execution_intent();

create or replace function public.prevent_swap_execution_intent_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'swap_execution_intents_are_immutable' using errcode = '23514';
end;
$$;

revoke all on function public.prevent_swap_execution_intent_mutation()
from public, anon, authenticated;

create trigger prevent_swap_execution_intent_update
before update on public.swap_execution_intents
for each row execute function public.prevent_swap_execution_intent_mutation();

create or replace function public.enforce_swap_execution_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent public.swap_execution_intents%rowtype;
begin
  select *
  into intent
  from public.swap_execution_intents intents
  where intents.id = new.intent_id
    and intents.owner_user_id = new.owner_user_id
    and intents.workspace_id = new.workspace_id
    and intents.agent_id = new.agent_id
    and intents.request_id = new.request_id
    and intents.step = new.step
    and intents.chain_key = new.chain_key
    and intents.chain_id = new.chain_id
  for share;

  if not found then
    raise exception 'swap_execution_result_scope_mismatch' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_user_id is distinct from old.owner_user_id
      or new.workspace_id is distinct from old.workspace_id
      or new.agent_id is distinct from old.agent_id
      or new.intent_id is distinct from old.intent_id
      or new.request_id is distinct from old.request_id
      or new.step is distinct from old.step
      or new.chain_key is distinct from old.chain_key
      or new.chain_id is distinct from old.chain_id
      or new.submission_key is distinct from old.submission_key
      or new.tx_hash is distinct from old.tx_hash
      or new.created_at is distinct from old.created_at
      or (
        old.status in ('confirmed', 'failed')
        and (
          new.failure_code is distinct from old.failure_code
          or new.receipt_block_number is distinct from old.receipt_block_number
          or new.receipt_checked_at is distinct from old.receipt_checked_at
        )
      )
      or not (
        new.status = old.status
        or (
          old.status = 'submitted'
          and new.status in ('confirmed', 'failed')
        )
      )
    then
      raise exception 'swap_execution_result_transition_forbidden'
        using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.enforce_swap_execution_result()
from public, anon, authenticated;

create trigger enforce_swap_execution_result_on_write
before insert or update on public.swap_execution_results
for each row execute function public.enforce_swap_execution_result();

alter table public.swap_execution_intents enable row level security;
alter table public.swap_execution_results enable row level security;

revoke all privileges on public.swap_execution_intents
  from public, anon, authenticated, service_role;
revoke all privileges on public.swap_execution_results
  from public, anon, authenticated, service_role;
grant select, insert on public.swap_execution_intents to service_role;
grant select, insert, update on public.swap_execution_results to service_role;

comment on table public.swap_execution_intents is
  'Backend-only immutable allowance, swap, and revoke intents for protected Robinhood Chain swaps.';
comment on table public.swap_execution_results is
  'Backend-only receipt-verified results for protected Robinhood Chain swap steps.';

commit;
