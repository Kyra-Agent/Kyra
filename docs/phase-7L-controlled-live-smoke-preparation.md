# Phase 7L Controlled Live Smoke Preparation

Date: 2026-06-19

Status: local preparation complete; production gate remains disabled.

## Objective

Prepare one owner-dashboard, read-only Base MCP status smoke without enabling a
wallet prompt, write, signing, transaction submission, Telegram execution, or
prepared-action storage write.

## Provider Decision

The current adapter requires Kyra's reviewed `kyra_status_v1` contract at
`POST /status-check`. A direct probe on 2026-06-19 observed that
`https://mcp.base.org/` requires Bearer authentication and its `/status-check`
path returns 404. It is therefore not approved for this custom adapter.

No production provider endpoint is selected. Do not point Kyra at a generic MCP
server or infer an undocumented protocol.

## Added Safety Controls

- Exact provider protocol gate: `KYRA_BASE_MCP_PROVIDER_PROTOCOL=kyra_status_v1`.
- Service-role-only persistent rate limit: 6 checks per agent per minute and 60
  per agent per hour.
- Ownership is verified before rate-limit consumption.
- Owner identifiers are not persisted in the rate-limit table.
- Provider configuration is verified before rate-limit consumption.
- Rate-limit failures reject before the provider call.
- Responses expose only the bounded request id and outcome headers.
- No external observability sink, raw payload log, user id log, wallet data, or
  Telegram token data is added.

## Review-Only Database Packet

- `supabase/base_mcp_status_rate_limit_forward_review.sql`
- `supabase/verify_base_mcp_status_rate_limit_contract.sql`
- `supabase/base_mcp_status_rate_limit_rollback_review.sql`

These files are not applied by application code. Review and run the verifier in
the target Supabase project before any gate is enabled.

## Controlled Smoke Sequence

1. Confirm the provider implements the exact bounded `kyra_status_v1` contract.
2. Review and apply the rate-limit SQL packet; run the boolean-only verifier.
3. Deploy the already-reviewed Edge Function while the runtime gate is off.
4. Set backend-only endpoint, API key if required, timeout, and protocol.
5. Confirm Telegram and public pages still have no Base MCP caller.
6. Set `KYRA_BASE_MCP_PREP_ENABLED=true` only for the approved smoke window.
7. From one owner dashboard, click `Check Base MCP status` once.
8. Expect a bounded read-only preview and matching correlation headers.
9. Confirm no wallet prompt, write, signature, transaction, or raw payload.
10. Disable the runtime gate immediately after evidence is collected.

## Rollback

1. Set `KYRA_BASE_MCP_PREP_ENABLED=false` first.
2. Remove or rotate the provider API key and endpoint secrets if compromised.
3. Redeploy the Edge Function only if code rollback is required.
4. Run the reviewed SQL rollback only after the function gate is confirmed off.
5. Re-run Phase 7 checks and verify Telegram remains read-only.

## Done Criteria

- Local tests and checkers pass.
- SQL remains review-only until explicit production approval.
- A compatible provider is documented and approved.
- Gate is default-off before and after the smoke.
- Wallet security and Telegram token privacy remain unchanged.
