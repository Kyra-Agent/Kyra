with telegram_vault_rpcs as (
  select
    to_regprocedure('public.store_telegram_bot_token(uuid,uuid,text,text)') as store_telegram_bot_token_rpc,
    to_regprocedure('public.resolve_telegram_bot_token(text)') as resolve_telegram_bot_token_rpc,
    to_regprocedure('public.revoke_telegram_bot_token(text)') as revoke_telegram_bot_token_rpc
),
telegram_webhook_receiver_objects as (
  select
    to_regclass('public.telegram_webhook_secrets') as telegram_webhook_secrets_table,
    to_regclass('public.telegram_chat_authorizations') as telegram_chat_authorizations_table,
    to_regprocedure('public.resolve_telegram_webhook_session(text)') as resolve_telegram_webhook_session_rpc,
    to_regprocedure('public.resolve_telegram_chat_authorization(uuid,text,text,text)') as resolve_telegram_chat_authorization_rpc
)
select
  has_table_privilege('authenticated', 'public.workspaces', 'select') as auth_can_read_workspaces,
  has_table_privilege('authenticated', 'public.workspaces', 'insert') as auth_can_insert_workspaces,
  has_table_privilege('authenticated', 'public.agent_instances', 'insert') as auth_can_insert_agents,
  has_table_privilege('authenticated', 'public.wallet_policies', 'insert') as auth_can_insert_wallet_policies,
  has_table_privilege('authenticated', 'public.approval_requests', 'insert') as auth_can_insert_approval_requests,
  has_table_privilege('authenticated', 'public.activity_logs', 'insert') as auth_can_insert_activity_logs,
  has_table_privilege('authenticated', 'public.telegram_sessions', 'insert') as auth_can_insert_telegram_sessions,
  has_table_privilege('authenticated', 'public.telegram_sessions', 'update') as auth_can_update_telegram_sessions,
  has_table_privilege('authenticated', 'public.telegram_sessions', 'delete') as auth_can_delete_telegram_sessions,
  has_column_privilege('authenticated', 'public.telegram_sessions', 'id', 'select') as auth_can_select_telegram_id,
  has_column_privilege('authenticated', 'public.telegram_sessions', 'agent_id', 'select') as auth_can_select_telegram_agent_id,
  has_column_privilege('authenticated', 'public.telegram_sessions', 'bot_handle', 'select') as auth_can_select_telegram_bot_handle,
  has_column_privilege('authenticated', 'public.telegram_sessions', 'webhook_status', 'select') as auth_can_select_telegram_webhook_status,
  has_column_privilege('authenticated', 'public.telegram_sessions', 'created_at', 'select') as auth_can_select_telegram_created_at,
  has_column_privilege('authenticated', 'public.telegram_sessions', 'last_event_at', 'select') as auth_can_select_telegram_last_event_at,
  has_column_privilege('authenticated', 'public.telegram_sessions', 'token_secret_ref', 'select') as auth_can_select_telegram_token_secret_ref,
  not has_table_privilege('authenticated', 'public.telegram_sessions', 'select') as auth_cannot_select_full_telegram_sessions,
  case
    when to_regclass('public.telegram_session_summaries') is null then false
    else has_table_privilege('authenticated', 'public.telegram_session_summaries', 'select')
  end as auth_can_select_telegram_session_summaries,
  has_table_privilege('service_role', 'public.agent_instances', 'insert') as service_role_can_insert_agents,
  has_table_privilege('service_role', 'public.telegram_sessions', 'insert') as service_role_can_insert_telegram_sessions,
  has_table_privilege('service_role', 'public.telegram_sessions', 'update') as service_role_can_update_telegram_sessions,
  telegram_webhook_receiver_objects.telegram_webhook_secrets_table is not null as telegram_webhook_secrets_table_exists,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'select'
    )
  end as public_cannot_select_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'insert'
    )
  end as public_cannot_insert_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'update'
    )
  end as public_cannot_update_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'delete'
    )
  end as public_cannot_delete_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'select'
    ), false)
  end as anon_cannot_select_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'insert'
    ), false)
  end as anon_cannot_insert_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'update'
    ), false)
  end as anon_cannot_update_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'delete'
    ), false)
  end as anon_cannot_delete_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'select'
    ), false)
  end as auth_cannot_select_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'insert'
    ), false)
  end as auth_cannot_insert_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'update'
    ), false)
  end as auth_cannot_update_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'delete'
    ), false)
  end as auth_cannot_delete_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'select'
    ), false)
  end as service_role_can_select_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'insert'
    ), false)
  end as service_role_can_insert_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'update'
    ), false)
  end as service_role_can_update_telegram_webhook_secrets,
  telegram_webhook_receiver_objects.telegram_chat_authorizations_table is not null as telegram_chat_authorizations_table_exists,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'select'
    )
  end as public_cannot_select_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'insert'
    )
  end as public_cannot_insert_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'update'
    )
  end as public_cannot_update_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'delete'
    )
  end as public_cannot_delete_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'select'
    ), false)
  end as anon_cannot_select_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'insert'
    ), false)
  end as anon_cannot_insert_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'update'
    ), false)
  end as anon_cannot_update_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'anon',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'delete'
    ), false)
  end as anon_cannot_delete_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'select'
    ), false)
  end as auth_cannot_select_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'insert'
    ), false)
  end as auth_cannot_insert_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'update'
    ), false)
  end as auth_cannot_update_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'delete'
    ), false)
  end as auth_cannot_delete_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'select'
    ), false)
  end as service_role_can_select_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'insert'
    ), false)
  end as service_role_can_insert_telegram_chat_authorizations,
  case
    when telegram_webhook_receiver_objects.telegram_chat_authorizations_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_chat_authorizations_table::oid,
      'update'
    ), false)
  end as service_role_can_update_telegram_chat_authorizations,
  telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is not null as resolve_telegram_webhook_session_function_exists,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
  end as public_cannot_execute_resolve_telegram_webhook_session,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else not coalesce(has_function_privilege(
      'anon',
      telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid,
      'execute'
    ), false)
  end as anon_cannot_execute_resolve_telegram_webhook_session,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else not coalesce(has_function_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid,
      'execute'
    ), false)
  end as auth_cannot_execute_resolve_telegram_webhook_session,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else coalesce(has_function_privilege(
      'service_role',
      telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid,
      'execute'
    ), false)
  end as service_role_can_execute_resolve_telegram_webhook_session,
  telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc is not null as resolve_telegram_chat_authorization_function_exists,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
  end as public_cannot_execute_resolve_telegram_chat_authorization,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc is null then false
    else not coalesce(has_function_privilege(
      'anon',
      telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc::oid,
      'execute'
    ), false)
  end as anon_cannot_execute_resolve_telegram_chat_authorization,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc is null then false
    else not coalesce(has_function_privilege(
      'authenticated',
      telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc::oid,
      'execute'
    ), false)
  end as auth_cannot_execute_resolve_telegram_chat_authorization,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc is null then false
    else coalesce(has_function_privilege(
      'service_role',
      telegram_webhook_receiver_objects.resolve_telegram_chat_authorization_rpc::oid,
      'execute'
    ), false)
  end as service_role_can_execute_resolve_telegram_chat_authorization,
  telegram_vault_rpcs.store_telegram_bot_token_rpc is not null as store_telegram_bot_token_function_exists,
  case
    when telegram_vault_rpcs.store_telegram_bot_token_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl
      where proc.oid = telegram_vault_rpcs.store_telegram_bot_token_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
  end as public_cannot_execute_store_telegram_bot_token,
  case
    when telegram_vault_rpcs.store_telegram_bot_token_rpc is null then false
    else not coalesce(has_function_privilege(
      'anon',
      telegram_vault_rpcs.store_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as anon_cannot_execute_store_telegram_bot_token,
  case
    when telegram_vault_rpcs.store_telegram_bot_token_rpc is null then false
    else not coalesce(has_function_privilege(
      'authenticated',
      telegram_vault_rpcs.store_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as auth_cannot_execute_store_telegram_bot_token,
  case
    when telegram_vault_rpcs.store_telegram_bot_token_rpc is null then false
    else coalesce(has_function_privilege(
      'service_role',
      telegram_vault_rpcs.store_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as service_role_can_execute_store_telegram_bot_token,
  telegram_vault_rpcs.resolve_telegram_bot_token_rpc is not null as resolve_telegram_bot_token_function_exists,
  case
    when telegram_vault_rpcs.resolve_telegram_bot_token_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl
      where proc.oid = telegram_vault_rpcs.resolve_telegram_bot_token_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
  end as public_cannot_execute_resolve_telegram_bot_token,
  case
    when telegram_vault_rpcs.resolve_telegram_bot_token_rpc is null then false
    else not coalesce(has_function_privilege(
      'anon',
      telegram_vault_rpcs.resolve_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as anon_cannot_execute_resolve_telegram_bot_token,
  case
    when telegram_vault_rpcs.resolve_telegram_bot_token_rpc is null then false
    else not coalesce(has_function_privilege(
      'authenticated',
      telegram_vault_rpcs.resolve_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as auth_cannot_execute_resolve_telegram_bot_token,
  case
    when telegram_vault_rpcs.resolve_telegram_bot_token_rpc is null then false
    else coalesce(has_function_privilege(
      'service_role',
      telegram_vault_rpcs.resolve_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as service_role_can_execute_resolve_telegram_bot_token,
  telegram_vault_rpcs.revoke_telegram_bot_token_rpc is not null as revoke_telegram_bot_token_function_exists,
  case
    when telegram_vault_rpcs.revoke_telegram_bot_token_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl
      where proc.oid = telegram_vault_rpcs.revoke_telegram_bot_token_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
  end as public_cannot_execute_revoke_telegram_bot_token,
  case
    when telegram_vault_rpcs.revoke_telegram_bot_token_rpc is null then false
    else not coalesce(has_function_privilege(
      'anon',
      telegram_vault_rpcs.revoke_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as anon_cannot_execute_revoke_telegram_bot_token,
  case
    when telegram_vault_rpcs.revoke_telegram_bot_token_rpc is null then false
    else not coalesce(has_function_privilege(
      'authenticated',
      telegram_vault_rpcs.revoke_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as auth_cannot_execute_revoke_telegram_bot_token,
  case
    when telegram_vault_rpcs.revoke_telegram_bot_token_rpc is null then false
    else coalesce(has_function_privilege(
      'service_role',
      telegram_vault_rpcs.revoke_telegram_bot_token_rpc::oid,
      'execute'
    ), false)
  end as service_role_can_execute_revoke_telegram_bot_token,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_instances'
      and policyname = 'Workspace owners can read agent instances'
      and cmd = 'SELECT'
  ) as owner_agent_read_policy_present,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'telegram_sessions'
      and policyname = 'Workspace owners can read telegram sessions'
      and cmd = 'SELECT'
  ) as owner_telegram_read_policy_present,
  exists (
    select 1
    from information_schema.views
    where table_schema = 'public'
      and table_name = 'telegram_session_summaries'
  ) as telegram_session_summaries_view_exists,
  exists (
    select 1
    from information_schema.views
    where table_schema = 'public'
      and table_name = 'telegram_session_summaries'
      and view_definition not ilike '%token_secret_ref%'
      and view_definition not ilike '%owner_user_id%'
      and view_definition not ilike '%workspace_id%'
  ) as telegram_session_summaries_excludes_sensitive_columns,
  coalesce(
    (
      select array_agg(column_name::text order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'telegram_session_summaries'
    ) = array[
      'id',
      'agent_id',
      'bot_handle',
      'webhook_status',
      'created_at',
      'last_event_at'
    ]::text[],
    false
  ) as telegram_session_summaries_has_expected_columns,
  not exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'telegram_sessions'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ) as auth_has_no_broad_telegram_sessions_select_grant
from telegram_vault_rpcs
cross join telegram_webhook_receiver_objects;
