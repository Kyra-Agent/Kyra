-- READ-ONLY VERIFIER - SAFE TO RUN BEFORE OR AFTER AN APPROVED APPLY.
-- This query does not create, alter, grant, revoke, insert, update, or delete.
-- Before the owner-link challenge schema exists, guarded contract checks return
-- false instead of raising object-not-found errors.

with owner_link_objects as (
  select
    to_regclass(
      'public.telegram_owner_link_challenges'
    ) as challenge_table,
    to_regprocedure(
      'public.issue_telegram_owner_link_challenge(uuid,uuid,uuid,text,timestamptz)'
    ) as issue_rpc,
    to_regprocedure(
      'public.consume_telegram_owner_link_challenge(uuid,bigint,text,text,text)'
    ) as consume_rpc
)
select
  owner_link_objects.challenge_table is not null
    as telegram_owner_link_challenges_table_exists,
  case
    when owner_link_objects.challenge_table is null then false
    else exists (
      select 1
      from pg_class rel
      where rel.oid = owner_link_objects.challenge_table::oid
        and rel.relkind = 'r'
        and rel.relrowsecurity
    )
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'telegram_owner_link_challenges'
    )
    and coalesce(
      (
        select array_agg(
          format('%s:%s:%s', column_name, udt_name, is_nullable)
          order by ordinal_position
        )
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'telegram_owner_link_challenges'
      ) = array[
        'id:uuid:NO',
        'agent_id:uuid:NO',
        'telegram_session_id:uuid:NO',
        'issued_by_user_id:uuid:NO',
        'challenge_hash:text:NO',
        'expires_at:timestamptz:NO',
        'created_at:timestamptz:NO',
        'consumed_at:timestamptz:YES',
        'revoked_at:timestamptz:YES'
      ]::text[],
      false
    )
    and coalesce(
      (
        select regexp_replace(
          lower(column_default),
          '[[:space:]()]',
          '',
          'g'
        ) = 'gen_random_uuid'
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'telegram_owner_link_challenges'
          and column_name = 'id'
      ),
      false
    )
    and coalesce(
      (
        select regexp_replace(
          lower(column_default),
          '[[:space:]()]',
          '',
          'g'
        ) = 'now'
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'telegram_owner_link_challenges'
          and column_name = 'created_at'
      ),
      false
    )
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'telegram_owner_link_challenges'
        and column_name <> all(array['id', 'created_at']::text[])
        and column_default is not null
    )
  end as telegram_owner_link_challenges_table_contract_is_expected,
  case
    when owner_link_objects.challenge_table is null then false
    else (
      select count(*) = 9
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.convalidated
        and con.conname = any(array[
          'telegram_owner_link_challenges_pkey',
          'telegram_owner_link_challenges_agent_fkey',
          'telegram_owner_link_challenges_session_fkey',
          'telegram_owner_link_challenges_issuer_fkey',
          'telegram_owner_link_challenges_hash_not_blank_check',
          'telegram_owner_link_challenges_hash_format_check',
          'telegram_owner_link_challenges_expiry_after_creation_check',
          'telegram_owner_link_challenges_consumed_after_creation_check',
          'telegram_owner_link_challenges_revoked_after_creation_check'
        ]::text[])
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_pkey'
        and con.contype = 'p'
        and con.convalidated
        and con.conkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = owner_link_objects.challenge_table::oid
              and att.attname = 'id'
              and not att.attisdropped
          )
        ]::smallint[]
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_agent_fkey'
        and con.contype = 'f'
        and con.convalidated
        and con.confrelid = to_regclass('public.agent_instances')
        and con.confdeltype = 'c'
        and con.conkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = owner_link_objects.challenge_table::oid
              and att.attname = 'agent_id'
              and not att.attisdropped
          )
        ]::smallint[]
        and con.confkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = to_regclass('public.agent_instances')
              and att.attname = 'id'
              and not att.attisdropped
          )
        ]::smallint[]
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_session_fkey'
        and con.contype = 'f'
        and con.convalidated
        and con.confrelid = to_regclass('public.telegram_sessions')
        and con.confdeltype = 'c'
        and con.conkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = owner_link_objects.challenge_table::oid
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
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_issuer_fkey'
        and con.contype = 'f'
        and con.convalidated
        and con.confrelid = to_regclass('auth.users')
        and con.confdeltype = 'c'
        and con.conkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = owner_link_objects.challenge_table::oid
              and att.attname = 'issued_by_user_id'
              and not att.attisdropped
          )
        ]::smallint[]
        and con.confkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = to_regclass('auth.users')
              and att.attname = 'id'
              and not att.attisdropped
          )
        ]::smallint[]
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_hash_not_blank_check'
        and con.contype = 'c'
        and con.convalidated
        and regexp_replace(
          lower(pg_get_constraintdef(con.oid)),
          '[^a-z0-9_>]+',
          '',
          'g'
        ) = 'checklengthbtrimchallenge_hash>0'
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_hash_format_check'
        and con.contype = 'c'
        and con.convalidated
        and replace(
          regexp_replace(
            lower(pg_get_constraintdef(con.oid)),
            '[[:space:]()]',
            '',
            'g'
          ),
          '::text',
          ''
        ) = 'checkchallenge_hash~''^[0-9a-f]{64}$'''
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_expiry_after_creation_check'
        and con.contype = 'c'
        and con.convalidated
        and regexp_replace(
          lower(pg_get_constraintdef(con.oid)),
          '[^a-z0-9_>=]+',
          '',
          'g'
        ) = 'checkexpires_at>created_at'
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_consumed_after_creation_check'
        and con.contype = 'c'
        and con.convalidated
        and regexp_replace(
          lower(pg_get_constraintdef(con.oid)),
          '[^a-z0-9_>=]+',
          '',
          'g'
        ) = 'checkconsumed_atisnullorconsumed_at>=created_at'
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = owner_link_objects.challenge_table::oid
        and con.conname = 'telegram_owner_link_challenges_revoked_after_creation_check'
        and con.contype = 'c'
        and con.convalidated
        and regexp_replace(
          lower(pg_get_constraintdef(con.oid)),
          '[^a-z0-9_>=]+',
          '',
          'g'
        ) = 'checkrevoked_atisnullorrevoked_at>=created_at'
    )
  end as telegram_owner_link_challenges_constraints_are_expected,
  case
    when owner_link_objects.challenge_table is null then false
    else (
      select count(*) = 3
      from pg_index idx
      join pg_class index_rel on index_rel.oid = idx.indexrelid
      where idx.indrelid = owner_link_objects.challenge_table::oid
        and index_rel.relname = any(array[
          'telegram_owner_link_challenges_active_agent_key',
          'telegram_owner_link_challenges_active_session_key',
          'telegram_owner_link_challenges_active_hash_key'
        ]::text[])
        and idx.indisunique
        and idx.indisvalid
        and idx.indisready
        and idx.indnkeyatts = 1
        and idx.indnatts = 1
        and pg_get_indexdef(idx.indexrelid, 1, true) = case index_rel.relname
          when 'telegram_owner_link_challenges_active_agent_key'
            then 'agent_id'
          when 'telegram_owner_link_challenges_active_session_key'
            then 'telegram_session_id'
          when 'telegram_owner_link_challenges_active_hash_key'
            then 'challenge_hash'
        end
        and regexp_replace(
          lower(pg_get_expr(idx.indpred, idx.indrelid, true)),
          '[^a-z0-9_]+',
          '',
          'g'
        ) = 'consumed_atisnullandrevoked_atisnull'
    )
  end as telegram_owner_link_challenges_indexes_are_expected,
  case
    when owner_link_objects.challenge_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(
        coalesce(rel.relacl, acldefault('r', rel.relowner))
      ) as acl
      where rel.oid = owner_link_objects.challenge_table::oid
        and acl.grantee = 0::oid
    )
    and not (
      coalesce(has_table_privilege(
        'anon',
        owner_link_objects.challenge_table::oid,
        'select'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        owner_link_objects.challenge_table::oid,
        'insert'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        owner_link_objects.challenge_table::oid,
        'update'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        owner_link_objects.challenge_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        owner_link_objects.challenge_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        owner_link_objects.challenge_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        owner_link_objects.challenge_table::oid,
        'trigger'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        owner_link_objects.challenge_table::oid,
        'select'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        owner_link_objects.challenge_table::oid,
        'insert'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        owner_link_objects.challenge_table::oid,
        'update'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        owner_link_objects.challenge_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        owner_link_objects.challenge_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        owner_link_objects.challenge_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        owner_link_objects.challenge_table::oid,
        'trigger'
      ), false)
    )
  end as browser_roles_have_no_owner_link_challenge_privileges,
  case
    when owner_link_objects.challenge_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      owner_link_objects.challenge_table::oid,
      'select'
    ), false)
    and coalesce(has_table_privilege(
      'service_role',
      owner_link_objects.challenge_table::oid,
      'insert'
    ), false)
    and coalesce(has_table_privilege(
      'service_role',
      owner_link_objects.challenge_table::oid,
      'update'
    ), false)
    and not (
      coalesce(has_table_privilege(
        'service_role',
        owner_link_objects.challenge_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'service_role',
        owner_link_objects.challenge_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'service_role',
        owner_link_objects.challenge_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'service_role',
        owner_link_objects.challenge_table::oid,
        'trigger'
      ), false)
    )
  end as service_role_owner_link_challenge_privileges_are_expected,
  owner_link_objects.issue_rpc is not null
    as issue_telegram_owner_link_challenge_function_exists,
  case
    when owner_link_objects.issue_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      join pg_language lang on lang.oid = proc.prolang
      where proc.oid = owner_link_objects.issue_rpc::oid
        and lang.lanname = 'plpgsql'
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
  end as issue_telegram_owner_link_challenge_security_contract_is_expected,
  case
    when owner_link_objects.issue_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = owner_link_objects.issue_rpc::oid
        and proc.proretset
        and coalesce(
          (
            select array_agg(proc.proargnames[position] order by position)
            from generate_subscripts(proc.proargmodes, 1) as positions(position)
            where proc.proargmodes[position] = 't'::"char"
          ),
          array[]::text[]
        ) = array['issued', 'status']::text[]
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
        ) = array['boolean', 'text']::text[]
    )
  end as issue_telegram_owner_link_challenge_result_contract_is_expected,
  case
    when owner_link_objects.issue_rpc is null then false
    else exists (
      select 1
      from (
        select regexp_replace(
          lower(pg_get_functiondef(proc.oid)),
          '[[:space:]()]+',
          '',
          'g'
        ) as definition
        from pg_proc proc
        where proc.oid = owner_link_objects.issue_rpc::oid
      ) normalized
      where position('pg_advisory_xact_lock' in normalized.definition) > 0
        and position('public.workspaces' in normalized.definition) > 0
        and position('public.agent_instances' in normalized.definition) > 0
        and position('public.telegram_sessions' in normalized.definition) > 0
        and position(
          'public.telegram_chat_authorizations'
          in normalized.definition
        ) > 0
        and position('agents.id=p_agent_id' in normalized.definition) > 0
        and position('sessions.id=p_telegram_session_id' in normalized.definition) > 0
        and position('sessions.agent_id=agents.id' in normalized.definition) > 0
        and position(
          'public.telegram_owner_link_challenges'
          in normalized.definition
        ) > 0
        and position('owner_user_id=p_issued_by_user_id' in normalized.definition) > 0
        and position(
          'authorizations.agent_id=agents.id'
          in normalized.definition
        ) > 0
        and position('authorizations.revoked_atisnull' in normalized.definition) > 0
        and position('webhook_status=''active''' in normalized.definition) > 0
        and position('interval''10minutes''' in normalized.definition) > 0
        and position('insertintopublic.telegram_owner_link_challenges' in normalized.definition) > 0
        and position('updatepublic.telegram_owner_link_challenges' in normalized.definition) > 0
    )
  end as issue_telegram_owner_link_challenge_definition_contract_is_expected,
  case
    when owner_link_objects.issue_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(
        coalesce(proc.proacl, acldefault('f', proc.proowner))
      ) as acl
      where proc.oid = owner_link_objects.issue_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
    and not coalesce(has_function_privilege(
      'anon',
      owner_link_objects.issue_rpc::oid,
      'execute'
    ), false)
    and not coalesce(has_function_privilege(
      'authenticated',
      owner_link_objects.issue_rpc::oid,
      'execute'
    ), false)
    and coalesce(has_function_privilege(
      'service_role',
      owner_link_objects.issue_rpc::oid,
      'execute'
    ), false)
  end as issue_telegram_owner_link_challenge_privileges_are_expected,
  owner_link_objects.consume_rpc is not null
    as consume_telegram_owner_link_challenge_function_exists,
  case
    when owner_link_objects.consume_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      join pg_language lang on lang.oid = proc.prolang
      where proc.oid = owner_link_objects.consume_rpc::oid
        and lang.lanname = 'plpgsql'
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
  end as consume_telegram_owner_link_challenge_security_contract_is_expected,
  case
    when owner_link_objects.consume_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = owner_link_objects.consume_rpc::oid
        and proc.proretset
        and coalesce(
          (
            select array_agg(proc.proargnames[position] order by position)
            from generate_subscripts(proc.proargmodes, 1) as positions(position)
            where proc.proargmodes[position] = 't'::"char"
          ),
          array[]::text[]
        ) = array['linked', 'status']::text[]
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
        ) = array['boolean', 'text']::text[]
    )
  end as consume_telegram_owner_link_challenge_result_contract_is_expected,
  case
    when owner_link_objects.consume_rpc is null then false
    else exists (
      select 1
      from (
        select regexp_replace(
          lower(pg_get_functiondef(proc.oid)),
          '[[:space:]()]+',
          '',
          'g'
        ) as definition
        from pg_proc proc
        where proc.oid = owner_link_objects.consume_rpc::oid
      ) normalized
      where position('pg_advisory_xact_lock' in normalized.definition) > 0
        and position('public.workspaces' in normalized.definition) > 0
        and position('public.agent_instances' in normalized.definition) > 0
        and position('public.telegram_sessions' in normalized.definition) > 0
        and position(
          'public.telegram_owner_link_challenges'
          in normalized.definition
        ) > 0
        and position(
          'public.telegram_processed_updates'
          in normalized.definition
        ) > 0
        and position(
          'public.telegram_chat_authorizations'
          in normalized.definition
        ) > 0
        and position('p_telegram_user_id<>p_telegram_chat_id' in normalized.definition) > 0
        and position('p_telegram_update_id<0' in normalized.definition) > 0
        and position(
          'challenges.telegram_session_id=p_telegram_session_id'
          in normalized.definition
        ) > 0
        and position(
          'challenges.challenge_hash=p_challenge_hash'
          in normalized.definition
        ) > 0
        and position(
          'sessions.agent_id=challenges.agent_id'
          in normalized.definition
        ) > 0
        and position(
          'owner_user_id=challenges.issued_by_user_id'
          in normalized.definition
        ) > 0
        and position(
          'authorizations.agent_id=challenges.agent_id'
          in normalized.definition
        ) > 0
        and position('authorizations.revoked_atisnull' in normalized.definition) > 0
        and position('webhook_status=''active''' in normalized.definition) > 0
        and position('consumed_atisnull' in normalized.definition) > 0
        and position('revoked_atisnull' in normalized.definition) > 0
        and position('expires_at>pg_catalog.now' in normalized.definition) > 0
        and position(
          'insertintopublic.telegram_processed_updates'
          in normalized.definition
        ) > 0
        and position(
          'updatepublic.telegram_owner_link_challenges'
          in normalized.definition
        ) > 0
        and position(
          'insertintopublic.telegram_chat_authorizations'
          in normalized.definition
        ) > 0
        and position('onconflict' in normalized.definition) > 0
        and position('''owner''' in normalized.definition) > 0
        and position('''read_only''' in normalized.definition) > 0
    )
  end as consume_telegram_owner_link_challenge_definition_contract_is_expected,
  case
    when owner_link_objects.consume_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(
        coalesce(proc.proacl, acldefault('f', proc.proowner))
      ) as acl
      where proc.oid = owner_link_objects.consume_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
    and not coalesce(has_function_privilege(
      'anon',
      owner_link_objects.consume_rpc::oid,
      'execute'
    ), false)
    and not coalesce(has_function_privilege(
      'authenticated',
      owner_link_objects.consume_rpc::oid,
      'execute'
    ), false)
    and coalesce(has_function_privilege(
      'service_role',
      owner_link_objects.consume_rpc::oid,
      'execute'
    ), false)
  end as consume_telegram_owner_link_challenge_privileges_are_expected,
  case
    when to_regclass('public.telegram_session_summaries') is null then false
    else not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'telegram_session_summaries'
        and column_name = any(array[
          'challenge_hash',
          'issued_by_user_id',
          'consumed_at',
          'revoked_at'
        ]::text[])
    )
  end as telegram_session_summaries_excludes_owner_link_challenge_fields
from owner_link_objects;
