begin;

alter table public.prepared_actions
  add column if not exists sender_address text,
  add column if not exists asset_kind text,
  add column if not exists token_address text,
  add column if not exists token_symbol text,
  add column if not exists token_decimals integer,
  add column if not exists amount_atomic text;

update public.prepared_actions
set
  sender_address = coalesce(sender_address, recipient),
  asset_kind = coalesce(asset_kind, 'native'),
  token_symbol = coalesce(token_symbol, 'ETH'),
  token_decimals = coalesce(token_decimals, 18),
  amount_atomic = coalesce(amount_atomic, value_wei)
where action_kind = 'robinhood_reviewed_transaction';

alter table public.prepared_actions
  drop constraint if exists prepared_actions_transaction_shape_check,
  drop constraint if exists prepared_actions_transfer_policy_check;

alter table public.prepared_actions
  add constraint prepared_actions_transaction_shape_check check (
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
      and recipient ~ '^0x[0-9A-Fa-f]{40}$'
      and expires_at is not null
      and (
        (policy_version = 1 and value_wei = '0' and calldata = '0x')
        or (
          policy_version = 2
          and value_wei = '100000000000000'
          and calldata = '0x'
        )
        or policy_version = 3
      )
    )
  ),
  add constraint prepared_actions_transfer_policy_check check (
    action_kind <> 'robinhood_reviewed_transaction'
    or (
      sender_address ~ '^0x[0-9A-Fa-f]{40}$'
      and recipient ~ '^0x[0-9A-Fa-f]{40}$'
      and asset_kind in ('native', 'erc20')
      and token_symbol in ('ETH', 'KYRA')
      and token_decimals = 18
      and amount_atomic ~ '^[0-9]+$'
      and (
        (
          policy_version = 1
          and asset_kind = 'native'
          and token_address is null
          and sender_address = recipient
          and amount_atomic = '0'
          and value_wei = '0'
          and calldata = '0x'
        )
        or (
          policy_version = 2
          and asset_kind = 'native'
          and token_address is null
          and sender_address = recipient
          and token_symbol = 'ETH'
          and amount_atomic = '100000000000000'
          and value_wei = '100000000000000'
          and calldata = '0x'
        )
        or (
          policy_version = 3
          and amount_atomic ~ '^[1-9][0-9]*$'
          and lower(sender_address) <> lower(recipient)
          and (
            (
              asset_kind = 'native'
              and token_address is null
              and token_symbol = 'ETH'
              and amount_atomic = value_wei
              and (
                char_length(amount_atomic) < 16
                or (
                  char_length(amount_atomic) = 16
                  and amount_atomic <= '5000000000000000'
                )
              )
              and calldata = '0x'
            )
            or (
              asset_kind = 'erc20'
              and lower(token_address) =
                lower('0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1')
              and token_symbol = 'KYRA'
              and (
                char_length(amount_atomic) < 23
                or (
                  char_length(amount_atomic) = 23
                  and amount_atomic <= '10000000000000000000000'
                )
              )
              and value_wei = '0'
              and calldata ~ '^0xa9059cbb[0-9A-Fa-f]{128}$'
            )
          )
        )
      )
    )
  );

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
    or new.sender_address is distinct from old.sender_address
    or new.recipient is distinct from old.recipient
    or new.asset_kind is distinct from old.asset_kind
    or new.token_address is distinct from old.token_address
    or new.token_symbol is distinct from old.token_symbol
    or new.token_decimals is distinct from old.token_decimals
    or new.amount_atomic is distinct from old.amount_atomic
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

create or replace function public.enforce_prepared_action_policy_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.action_kind = 'robinhood_reviewed_transaction'
    and new.policy_version not in (2, 3)
  then
    raise exception 'New transaction intents require policy version 2 or 3';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_prepared_action_policy_on_insert()
from public, anon, authenticated, service_role;

revoke all on function public.enforce_prepared_action_immutable_fields()
from public, anon, authenticated, service_role;

create index if not exists prepared_actions_transfer_daily_idx
  on public.prepared_actions (
    workspace_id,
    policy_version,
    asset_kind,
    created_at
  )
  where action_kind = 'robinhood_reviewed_transaction';

comment on column public.prepared_actions.sender_address is
  'Immutable checksummed sender bound by the private dashboard review.';
comment on column public.prepared_actions.amount_atomic is
  'Immutable base-unit amount used for policy and receipt verification.';

commit;
