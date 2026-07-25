begin;

do $$
begin
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
    raise exception 'zero_agent_reset_closeout_failed' using errcode = '55000';
  end if;

  if not exists (select 1 from public.workspaces) then
    raise exception 'workspace_preservation_failed' using errcode = '55000';
  end if;

  if not exists (select 1 from public.agent_templates) then
    raise exception 'template_preservation_failed' using errcode = '55000';
  end if;

  if to_regclass('public.base_mcp_status_rate_limits') is not null then
    raise exception 'legacy_base_table_present' using errcode = '55000';
  end if;
end;
$$;

drop function if exists public.admin_purge_all_agent_records(text);

commit;