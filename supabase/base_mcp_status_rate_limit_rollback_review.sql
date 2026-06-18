-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Disable KYRA_BASE_MCP_PREP_ENABLED before running this rollback.

begin;

revoke all on function public.consume_base_mcp_status_rate_limit(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
drop function if exists public.consume_base_mcp_status_rate_limit(uuid, uuid, uuid);

revoke all privileges on public.base_mcp_status_rate_limits
  from public, anon, authenticated, service_role;
drop table if exists public.base_mcp_status_rate_limits;

commit;
