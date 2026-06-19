# Phase 7T Custom Bridge Smoke Go/No-Go

Date: 2026-06-19

Status: local go/no-go packet complete. Custom bridge smoke remains blocked
until a compatible provider, target Supabase verifier, runtime gate window, and
owner approval are all present.

## Objective

Create a final pre-smoke decision packet for Kyra's custom read-only
`kyra_status_v1` bridge. This packet prevents a controlled smoke from being
treated as ready just because local code, docs, or a provider URL exists.

No environment gate, provider secret, database SQL, deployment, wallet prompt,
prepared-action write, Telegram execution, or onchain transaction is enabled by
this phase.

## Required Evidence

All items below are required before the smoke can move from blocked to ready:

| Area | Required Evidence | Current Decision |
| --- | --- | --- |
| Provider contract | Candidate implements exact `kyra_status_v1` `POST /status-check` contract | blocked |
| Provider ownership | Operator, endpoint owner, and credential lifecycle are documented | blocked |
| Provider safety | Provider confirms no wallet, calldata, signing, Telegram, or user identity data is required | blocked |
| Rate-limit SQL | Forward SQL reviewed and applied in the target Supabase project | blocked |
| Rate-limit verifier | Boolean-only verifier passes in the target Supabase project | blocked |
| Rollback SQL | Rollback SQL reviewed for the target Supabase project | blocked |
| Runtime gate | Smoke window has exact start, end, owner, and rollback operator | blocked |
| Test account | Low-risk owner workspace and agent are selected | blocked |
| Local verification | Phase 7, functions, build, whitespace, and secret scan pass | ready locally |
| Owner approval | Owner approves the exact provider and smoke window | blocked |

If any row is blocked, the smoke is blocked.

## Go Criteria

A smoke can be marked ready only when every statement is true:

- `KYRA_BASE_MCP_PREP_ENABLED` is still `false` before the window.
- The provider endpoint is HTTPS and not `mcp.base.org`.
- The provider protocol is exactly `kyra_status_v1`.
- The provider has passed positive and negative contract tests.
- The rate-limit SQL verifier returns the expected booleans in the target
  Supabase project.
- The dashboard action is initiated by the owner from one selected workspace.
- The action kind is exactly `base_mcp_status_check`.
- The smoke uses one selected persisted agent.
- Telegram and public agent pages have no caller path.
- The smoke plan includes immediate gate disablement.
- The owner explicitly approves the provider, timing, and rollback operator.

## No-Go Criteria

Do not run the smoke if any item below is true:

- Provider asks for wallet address, signature, calldata, token amount,
  recipient, transaction hash, Telegram token, Supabase session, owner id, or
  workspace id.
- Provider returns extra fields outside the exact six-field response contract.
- Provider requires official Base MCP OAuth, `agent_wallet:*` scopes, dynamic
  registration, token exchange, MCP session initialization, or tool invocation.
- Rate-limit SQL has not been verified in the target project.
- Rollback operator is unclear.
- Runtime gate window is open-ended.
- The selected account is not low-risk.
- Any local check fails.
- The owner has not approved the exact smoke.

## Smoke Procedure

1. Confirm every Required Evidence row is ready.
2. Confirm `KYRA_BASE_MCP_PREP_ENABLED=false`.
3. Deploy only if the current code already passed local verification and owner
   approved the deploy.
4. Set backend-only provider endpoint, optional API key, timeout, and protocol.
5. Apply reviewed rate-limit SQL in the target project and run verifier.
6. Open a short smoke window by setting `KYRA_BASE_MCP_PREP_ENABLED=true`.
7. From the selected owner dashboard, click `Check Base MCP status` once.
8. Capture bounded dashboard result and response headers only.
9. Confirm no wallet prompt, signature, transaction, prepared-action write,
   Telegram execution, public route call, raw provider payload, or secret
   exposure occurred.
10. Set `KYRA_BASE_MCP_PREP_ENABLED=false` immediately.
11. Re-run local checks after the smoke.

## Allowed Evidence To Share

- bounded status result
- request id
- provider outcome header
- timestamp
- selected non-sensitive agent label
- local command pass/fail summary

## Evidence Never To Share

- provider API key
- Telegram bot token or token ref
- Supabase service role key
- Supabase session token
- wallet signature
- wallet address unless the owner explicitly approves public disclosure
- calldata
- transaction hash for a non-existent smoke
- raw provider body
- raw database rows
- user identifiers

## Final Decision

Current decision: blocked.

Reason: no compatible production provider has been approved, rate-limit SQL has
not been verified in the target Supabase project, no runtime gate window is
approved, and no exact smoke account/window is selected.

## Files

- This packet: `docs/phase-7T-custom-bridge-smoke-go-no-go.md`
- Phase 7L smoke prep: `docs/phase-7L-controlled-live-smoke-preparation.md`
- Phase 7M provider contract:
  `docs/phase-7M-provider-contract-qualification.md`
- Runtime gate: `supabase/functions/base-mcp-prepare/runtime-config.ts`
- Provider adapter: `supabase/functions/base-mcp-prepare/provider-adapter.ts`
- Provider contract: `supabase/functions/base-mcp-prepare/provider-contract.ts`
- Rate-limit forward SQL:
  `supabase/base_mcp_status_rate_limit_forward_review.sql`
- Rate-limit verifier:
  `supabase/verify_base_mcp_status_rate_limit_contract.sql`
- Rate-limit rollback:
  `supabase/base_mcp_status_rate_limit_rollback_review.sql`
- Guard: `scripts/check-phase-7t-custom-bridge-smoke-go-no-go.mjs`

## Verification

- `npm run check:phase-7l`
- `npm run check:phase-7m`
- `npm run check:phase-7t`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Required evidence is explicit.
- Go/no-go criteria are bounded and owner-approved.
- Smoke procedure requires gate-off before and after the window.
- Shareable evidence excludes secrets and user-sensitive data.
- Current decision remains blocked.
- Automated checker is included in `npm run check:phase-7`.
- No schema, SQL application, secret, runtime gate enablement, provider call,
  deploy, push, wallet prompt, signature, transaction, Telegram execution, or
  public-route execution occurred.
