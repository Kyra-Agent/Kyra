begin;

create or replace function public.admin_purge_all_agent_records(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_secret record;
  v_vault_overwritten integer := 0;
begin
  if p_confirmation is distinct from 'PURGE_ALL_KYRA_AGENTS_FOR_ROBINHOOD_RESET' then
    raise exception 'confirmation_required' using errcode = '22023';
  end if;

  if to_regprocedure('vault.update_secret(uuid,text,text,text,uuid)') is null then
    raise exception 'vault_update_secret_unavailable' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('kyra:global-agent-reset:robinhood', 0)
  );

  select jsonb_build_object(
    'agent_instances', (select count(*) from public.agent_instances),
    'telegram_sessions', (select count(*) from public.telegram_sessions),
    'telegram_bot_token_secrets', (
      select count(*) from public.telegram_bot_token_secrets
    ),
    'telegram_webhook_secrets', (
      select count(*) from public.telegram_webhook_secrets
    ),
    'telegram_processed_updates', (
      select count(*) from public.telegram_processed_updates
    ),
    'telegram_chat_authorizations', (
      select count(*) from public.telegram_chat_authorizations
    ),
    'telegram_owner_link_challenges', (
      select count(*) from public.telegram_owner_link_challenges
    ),
    'telegram_owner_link_consume_rate_limits', (
      select count(*) from public.telegram_owner_link_consume_rate_limits
    ),
    'wallet_policies', (select count(*) from public.wallet_policies),
    'approval_requests', (select count(*) from public.approval_requests),
    'prepared_actions', (select count(*) from public.prepared_actions),
    'execution_results', (select count(*) from public.execution_results),
    'activity_logs', (select count(*) from public.activity_logs),
    'chain_action_rate_limits', (
      select count(*) from public.chain_action_rate_limits
    ),
    'workspaces_preserved', (select count(*) from public.workspaces),
    'templates_preserved', (select count(*) from public.agent_templates)
  )
  into v_before;

  for v_secret in
    select distinct secrets.vault_secret_id
    from public.telegram_bot_token_secrets secrets
  loop
    perform vault.update_secret(
      v_secret.vault_secret_id,
      'revoked_by_kyra_robinhood_reset_' ||
        md5(
          random()::text ||
          clock_timestamp()::text ||
          v_secret.vault_secret_id::text ||
          txid_current()::text
        ),
      null,
      'Revoked by Kyra Robinhood migration reset'
    );
    v_vault_overwritten := v_vault_overwritten + 1;
  end loop;

  delete from public.telegram_processed_updates;
  delete from public.telegram_owner_link_consume_rate_limits;
  delete from public.telegram_owner_link_challenges;
  delete from public.telegram_chat_authorizations;
  delete from public.telegram_webhook_secrets;
  delete from public.telegram_sessions;
  delete from public.telegram_bot_token_secrets;
  delete from public.execution_results;
  delete from public.prepared_actions;
  delete from public.approval_requests;
  delete from public.wallet_policies;
  delete from public.chain_action_rate_limits;
  delete from public.activity_logs;
  delete from public.agent_instances;

  select jsonb_build_object(
    'agent_instances', (select count(*) from public.agent_instances),
    'telegram_sessions', (select count(*) from public.telegram_sessions),
    'telegram_bot_token_secrets', (
      select count(*) from public.telegram_bot_token_secrets
    ),
    'telegram_webhook_secrets', (
      select count(*) from public.telegram_webhook_secrets
    ),
    'telegram_processed_updates', (
      select count(*) from public.telegram_processed_updates
    ),
    'telegram_chat_authorizations', (
      select count(*) from public.telegram_chat_authorizations
    ),
    'telegram_owner_link_challenges', (
      select count(*) from public.telegram_owner_link_challenges
    ),
    'telegram_owner_link_consume_rate_limits', (
      select count(*) from public.telegram_owner_link_consume_rate_limits
    ),
    'wallet_policies', (select count(*) from public.wallet_policies),
    'approval_requests', (select count(*) from public.approval_requests),
    'prepared_actions', (select count(*) from public.prepared_actions),
    'execution_results', (select count(*) from public.execution_results),
    'activity_logs', (select count(*) from public.activity_logs),
    'chain_action_rate_limits', (
      select count(*) from public.chain_action_rate_limits
    ),
    'workspaces_preserved', (select count(*) from public.workspaces),
    'templates_preserved', (select count(*) from public.agent_templates)
  )
  into v_after;

  if exists (select 1 from public.agent_instances)
    or exists (select 1 from public.telegram_sessions)
    or exists (select 1 from public.telegram_bot_token_secrets)
    or exists (select 1 from public.telegram_webhook_secrets)
    or exists (select 1 from public.telegram_processed_updates)
    or exists (select 1 from public.telegram_chat_authorizations)
    or exists (select 1 from public.telegram_owner_link_challenges)
    or exists (
      select 1 from public.telegram_owner_link_consume_rate_limits
    )
    or exists (select 1 from public.wallet_policies)
    or exists (select 1 from public.approval_requests)
    or exists (select 1 from public.prepared_actions)
    or exists (select 1 from public.execution_results)
    or exists (select 1 from public.activity_logs)
    or exists (select 1 from public.chain_action_rate_limits)
  then
    raise exception 'agent_reset_incomplete' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'status', 'purged',
    'before', v_before,
    'after', v_after,
    'vault_secrets_overwritten', v_vault_overwritten
  );
end;
$$;

revoke all on function public.admin_purge_all_agent_records(text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_purge_all_agent_records(text)
  to service_role;

commit;