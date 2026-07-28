begin;

alter table public.prepared_actions
  add column if not exists policy_version smallint;

update public.prepared_actions
set policy_version = 1
where policy_version is null;

alter table public.prepared_actions
  alter column policy_version set default 2,
  alter column policy_version set not null;

alter table public.prepared_actions
  drop constraint if exists prepared_actions_transaction_shape_check,
  add constraint prepared_actions_transaction_shape_check
    check (
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

revoke all on function public.enforce_prepared_action_policy_on_insert()
from public, anon, authenticated;

drop trigger if exists enforce_prepared_action_policy_on_insert
on public.prepared_actions;

create trigger enforce_prepared_action_policy_on_insert
before insert on public.prepared_actions
for each row
execute function public.enforce_prepared_action_policy_on_insert();

create unique index if not exists execution_results_one_result_per_intent_idx
on public.execution_results(prepared_action_record_id)
where prepared_action_record_id is not null;

commit;