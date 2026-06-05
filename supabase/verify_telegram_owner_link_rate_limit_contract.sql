-- READ-ONLY VERIFIER - SAFE TO RUN BEFORE OR AFTER AN APPROVED APPLY.
-- This query does not create, alter, grant, revoke, insert, update, or delete.
-- Before the durable owner-link limiter objects exist, guarded checks return
-- false instead of raising object-not-found errors.

with rate_limit_objects as (
  select
    to_regclass(
      'public.telegram_owner_link_consume_rate_limits'
    ) as limiter_table,
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
  rate_limit_objects.limiter_table is not null
    as telegram_owner_link_consume_rate_limits_table_exists,
  case
    when rate_limit_objects.limiter_table is null then false
    else exists (
      select 1
      from pg_class rel
      where rel.oid = rate_limit_objects.limiter_table::oid
        and rel.relkind = 'r'
        and rel.relrowsecurity
    )
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'telegram_owner_link_consume_rate_limits'
    )
    and coalesce(
      (
        select array_agg(
          format('%s:%s:%s', column_name, udt_name, is_nullable)
          order by ordinal_position
        )
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'telegram_owner_link_consume_rate_limits'
      ) = array[
        'id:uuid:NO',
        'telegram_session_id:uuid:NO',
        'scope:text:NO',
        'telegram_user_id:text:YES',
        'window_started_at:timestamptz:NO',
        'attempt_count:int4:NO',
        'blocked_until:timestamptz:YES',
        'updated_at:timestamptz:NO'
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
          and table_name = 'telegram_owner_link_consume_rate_limits'
          and column_name = 'id'
      ),
      false
    )
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'telegram_owner_link_consume_rate_limits'
        and column_name <> 'id'
        and column_default is not null
    )
  end as telegram_owner_link_consume_rate_limits_table_contract_is_expected,
  case
    when rate_limit_objects.limiter_table is null then false
    else (
      select count(*) = 7
      from pg_constraint con
      where con.conrelid = rate_limit_objects.limiter_table::oid
        and con.convalidated
        and con.conname = any(array[
          'telegram_owner_link_consume_rate_limits_pkey',
          'telegram_owner_link_consume_rate_limits_session_fkey',
          'telegram_owner_link_consume_rate_limits_scope_check',
          'telegram_owner_link_consume_rate_limits_scope_identity_check',
          'telegram_owner_link_consume_rate_limits_attempt_count_check',
          'telegram_owner_link_consume_rate_limits_updated_after_window_check',
          'telegram_owner_link_consume_rate_limits_blocked_after_window_check'
        ]::text[])
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = rate_limit_objects.limiter_table::oid
        and con.conname = 'telegram_owner_link_consume_rate_limits_pkey'
        and con.contype = 'p'
        and con.convalidated
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = rate_limit_objects.limiter_table::oid
        and con.conname = 'telegram_owner_link_consume_rate_limits_session_fkey'
        and con.contype = 'f'
        and con.convalidated
        and con.confrelid = to_regclass('public.telegram_sessions')
        and con.confdeltype = 'c'
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = rate_limit_objects.limiter_table::oid
        and con.conname = 'telegram_owner_link_consume_rate_limits_scope_check'
        and con.contype = 'c'
        and con.convalidated
        and position(
          'scope'
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
        and position(
          '''session'''
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
        and position(
          '''identity'''
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = rate_limit_objects.limiter_table::oid
        and con.conname =
          'telegram_owner_link_consume_rate_limits_scope_identity_check'
        and con.contype = 'c'
        and con.convalidated
        and position(
          'telegram_user_id'
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
        and position(
          'blocked_until'
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
        and position(
          'attempt_count'
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
        and position(
          'is not null'
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
        and position(
          '{0,15}'
          in pg_get_constraintdef(con.oid)
        ) > 0
    )
    and exists (
      select 1
      from pg_constraint con
      where con.conrelid = rate_limit_objects.limiter_table::oid
        and con.conname =
          'telegram_owner_link_consume_rate_limits_attempt_count_check'
        and con.contype = 'c'
        and con.convalidated
        and position('30' in pg_get_constraintdef(con.oid)) > 0
        and position('5' in pg_get_constraintdef(con.oid)) > 0
    )
  end as telegram_owner_link_consume_rate_limits_constraints_are_expected,
  case
    when rate_limit_objects.limiter_table is null then false
    else (
      select count(*) = 2
      from pg_index idx
      join pg_class index_rel on index_rel.oid = idx.indexrelid
      where idx.indrelid = rate_limit_objects.limiter_table::oid
        and index_rel.relname = any(array[
          'telegram_owner_link_consume_rate_limits_session_key',
          'telegram_owner_link_consume_rate_limits_identity_key'
        ]::text[])
        and idx.indisunique
        and idx.indisvalid
        and idx.indisready
        and idx.indpred is not null
        and idx.indnkeyatts = case index_rel.relname
          when 'telegram_owner_link_consume_rate_limits_session_key' then 1
          else 2
        end
        and pg_get_indexdef(idx.indexrelid, 1, true) = 'telegram_session_id'
        and (
          index_rel.relname = 'telegram_owner_link_consume_rate_limits_session_key'
          or pg_get_indexdef(idx.indexrelid, 2, true) = 'telegram_user_id'
        )
        and position(
          case index_rel.relname
            when 'telegram_owner_link_consume_rate_limits_session_key'
              then 'session'
            else 'identity'
          end
          in lower(pg_get_expr(idx.indpred, idx.indrelid, true))
        ) > 0
    )
  end as telegram_owner_link_consume_rate_limits_indexes_are_expected,
  case
    when rate_limit_objects.challenge_table is null then false
    else (
      select count(*) = 3
      from pg_index idx
      join pg_class index_rel on index_rel.oid = idx.indexrelid
      where idx.indrelid = rate_limit_objects.challenge_table::oid
        and index_rel.relname = any(array[
          'telegram_owner_link_challenges_agent_created_at_idx',
          'telegram_owner_link_challenges_session_created_at_idx',
          'telegram_owner_link_challenges_issuer_created_at_idx'
        ]::text[])
        and not idx.indisunique
        and idx.indisvalid
        and idx.indisready
        and idx.indpred is null
        and idx.indnkeyatts = 2
        and pg_get_indexdef(idx.indexrelid, 1, true) = case index_rel.relname
          when 'telegram_owner_link_challenges_agent_created_at_idx'
            then 'agent_id'
          when 'telegram_owner_link_challenges_session_created_at_idx'
            then 'telegram_session_id'
          else 'issued_by_user_id'
        end
        and lower(pg_get_indexdef(idx.indexrelid, 2, true)) = 'created_at desc'
    )
  end as telegram_owner_link_issue_history_indexes_are_expected,
  case
    when rate_limit_objects.limiter_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(
        coalesce(rel.relacl, acldefault('r', rel.relowner))
      ) as acl
      where rel.oid = rate_limit_objects.limiter_table::oid
        and acl.grantee = 0::oid
    )
    and not (
      coalesce(has_table_privilege(
        'anon',
        rate_limit_objects.limiter_table::oid,
        'select'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        rate_limit_objects.limiter_table::oid,
        'insert'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        rate_limit_objects.limiter_table::oid,
        'update'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        rate_limit_objects.limiter_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        rate_limit_objects.limiter_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        rate_limit_objects.limiter_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        rate_limit_objects.limiter_table::oid,
        'trigger'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        rate_limit_objects.limiter_table::oid,
        'select'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        rate_limit_objects.limiter_table::oid,
        'insert'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        rate_limit_objects.limiter_table::oid,
        'update'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        rate_limit_objects.limiter_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        rate_limit_objects.limiter_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        rate_limit_objects.limiter_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'authenticated',
        rate_limit_objects.limiter_table::oid,
        'trigger'
      ), false)
    )
  end as browser_roles_have_no_owner_link_consume_rate_limit_privileges,
  case
    when rate_limit_objects.limiter_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      rate_limit_objects.limiter_table::oid,
      'select'
    ), false)
    and coalesce(has_table_privilege(
      'service_role',
      rate_limit_objects.limiter_table::oid,
      'insert'
    ), false)
    and coalesce(has_table_privilege(
      'service_role',
      rate_limit_objects.limiter_table::oid,
      'update'
    ), false)
    and not (
      coalesce(has_table_privilege(
        'service_role',
        rate_limit_objects.limiter_table::oid,
        'delete'
      ), false)
      or coalesce(has_table_privilege(
        'service_role',
        rate_limit_objects.limiter_table::oid,
        'truncate'
      ), false)
      or coalesce(has_table_privilege(
        'service_role',
        rate_limit_objects.limiter_table::oid,
        'references'
      ), false)
      or coalesce(has_table_privilege(
        'service_role',
        rate_limit_objects.limiter_table::oid,
        'trigger'
      ), false)
    )
  end as service_role_owner_link_consume_rate_limit_privileges_are_expected,
  case
    when rate_limit_objects.issue_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      join pg_language lang on lang.oid = proc.prolang
      where proc.oid = rate_limit_objects.issue_rpc::oid
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
  end as issue_telegram_owner_link_rate_limit_security_contract_is_expected,
  case
    when rate_limit_objects.issue_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = rate_limit_objects.issue_rpc::oid
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
  end as issue_telegram_owner_link_rate_limit_result_contract_is_expected,
  case
    when rate_limit_objects.issue_rpc is null then false
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
        where proc.oid = rate_limit_objects.issue_rpc::oid
      ) normalized
      where position(
        '''telegram_owner_link_issue_owner'''
        in normalized.definition
      ) > 0
        and position(
          '''telegram_owner_link_challenge'''
          in normalized.definition
        ) > position(
          '''telegram_owner_link_issue_owner'''
          in normalized.definition
        )
        and position('interval''15minutes''' in normalized.definition) > 0
        and position('interval''24hours''' in normalized.definition) > 0
        and position('limit3' in normalized.definition) > 0
        and position('limit20' in normalized.definition) > 0
        and position('''rate_limited''' in normalized.definition) > 0
        and position('''rate_limited''' in normalized.definition)
          < position(
            'updatepublic.telegram_owner_link_challengeschallenges'
            in normalized.definition
          )
        and position('''rate_limited''' in normalized.definition)
          < position(
            'insertintopublic.telegram_owner_link_challenges'
            in normalized.definition
          )
    )
  end as issue_telegram_owner_link_rate_limit_definition_is_expected,
  case
    when rate_limit_objects.issue_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(
        coalesce(proc.proacl, acldefault('f', proc.proowner))
      ) as acl
      where proc.oid = rate_limit_objects.issue_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
    and not coalesce(has_function_privilege(
      'anon',
      rate_limit_objects.issue_rpc::oid,
      'execute'
    ), false)
    and not coalesce(has_function_privilege(
      'authenticated',
      rate_limit_objects.issue_rpc::oid,
      'execute'
    ), false)
    and coalesce(has_function_privilege(
      'service_role',
      rate_limit_objects.issue_rpc::oid,
      'execute'
    ), false)
  end as issue_telegram_owner_link_rate_limit_privileges_are_expected,
  case
    when rate_limit_objects.consume_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      join pg_language lang on lang.oid = proc.prolang
      where proc.oid = rate_limit_objects.consume_rpc::oid
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
  end as consume_telegram_owner_link_rate_limit_security_contract_is_expected,
  case
    when rate_limit_objects.consume_rpc is null then false
    else exists (
      select 1
      from pg_proc proc
      where proc.oid = rate_limit_objects.consume_rpc::oid
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
  end as consume_telegram_owner_link_rate_limit_result_contract_is_expected,
  case
    when rate_limit_objects.consume_rpc is null then false
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
        where proc.oid = rate_limit_objects.consume_rpc::oid
      ) normalized
      where position(
        '''telegram_owner_link_consume_session'''
        in normalized.definition
      ) > 0
        and position(
          '''telegram_owner_link_consume_identity'''
          in normalized.definition
        ) > position(
          '''telegram_owner_link_consume_session'''
          in normalized.definition
        )
        and position(
          'insertintopublic.telegram_processed_updates'
          in normalized.definition
        ) > position(
          '''telegram_owner_link_consume_identity'''
          in normalized.definition
        )
        and position(
          'public.telegram_owner_link_consume_rate_limits'
          in normalized.definition
        ) > position(
          'insertintopublic.telegram_processed_updates'
          in normalized.definition
        )
        and position(
          '''telegram_owner_link_challenge'''
          in normalized.definition
        ) > position(
          'public.telegram_owner_link_consume_rate_limits'
          in normalized.definition
        )
        and position(
          'frompublic.telegram_owner_link_challengeschallenges'
          in normalized.definition
        ) > position(
          'public.telegram_owner_link_consume_rate_limits'
          in normalized.definition
        )
        and position('interval''10minutes''' in normalized.definition) > 0
        and position('interval''30minutes''' in normalized.definition) > 0
        and position('attempt_count>=5' in normalized.definition) > 0
        and position('attempt_count>=30' in normalized.definition) > 0
        and position('forupdate' in normalized.definition) > 0
        and position(
          'insertintopublic.telegram_chat_authorizations'
          in normalized.definition
        ) > position(
          'frompublic.telegram_owner_link_challengeschallenges'
          in normalized.definition
        )
    )
  end as consume_telegram_owner_link_rate_limit_definition_is_expected,
  case
    when rate_limit_objects.consume_rpc is null then false
    else not exists (
      select 1
      from pg_proc proc
      cross join aclexplode(
        coalesce(proc.proacl, acldefault('f', proc.proowner))
      ) as acl
      where proc.oid = rate_limit_objects.consume_rpc::oid
        and acl.grantee = 0::oid
        and lower(acl.privilege_type) = 'execute'
    )
    and not coalesce(has_function_privilege(
      'anon',
      rate_limit_objects.consume_rpc::oid,
      'execute'
    ), false)
    and not coalesce(has_function_privilege(
      'authenticated',
      rate_limit_objects.consume_rpc::oid,
      'execute'
    ), false)
    and coalesce(has_function_privilege(
      'service_role',
      rate_limit_objects.consume_rpc::oid,
      'execute'
    ), false)
  end as consume_telegram_owner_link_rate_limit_privileges_are_expected,
  case
    when to_regclass('public.telegram_session_summaries') is null then false
    else not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any(array[
          'telegram_session_summaries',
          'public_agent_profiles'
        ]::text[])
        and column_name = any(array[
          'scope',
          'telegram_user_id',
          'window_started_at',
          'attempt_count',
          'blocked_until',
          'updated_at'
        ]::text[])
    )
  end as public_views_exclude_owner_link_rate_limit_fields
from rate_limit_objects;
