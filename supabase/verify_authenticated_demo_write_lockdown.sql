select
  has_table_privilege('authenticated', 'public.workspaces', 'select') as auth_can_read_workspaces,
  has_table_privilege('authenticated', 'public.workspaces', 'insert') as auth_can_insert_workspaces,
  has_table_privilege('authenticated', 'public.agent_instances', 'insert') as auth_can_insert_agents,
  has_table_privilege('authenticated', 'public.wallet_policies', 'insert') as auth_can_insert_wallet_policies,
  has_table_privilege('authenticated', 'public.approval_requests', 'insert') as auth_can_insert_approval_requests,
  has_table_privilege('authenticated', 'public.activity_logs', 'insert') as auth_can_insert_activity_logs,
  has_table_privilege('authenticated', 'public.telegram_sessions', 'insert') as auth_can_insert_telegram_sessions,
  has_table_privilege('service_role', 'public.agent_instances', 'insert') as service_role_can_insert_agents,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_instances'
      and policyname = 'Workspace owners can read agent instances'
      and cmd = 'SELECT'
  ) as owner_agent_read_policy_present;
