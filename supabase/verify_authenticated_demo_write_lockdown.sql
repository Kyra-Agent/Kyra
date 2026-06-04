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
    else exists (
      select 1
      from pg_class rel
      where rel.oid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and rel.relkind = 'r'
    )
  end as telegram_webhook_secrets_is_regular_table,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else coalesce(
      (
        select array_agg(
          format('%s:%s:%s', column_name, udt_name, is_nullable)
          order by ordinal_position
        )
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'telegram_webhook_secrets'
      ) = array[
        'webhook_secret_ref:text:NO',
        'webhook_secret_hash:text:NO',
        'telegram_session_id:uuid:NO',
        'created_at:timestamptz:NO',
        'revoked_at:timestamptz:YES'
      ]::text[],
      false
    )
  end as telegram_webhook_secrets_has_expected_columns,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'telegram_webhook_secrets'
        and column_name = 'agent_id'
    )
  end as telegram_webhook_secrets_excludes_agent_id,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else coalesce(
      (
        select rel.relrowsecurity
        from pg_class rel
        where rel.oid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
      ),
      false
    )
  end as telegram_webhook_secrets_rls_enabled,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'telegram_webhook_secrets'
    )
  end as telegram_webhook_secrets_has_no_policies,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else exists (
      select 1
      from pg_constraint con
      where con.conrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and con.conname = 'telegram_webhook_secrets_pkey'
        and con.contype = 'p'
        and con.convalidated
        and con.conkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
              and att.attname = 'webhook_secret_ref'
              and not att.attisdropped
          )
        ]::smallint[]
    )
  end as telegram_webhook_secrets_primary_key_is_expected,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else exists (
      select 1
      from pg_constraint con
      where con.conrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and con.conname = 'telegram_webhook_secrets_session_fkey'
        and con.contype = 'f'
        and con.convalidated
        and con.confrelid = to_regclass('public.telegram_sessions')
        and con.confdeltype = 'c'
        and con.conkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
              and att.attname = 'telegram_session_id'
              and not att.attisdropped
          )
        ]::smallint[]
        and con.confkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = to_regclass('public.telegram_sessions')
              and att.attname = 'id'
              and not att.attisdropped
          )
        ]::smallint[]
    )
  end as telegram_webhook_secrets_session_foreign_key_is_expected,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else exists (
      select 1
      from pg_constraint con
      where con.conrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and con.conname = 'telegram_webhook_secrets_ref_not_blank_check'
        and con.contype = 'c'
        and con.convalidated
        and regexp_replace(
          lower(pg_get_constraintdef(con.oid)),
          '[^a-z0-9_>]+',
          '',
          'g'
        ) = 'checklengthbtrimwebhook_secret_ref>0'
    )
  end as telegram_webhook_secrets_ref_not_blank_check_is_expected,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else exists (
      select 1
      from pg_constraint con
      where con.conrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and con.conname = 'telegram_webhook_secrets_hash_not_blank_check'
        and con.contype = 'c'
        and con.convalidated
        and regexp_replace(
          lower(pg_get_constraintdef(con.oid)),
          '[^a-z0-9_>]+',
          '',
          'g'
        ) = 'checklengthbtrimwebhook_secret_hash>0'
    )
  end as telegram_webhook_secrets_hash_not_blank_check_is_expected,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else exists (
      select 1
      from pg_index idx
      join pg_class index_rel on index_rel.oid = idx.indexrelid
      where idx.indrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and index_rel.relname = 'telegram_webhook_secrets_active_session_key'
        and idx.indisunique
        and idx.indisvalid
        and idx.indisready
        and idx.indnkeyatts = 1
        and idx.indnatts = 1
        and pg_get_indexdef(idx.indexrelid, 1, true) = 'telegram_session_id'
        and regexp_replace(
          lower(pg_get_expr(idx.indpred, idx.indrelid, true)),
          '[^a-z0-9_]+',
          '',
          'g'
        ) = 'revoked_atisnull'
    )
  end as telegram_webhook_secrets_active_session_index_is_expected,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else exists (
      select 1
      from pg_index idx
      join pg_class index_rel on index_rel.oid = idx.indexrelid
      where idx.indrelid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and index_rel.relname = 'telegram_webhook_secrets_active_hash_key'
        and idx.indisunique
        and idx.indisvalid
        and idx.indisready
        and idx.indnkeyatts = 1
        and idx.indnatts = 1
        and pg_get_indexdef(idx.indexrelid, 1, true) = 'webhook_secret_hash'
        and regexp_replace(
          lower(pg_get_expr(idx.indpred, idx.indrelid, true)),
          '[^a-z0-9_]+',
          '',
          'g'
        ) = 'revoked_atisnull'
    )
  end as telegram_webhook_secrets_active_hash_index_is_expected,
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
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) as acl
      where rel.oid = telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid
        and acl.grantee = 0::oid
    )
  end as public_has_no_direct_telegram_webhook_secrets_privileges,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not (
      coalesce(has_table_privilege(
        'anon',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'select'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'insert'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'update'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'trigger'
      ), false)
    )
  end as anon_has_no_direct_telegram_webhook_secrets_privileges,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not (
      coalesce(has_table_privilege(
        'authenticated',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'select'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'insert'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'update'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
        'trigger'
      ), false)
    )
  end as auth_has_no_direct_telegram_webhook_secrets_privileges,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'delete'
    ), false)
  end as service_role_cannot_delete_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'truncate'
    ), false)
  end as service_role_cannot_truncate_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'references'
    ), false)
  end as service_role_cannot_reference_telegram_webhook_secrets,
  case
    when telegram_webhook_receiver_objects.telegram_webhook_secrets_table is null then false
    else not coalesce(has_table_privilege(
      'service_role',
      telegram_webhook_receiver_objects.telegram_webhook_secrets_table::oid,
      'trigger'
    ), false)
  end as service_role_cannot_trigger_telegram_webhook_secrets,
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
    else exists (
      select 1
      from pg_proc proc
      join pg_language lang on lang.oid = proc.prolang
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
        and lang.lanname = 'sql'
    )
  end as resolve_telegram_webhook_session_uses_sql_language,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
        and proc.provolatile = 's'
    )
  end as resolve_telegram_webhook_session_is_stable,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
        and proc.prosecdef
    )
  end as resolve_telegram_webhook_session_is_security_definer,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
        and exists (
          select 1
          from unnest(coalesce(proc.proconfig, array[]::text[])) as config(setting)
          where regexp_replace(lower(config.setting), '[[:space:]]+', '', 'g')
            = 'search_path=pg_catalog,public,pg_temp'
        )
    )
  end as resolve_telegram_webhook_session_has_restricted_search_path,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
        and proc.proretset
        and coalesce(
          (
            select array_agg(proc.proargnames[position] order by position)
            from generate_subscripts(proc.proargmodes, 1) as positions(position)
            where proc.proargmodes[position] = 't'::"char"
          ),
          array[]::text[]
        ) = array[
          'session_id',
          'agent_id',
          'workspace_id',
          'owner_user_id',
          'bot_handle',
          'webhook_status'
        ]::text[]
        and coalesce(
          (
            select array_agg(
              format_type(proc.proallargtypes[position], null)
              order by position
            )
            from generate_subscripts(proc.proargmodes, 1) as positions(position)
            where proc.proargmodes[position] = 't'::"char"
          ),
          array[]::text[]
        ) = array[
          'uuid',
          'uuid',
          'uuid',
          'uuid',
          'text',
          'text'
        ]::text[]
    )
  end as resolve_telegram_webhook_session_has_expected_result_contract,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then null
    else (
      select pg_get_userbyid(proc.proowner)
      from pg_proc proc
      where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
    )
  end as resolve_telegram_webhook_session_owner_name,
  case
    when telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc is null then false
    else coalesce(
      (
        select pg_get_userbyid(proc.proowner)
          not in ('anon', 'authenticated', 'service_role')
        from pg_proc proc
        where proc.oid = telegram_webhook_receiver_objects.resolve_telegram_webhook_session_rpc::oid
      ),
      false
    )
  end as resolve_telegram_webhook_session_owner_is_not_runtime_role,
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
