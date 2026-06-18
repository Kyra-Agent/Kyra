# Phase 7I Base MCP Status Preparation Decision

Date: 2026-06-19

Status: decision packet started. This phase selects the first live candidate but
does not enable provider runtime calls, prepared-action storage writes, wallet
prompts, signing, transaction submission, or Telegram execution.

## Decision

The first Phase 7 live candidate is:

- action kind: `base_mcp_status_check`
- chain: `base`
- mode: `read_only`
- surface: owner dashboard only
- provider path: Base MCP status endpoint only
- value: no token spend, no gas request, no calldata
- wallet: no wallet prompt
- Telegram: no trigger and no execution
- storage: no production write until prepared-action SQL is applied and
  verified

This candidate is intentionally not a swap, transfer, approval, contract call,
bridge, claim, or arbitrary transaction preview.

## Why This Candidate

This is the smallest useful production step because it proves:

- the owner dashboard can request a backend-owned capability check
- the Edge Function can enforce owner/session/workspace boundaries
- the Base MCP runtime gate can be tested without wallet or token risk
- the provider adapter can return a bounded read-only summary
- failure states can be sanitized without leaking endpoint, API key, provider
  payload, wallet data, calldata, or transaction payloads

## Scope

Allowed:

- authenticated owner dashboard request
- exact action kind `base_mcp_status_check`
- exact chain `base`
- exact mode `read_only`
- bounded request age and future skew
- ownership lookup before provider access
- HTTPS-only provider endpoint
- bounded timeout
- sanitized success summary
- sanitized failure response

Blocked:

- public route trigger
- Telegram trigger
- non-owner trigger
- arbitrary action kind
- wallet prompt
- wallet signing
- transaction submission
- raw calldata
- token amount
- recipient address
- prepared-action production write before SQL approval
- provider payload ref before storage approval

## Enablement Order

Do not skip order.

1. Keep current local audit suite green.
2. Select and document the exact provider endpoint.
3. Confirm provider auth model and backend-only secret storage.
4. Confirm `KYRA_BASE_MCP_PREP_ENABLED` is the only runtime enable flag.
5. Wire `createBaseMcpStatusCheckAdapter` only in a reviewed commit.
6. Keep `storePreparedActionSummary` unwired until the prepared-action SQL
   verifier passes against the target project.
7. Run local tests with a fake provider transport.
8. Push only after owner approval for the release batch.
9. Enable the runtime gate only after deploy and secret review.
10. Run the live smoke checklist with a low-risk owner workspace.

## Live Smoke Checklist

Before enabling the gate:

- confirm target Netlify site and Supabase project
- confirm `KYRA_BASE_MCP_PREP_ENABLED` current value
- confirm `KYRA_BASE_MCP_ENDPOINT` is HTTPS
- confirm `KYRA_BASE_MCP_API_KEY`, if used, is a backend secret only
- confirm no `VITE_` Base MCP secret exists
- confirm `storePreparedActionSummary` remains unwired
- confirm Telegram still refuses swap/wallet/onchain commands
- confirm public agent pages expose no owner-only data

After enabling the gate:

- owner dashboard status-check request returns either `preview_ready` or a
  bounded failure
- wrong-owner request returns a bounded authorization failure
- stale request returns `invalid_request`
- unsupported action kind returns `base_mcp_unknown_action`
- provider failure returns `base_mcp_unavailable` or `base_mcp_timeout`
- response includes no raw provider body, endpoint URL, API key, wallet data,
  calldata, or transaction hash
- Telegram still cannot call Base MCP

## Rollback Plan

Primary rollback for this candidate is runtime-gate disablement:

- set `KYRA_BASE_MCP_PREP_ENABLED` away from exact `true`
- remove or rotate `KYRA_BASE_MCP_API_KEY` if provider auth was configured
- leave prepared-action storage disabled unless a separate SQL approval has
  already happened
- keep Telegram execution disabled
- re-run `npm run check:phase-7`
- verify dashboard shows bounded disabled/not-configured copy

If prepared-action storage was later enabled in a separate packet, use the
prepared-action rollback rules from `docs/phase-7D-prepared-action-storage-approval.md`.

## Non-Goals

This decision does not approve:

- wallet connect prompts
- wallet signing
- transaction submission
- token approvals
- swaps
- transfers
- contract calls
- Telegram-created approval drafts
- Telegram-triggered Base MCP calls
- production prepared-action storage writes

## Done Criteria

- Phase 7I decision packet exists.
- Automated Phase 7I checker exists.
- `npm run check:phase-7` includes Phase 7I.
- The selected candidate is exactly `base_mcp_status_check`.
- Enablement order is explicit.
- Live smoke checklist is explicit.
- Rollback plan is explicit.
- Runtime provider and storage remain unwired in this commit.
- No wallet, signing, transaction, or Telegram execution capability is enabled.

## Next Step

After this decision packet stays green, the next implementation packet can
review wiring the Base MCP status provider adapter while keeping storage and
wallet execution off.
