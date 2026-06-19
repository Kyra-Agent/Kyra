# Phase 7AJ Read-Only Base Live Closeout

Date: 2026-06-19

Status: one controlled read-only Base status smoke completed successfully.

Current runtime state: provider deployed, rate limiter verified, and
`KYRA_BASE_MCP_PREP_ENABLED=false`.

## Scope Completed

- Provider: Kyra-operated `base-mcp-status-provider` Edge Function.
- Provider contract: exact `kyra_status_v1`.
- Provider path: exact `POST /status-check`.
- Base verification: one bounded `eth_chainId` request.
- Expected chain: Base Mainnet, chain ID `8453`.
- Trigger: one authenticated owner dashboard.
- Result: `preview_ready`.
- Closeout result: `base_mcp_disabled` after the gate was returned to off.

## Production Evidence

- The provider and `base-mcp-prepare` functions are deployed to the linked Kyra
  Supabase project.
- Provider authentication uses one dedicated backend bearer secret.
- The secret value was generated ephemerally and was not printed, committed,
  stored in frontend configuration, or sent to Telegram.
- The rate-limit migration was the only planned database change in its dry run.
- A validation-only migration passed every required RLS, privilege, function,
  column, and constraint assertion.
- One authenticated provider health probe returned the exact six-field response
  contract.
- One owner-dashboard smoke returned `preview_ready`.
- The dashboard showed no storage write, wallet prompt, signing, or transaction
  submission.
- After the gate was disabled, a negative check returned
  `base_mcp_disabled` before any provider call.

## Preserved Boundaries

- Telegram cannot initiate Base MCP.
- Public pages cannot initiate Base MCP.
- Wallet prompts remain disabled.
- Signing and transaction submission remain disabled.
- Official Base MCP OAuth and `agent_wallet:*` scopes remain disabled.
- No owner ID, workspace ID, agent ID, wallet address, Telegram token, calldata,
  signature, transaction hash, or raw RPC response is sent to the provider.
- The public Base RPC is approved only for this controlled smoke, not sustained
  production traffic.

## Sustained-Use Blocker

Read-only Base status is proven live, but sustained traffic remains blocked
until Kyra selects a production-grade Base RPC provider. Base documents the
public RPC as rate-limited and unsuitable for production systems.

Replacing the RPC requires:

1. A reviewed HTTPS RPC origin.
2. A backend-only credential lifecycle if authentication is required.
3. No browser, Telegram, wallet, user, or transaction data in requests.
4. A repeat of the exact provider tests and one controlled smoke.

## Rollback

1. Keep `KYRA_BASE_MCP_PREP_ENABLED=false`.
2. Remove or rotate the dedicated provider shared secret if compromise is
   suspected.
3. Remove the provider endpoint and RPC secrets if the integration is retired.
4. Deploy the previous `base-mcp-prepare` version only if code rollback is
   required.
5. Run the reviewed SQL rollback only after the runtime gate is confirmed off.

## Done Criteria

- One read-only Base provider call completed from an authenticated owner
  dashboard.
- The exact provider and response contracts passed.
- Database rate-limit controls passed target assertions.
- The runtime gate is off after the smoke.
- Wallet, Telegram, signing, approval, and transaction boundaries remain
  unchanged.
- No push or Netlify deploy occurred.
