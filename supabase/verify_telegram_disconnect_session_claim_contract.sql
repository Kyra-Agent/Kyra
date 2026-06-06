-- READ-ONLY VERIFIER - SAFE TO RUN BEFORE OR AFTER AN APPROVED APPLY.
-- This query does not create, alter, grant, revoke, insert, update, or delete.
-- Before the disconnect claim RPC exists, guarded checks return false instead
-- of raising object-not-found errors.

with disconnect_objects as (
  select
    to_regprocedure(
      'public.claim_telegram_disconnect_session(uuid,uuid,text)'
    ) as claim_rpc,
    to_regclass('public.telegram_sessions') as telegram_sessions_table,
    to_regclass(
      'public.telegram_bot_token_secrets'
    ) as telegram_bot_token_secrets_table,
    to_regclass(
      'public.telegram_webhook_secrets'
    ) as telegram_webhook_secrets_table,
    to_regclass('public.agent_instances') as agent_instances_table,
    to_regclass('public.workspaces') as workspaces_table
),
claim_definition as (
  select
    case
      when disconnect_objects.claim_rpc is null then ''
      else pg_catalog.lower(
        pg_catalog.pg_get_functiondef(disconnect_objects.claim_rpc::oid)
      )
    end as body
  from disconnect_objects
)
select
  disconnect_objects.claim_rpc is not null
    as claim_telegram_disconnect_session_function_exists,
  case
    when disconnect_objects.claim_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      join pg_language lang
        on lang.oid = proc.prolang
      where proc.oid = disconnect_objects.claim_rpc::oid
        and lang.lanname = 'plpgsql'
    )
  end as claim_telegram_disconnect_session_uses_plpgsql,
  case
    when disconnect_objects.claim_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = disconnect_objects.claim_rpc::oid
        and proc.provolatile = 'v'
        and not proc.prosecdef
        and exists (
          select 1
          from unnest(coalesce(proc.proconfig, array[]::text[])) as config(setting)
          where lower(split_part(config.setting, '=', 1)) = 'search_path'
            and btrim(
              substring(config.setting from position('=' in config.setting) + 1),
              ' "'
            ) = ''
        )
    )
  end as claim_telegram_disconnect_session_security_contract_is_expected,
  case
    when disconnect_objects.claim_rpc is null then false
    else pg_catalog.pg_get_function_result(disconnect_objects.claim_rpc::oid) =
      'TABLE(claimed boolean, status text, telegram_session_id uuid, agent_id uuid, bot_handle text, token_secret_ref text, webhook_secret_ref text)'
  end as claim_telegram_disconnect_session_result_contract_is_expected,
  case
    when disconnect_objects.claim_rpc is null then false
    else claim_definition.body like '%pg_advisory_xact_lock%'
      and claim_definition.body like '%telegram_disconnect_session%'
      and claim_definition.body like '%webhook_status = ''active''%'
      and claim_definition.body like '%webhook_status = ''paused''%'
      and claim_definition.body like '%workspaces.owner_user_id = p_owner_user_id%'
      and claim_definition.body like '%telegram_bot_token_secrets%'
      and claim_definition.body like '%token_secrets.agent_id = p_agent_id%'
      and claim_definition.body like '%token_secrets.owner_user_id = p_owner_user_id%'
      and claim_definition.body like '%telegram_webhook_secrets%'
      and claim_definition.body like '%missing_secret_ref%'
      and claim_definition.body like '%conflict%'
      and claim_definition.body like '%forbidden%'
  end as claim_telegram_disconnect_session_definition_contract_is_expected,
  case
    when disconnect_objects.claim_rpc is null then false
    else claim_definition.body not like '%resolve_telegram_bot_token%'
      and claim_definition.body not like '%vault.decrypted_secrets%'
      and claim_definition.body not like '%api.telegram.org%'
      and claim_definition.body not like '%deletewebhook%'
      and claim_definition.body not like '%setwebhook%'
      and claim_definition.body not like '%getme%'
      and claim_definition.body not like '%v_bot_token%'
  end as claim_telegram_disconnect_session_does_not_resolve_or_call_telegram,
  case
    when disconnect_objects.claim_rpc is null then false
    else not pg_catalog.has_function_privilege(
      'public',
      disconnect_objects.claim_rpc::oid,
      'EXECUTE'
    )
  end as public_cannot_execute_claim_telegram_disconnect_session,
  case
    when disconnect_objects.claim_rpc is null then false
    else not pg_catalog.has_function_privilege(
      'anon',
      disconnect_objects.claim_rpc::oid,
      'EXECUTE'
    )
  end as anon_cannot_execute_claim_telegram_disconnect_session,
  case
    when disconnect_objects.claim_rpc is null then false
    else not pg_catalog.has_function_privilege(
      'authenticated',
      disconnect_objects.claim_rpc::oid,
      'EXECUTE'
    )
  end as auth_cannot_execute_claim_telegram_disconnect_session,
  case
    when disconnect_objects.claim_rpc is null then false
    else pg_catalog.has_function_privilege(
      'service_role',
      disconnect_objects.claim_rpc::oid,
      'EXECUTE'
    )
  end as service_role_can_execute_claim_telegram_disconnect_session,
  case
    when disconnect_objects.telegram_bot_token_secrets_table is null then false
    else not pg_catalog.has_table_privilege(
      'anon',
      disconnect_objects.telegram_bot_token_secrets_table::oid,
      'SELECT'
    )
      and not pg_catalog.has_table_privilege(
        'authenticated',
        disconnect_objects.telegram_bot_token_secrets_table::oid,
        'SELECT'
      )
  end as browser_roles_cannot_select_telegram_bot_token_secrets,
  case
    when disconnect_objects.telegram_webhook_secrets_table is null then false
    else not pg_catalog.has_table_privilege(
      'anon',
      disconnect_objects.telegram_webhook_secrets_table::oid,
      'SELECT'
    )
      and not pg_catalog.has_table_privilege(
        'authenticated',
        disconnect_objects.telegram_webhook_secrets_table::oid,
        'SELECT'
      )
  end as browser_roles_cannot_select_telegram_webhook_secrets,
  case
    when disconnect_objects.telegram_sessions_table is null then false
    else not pg_catalog.has_column_privilege(
      'authenticated',
      disconnect_objects.telegram_sessions_table::oid,
      'token_secret_ref',
      'SELECT'
    )
  end as authenticated_cannot_select_telegram_session_token_secret_ref
from disconnect_objects
cross join claim_definition;
