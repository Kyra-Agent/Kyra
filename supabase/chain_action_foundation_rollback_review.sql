-- REVIEW ONLY. Apply only as an explicitly approved rollback while both
-- chain-action tables contain zero rows. Historical records must never be
-- destroyed to simplify a migration.

begin;

do $$
declare
  prepared_count bigint;
  limiter_count bigint;
  incompatible_agent_count bigint;
  incompatible_policy_count bigint;
  incompatible_approval_count bigint;
begin
  if to_regclass('public.prepared_actions') is null
    or to_regclass('public.chain_action_rate_limits') is null
  then
    raise exception 'chain action foundation is incomplete';
  end if;

  select count(*) into prepared_count from public.prepared_actions;
  select count(*) into limiter_count from public.chain_action_rate_limits;
  select count(*)
  into incompatible_agent_count
  from public.agent_instances
  where network <> 'base'
    or chain_action_status <> 'disabled';
  select count(*)
  into incompatible_policy_count
  from public.wallet_policies
  where chain_key <> 'base' or chain_id <> 8453;
  select count(*)
  into incompatible_approval_count
  from public.approval_requests
  where chain_key <> 'base' or chain_id <> 8453;

  if prepared_count <> 0
    or limiter_count <> 0
    or incompatible_agent_count <> 0
    or incompatible_policy_count <> 0
    or incompatible_approval_count <> 0
  then
    raise exception 'chain action state exists; use a reviewed forward fix';
  end if;
end;
$$;

revoke all on function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
drop function public.consume_chain_action_rate_limit(uuid, uuid, uuid, text);

revoke all privileges on public.prepared_action_owner_summaries
  from public, anon, authenticated, service_role;
revoke all privileges on public.prepared_actions
  from public, anon, authenticated, service_role;
revoke all privileges on public.chain_action_rate_limits
  from public, anon, authenticated, service_role;

drop view public.prepared_action_owner_summaries;
drop table public.chain_action_rate_limits;
drop table public.prepared_actions;
drop function public.enforce_chain_action_agent_scope();
drop function public.enforce_prepared_action_immutable_fields();

alter table public.agent_instances
  drop constraint agent_instances_network_check,
  drop constraint agent_instances_chain_action_status_check,
  drop column chain_action_status,
  add constraint agent_instances_network_check check (network in ('base'));

alter table public.wallet_policies
  drop constraint wallet_policies_chain_key_check,
  drop constraint wallet_policies_chain_identity_check,
  drop column chain_key,
  drop column chain_id;

alter table public.approval_requests
  drop constraint approval_requests_chain_key_check,
  drop constraint approval_requests_chain_identity_check,
  drop column chain_key,
  drop column chain_id;

commit;
