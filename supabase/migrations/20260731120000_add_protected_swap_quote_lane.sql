begin;

create table public.swap_quote_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  request_id text not null,
  chain_key text not null,
  chain_id bigint not null,
  taker_address text not null,
  sell_token_address text not null,
  sell_token_symbol text not null,
  sell_token_decimals integer not null,
  buy_token_address text not null,
  buy_token_symbol text not null,
  buy_token_decimals integer not null,
  sell_amount_atomic text not null,
  buy_amount_atomic text not null,
  minimum_buy_amount_atomic text not null,
  slippage_bps integer not null,
  allowance_target text null,
  transaction_to text not null,
  transaction_data text not null,
  transaction_value_wei text not null,
  liquidity_sources text[] not null,
  route_summary text not null,
  provider text not null,
  provider_response_fingerprint text not null,
  status text not null,
  policy_version integer not null,
  quote_issued_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint swap_quote_reviews_request_unique
    unique (workspace_id, agent_id, request_id),
  constraint swap_quote_reviews_chain_check
    check (chain_key = 'robinhood_mainnet' and chain_id = 4663),
  constraint swap_quote_reviews_request_id_check
    check (request_id ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'),
  constraint swap_quote_reviews_addresses_check
    check (
      taker_address ~ '^0x[0-9A-Fa-f]{40}$'
      and transaction_to ~ '^0x[0-9A-Fa-f]{40}$'
      and (allowance_target is null or allowance_target ~ '^0x[0-9A-Fa-f]{40}$')
    ),
  constraint swap_quote_reviews_tokens_check
    check (
      sell_token_decimals = 18
      and buy_token_decimals = 18
      and sell_token_symbol in ('ETH', 'KYRA')
      and buy_token_symbol in ('ETH', 'KYRA')
      and sell_token_symbol <> buy_token_symbol
      and lower(sell_token_address) in (
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
      )
      and lower(buy_token_address) in (
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
      )
      and lower(sell_token_address) <> lower(buy_token_address)
      and (
        (
          sell_token_symbol = 'ETH'
          and lower(sell_token_address) = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        )
        or (
          sell_token_symbol = 'KYRA'
          and lower(sell_token_address) = lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
        )
      )
      and (
        (
          buy_token_symbol = 'ETH'
          and lower(buy_token_address) = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        )
        or (
          buy_token_symbol = 'KYRA'
          and lower(buy_token_address) = lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
        )
      )
    ),
  constraint swap_quote_reviews_amounts_check
    check (
      sell_amount_atomic ~ '^[1-9][0-9]*$'
      and buy_amount_atomic ~ '^[1-9][0-9]*$'
      and minimum_buy_amount_atomic ~ '^[1-9][0-9]*$'
      and (
        (
          sell_token_symbol = 'ETH'
          and (
            char_length(sell_amount_atomic) < char_length('5000000000000000')
            or (
              char_length(sell_amount_atomic) = char_length('5000000000000000')
              and sell_amount_atomic <= '5000000000000000'
            )
          )
        )
        or (
          sell_token_symbol = 'KYRA'
          and (
            char_length(sell_amount_atomic) < char_length('10000000000000000000000')
            or (
              char_length(sell_amount_atomic) = char_length('10000000000000000000000')
              and sell_amount_atomic <= '10000000000000000000000'
            )
          )
        )
      )
      and (
        char_length(minimum_buy_amount_atomic) < char_length(buy_amount_atomic)
        or (
          char_length(minimum_buy_amount_atomic) = char_length(buy_amount_atomic)
          and minimum_buy_amount_atomic <= buy_amount_atomic
        )
      )
    ),
  constraint swap_quote_reviews_slippage_check
    check (slippage_bps between 10 and 300),
  constraint swap_quote_reviews_transaction_check
    check (
      transaction_data ~ '^0x([0-9a-f]{2})+$'
      and char_length(transaction_data) <= 32770
      and transaction_value_wei ~ '^(0|[1-9][0-9]*)$'
      and (
        (
          sell_token_symbol = 'ETH'
          and allowance_target is null
          and transaction_value_wei = sell_amount_atomic
        )
        or (
          sell_token_symbol = 'KYRA'
          and allowance_target is not null
          and transaction_value_wei = '0'
        )
      )
    ),
  constraint swap_quote_reviews_route_check
    check (
      cardinality(liquidity_sources) between 1 and 16
      and char_length(btrim(route_summary)) between 1 and 240
    ),
  constraint swap_quote_reviews_provider_check
    check (provider = '0x_swap_api_v2'),
  constraint swap_quote_reviews_fingerprint_check
    check (provider_response_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint swap_quote_reviews_status_check
    check (
      status in ('quote_ready', 'allowance_required')
      and (sell_token_symbol <> 'ETH' or status = 'quote_ready')
    ),
  constraint swap_quote_reviews_policy_check
    check (policy_version = 1),
  constraint swap_quote_reviews_expiry_check
    check (
      quote_issued_at >= created_at - interval '15 seconds'
      and quote_issued_at <= created_at + interval '5 seconds'
      and expires_at = quote_issued_at + interval '75 seconds'
    )
);

create index swap_quote_reviews_workspace_created_idx
  on public.swap_quote_reviews (workspace_id, created_at desc);
create index swap_quote_reviews_agent_created_idx
  on public.swap_quote_reviews (agent_id, created_at desc);
create index swap_quote_reviews_expiry_idx
  on public.swap_quote_reviews (expires_at);

create or replace function public.enforce_swap_quote_review_agent_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent_network text;
  v_agent_status text;
begin
  select agent.network, agent.chain_action_status
  into v_agent_network, v_agent_status
  from public.agent_instances agent
  where agent.id = new.agent_id
    and agent.workspace_id = new.workspace_id;

  if not found
    or new.chain_key <> 'robinhood_mainnet'
    or new.chain_id <> 4663
    or v_agent_network <> new.chain_key
    or v_agent_status is null
    or v_agent_status not in ('ready', 'active')
  then
    raise exception 'Swap quote review agent scope rejected';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_swap_quote_review_agent_scope()
from public, anon, authenticated, service_role;

create trigger enforce_swap_quote_review_agent_scope
before insert on public.swap_quote_reviews
for each row execute function public.enforce_swap_quote_review_agent_scope();

create or replace function public.reject_swap_quote_review_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Swap quote reviews are immutable';
end;
$$;

revoke all on function public.reject_swap_quote_review_mutation()
from public, anon, authenticated, service_role;

create trigger reject_swap_quote_review_mutation
before update on public.swap_quote_reviews
for each row execute function public.reject_swap_quote_review_mutation();

alter table public.swap_quote_reviews enable row level security;
revoke all on table public.swap_quote_reviews from anon, authenticated, service_role;
grant select, insert on table public.swap_quote_reviews to service_role;

comment on table public.swap_quote_reviews is
  'Service-only immutable 0x quote snapshots for the protected Robinhood Chain swap lane.';
comment on column public.swap_quote_reviews.transaction_data is
  'Backend-reviewed calldata. Never accepted from a browser and never exposed by the quote endpoint.';

commit;
