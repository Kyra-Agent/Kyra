-- REVIEW VERIFIER - DO NOT APPLY AS A MIGRATION.
-- Run manually only after an explicitly approved prepared-action storage
-- forward packet is applied to the intended Supabase project.
-- This verifier returns booleans only and does not expose row data, secrets,
-- provider payloads, calldata, wallet addresses, Telegram token refs, API keys,
-- or transaction hashes.

with prepared_action_objects as (
  select
    to_regclass('public.prepared_actions') as prepared_actions_table,
    to_regclass('public.prepared_action_owner_summaries') as owner_summary_view
)
select
  prepared_action_objects.prepared_actions_table is not null
    as prepared_actions_table_exists,
  prepared_action_objects.owner_summary_view is not null
    as prepared_action_owner_summaries_view_exists,
  case
    when prepared_action_objects.prepared_actions_table is null then false
    else coalesce(
      (
        select rel.relrowsecurity
        from pg_class rel
        where rel.oid = prepared_action_objects.prepared_actions_table::oid
      ),
      false
    )
  end as prepared_actions_rls_enabled,
  case
    when prepared_action_objects.prepared_actions_table is null then false
    else exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'prepared_actions'
        and policyname = 'Workspace owners can read prepared actions'
        and cmd = 'SELECT'
    )
  end as prepared_actions_owner_select_policy_present,
  coalesce(
    (
      select array_agg(column_name::text order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prepared_action_owner_summaries'
    ) = array[
      'id',
      'workspace_id',
      'agent_id',
      'action_kind',
      'chain',
      'status',
      'risk',
      'route_summary',
      'value_summary',
      'approval_requirement',
      'expires_at',
      'created_at',
      'safety_note'
    ]::text[],
    false
  ) as owner_summary_view_has_expected_columns,
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('prepared_actions', 'prepared_action_owner_summaries')
      and column_name in (
        'raw_provider_payload',
        'raw_calldata',
        'wallet_address',
        'private_key',
        'seed_phrase',
        'telegram_token_ref',
        'telegram_bot_token',
        'api_key',
        'tx_hash'
      )
  ) as prepared_action_storage_excludes_forbidden_columns,
  case
    when prepared_action_objects.prepared_actions_table is null then false
    else exists (
      select 1
      from pg_constraint con
      where con.conrelid = prepared_action_objects.prepared_actions_table::oid
        and con.conname = 'prepared_actions_request_unique'
        and con.contype = 'u'
        and con.convalidated
        and con.conkey = array[
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = prepared_action_objects.prepared_actions_table::oid
              and att.attname = 'workspace_id'
              and not att.attisdropped
          ),
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = prepared_action_objects.prepared_actions_table::oid
              and att.attname = 'agent_id'
              and not att.attisdropped
          ),
          (
            select att.attnum
            from pg_attribute att
            where att.attrelid = prepared_action_objects.prepared_actions_table::oid
              and att.attname = 'request_id'
              and not att.attisdropped
          )
        ]::smallint[]
    )
  end as prepared_actions_request_unique_is_expected,
  case
    when prepared_action_objects.prepared_actions_table is null then false
    else exists (
      select 1
      from pg_constraint con
      where con.conrelid = prepared_action_objects.prepared_actions_table::oid
        and con.conname = 'prepared_actions_action_kind_check'
        and con.contype = 'c'
        and con.convalidated
        and position(
          'base_mcp_status_check'
          in lower(pg_get_constraintdef(con.oid))
        ) > 0
    )
  end as prepared_actions_action_kind_check_is_expected,
  case
    when prepared_action_objects.prepared_actions_table is null then false
    else not exists (
      select 1
      from pg_class rel
      cross join aclexplode(
        coalesce(rel.relacl, acldefault('r', rel.relowner))
      ) as acl
      where rel.oid = prepared_action_objects.prepared_actions_table::oid
        and acl.grantee = 0::oid
    )
    and not (
      coalesce(has_table_privilege(
        'anon',
        prepared_action_objects.prepared_actions_table::oid,
        'select'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        prepared_action_objects.prepared_actions_table::oid,
        'insert'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        prepared_action_objects.prepared_actions_table::oid,
        'update'
      ), false)
      or coalesce(has_table_privilege(
        'anon',
        prepared_action_objects.prepared_actions_table::oid,
        'delete'
      ), false)
    )
  end as anon_has_no_prepared_actions_privileges,
  case
    when prepared_action_objects.owner_summary_view is null then false
    else not coalesce(has_table_privilege(
      'anon',
      prepared_action_objects.owner_summary_view::oid,
      'select'
    ), false)
  end as anon_cannot_select_owner_summary_view,
  case
    when prepared_action_objects.prepared_actions_table is null then false
    else not coalesce(has_table_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'id',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'workspace_id',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'agent_id',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'action_kind',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'chain',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'status',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'risk',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'route_summary',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'value_summary',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'approval_requirement',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'expires_at',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'created_at',
      'select'
    ), false)
    and coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'safety_note',
      'select'
    ), false)
    and not coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'request_id',
      'select'
    ), false)
    and not coalesce(has_column_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'provider_payload_ref',
      'select'
    ), false)
    and not coalesce(has_table_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'insert'
    ), false)
    and not coalesce(has_table_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'update'
    ), false)
    and not coalesce(has_table_privilege(
      'authenticated',
      prepared_action_objects.prepared_actions_table::oid,
      'delete'
    ), false)
  end as authenticated_prepared_actions_privileges_are_expected,
  case
    when prepared_action_objects.prepared_actions_table is null then false
    else coalesce(has_table_privilege(
      'service_role',
      prepared_action_objects.prepared_actions_table::oid,
      'select'
    ), false)
    and coalesce(has_table_privilege(
      'service_role',
      prepared_action_objects.prepared_actions_table::oid,
      'insert'
    ), false)
    and coalesce(has_table_privilege(
      'service_role',
      prepared_action_objects.prepared_actions_table::oid,
      'update'
    ), false)
    and not coalesce(has_table_privilege(
      'service_role',
      prepared_action_objects.prepared_actions_table::oid,
      'delete'
    ), false)
  end as service_role_prepared_actions_privileges_are_expected
from prepared_action_objects;
