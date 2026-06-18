# Phase 7J Base MCP Status Provider Wiring

Date: 2026-06-19

Status: runtime provider adapter wiring started. This packet wires only the
read-only Base MCP status adapter behind backend gates. It does not enable
prepared-action production storage, wallet prompts, signing, transaction
submission, Telegram execution, approvals, swaps, transfers, or contract calls.

## Decision

Wire the reviewed Base MCP status provider adapter into runtime dependencies:

- adapter: `createBaseMcpStatusCheckAdapter`
- dependency hook: `prepareBaseMcpAction`
- action kind: `base_mcp_status_check`
- chain: `base`
- mode: `read_only`
- surface: authenticated owner dashboard path only
- runtime gate: exact `KYRA_BASE_MCP_PREP_ENABLED=true`
- endpoint: backend-only `KYRA_BASE_MCP_ENDPOINT`, HTTPS only
- API key: backend-only `KYRA_BASE_MCP_API_KEY`, optional
- timeout: capped by `KYRA_BASE_MCP_TIMEOUT_MS`, maximum 5000 ms

## Runtime Boundary

The disabled path remains inert:

- no required env reads
- no body read
- no session validation
- no service-role client creation
- no ownership lookup
- no provider request
- no storage write

The enabled path still requires this order:

1. POST and JSON guards.
2. Exact runtime gate.
3. Bearer session.
4. Authenticated Supabase user.
5. Bounded request body.
6. Fresh `requestedAt`.
7. Exact allowed action kind.
8. Agent ownership lookup.
9. Workspace match.
10. HTTPS endpoint configured.
11. Provider status request.

## Provider Payload Boundary

The provider request may include only:

- `actionKind`
- `chain`
- `mode`
- `requestId`
- `requestedAt`

The provider request must not include:

- owner user id
- workspace id
- agent id
- wallet address
- token amount
- recipient address
- calldata
- transaction hash
- Telegram token
- private key
- seed phrase
- browser-exposed secret

## Storage Boundary

Prepared-action storage remains disabled:

- `storePreparedActionSummary` is not wired in runtime dependencies.
- `public.prepared_actions` remains review-only SQL.
- The dashboard receives only the bounded provider preview response.
- No production prepared-action row is created by Phase 7J.

## Telegram Boundary

Telegram remains read-only:

- no Base MCP function call
- no prepared-action write
- no wallet prompt
- no approval creation
- no signing
- no transaction submission

Telegram can still explain that wallet and onchain execution are disabled.

## Failure Boundary

Allowed user-facing failures stay bounded:

- `Base MCP preparation is disabled.`
- `Base MCP preparation is not configured.`
- `This Base MCP action is not supported.`
- `Base MCP preparation timed out.`
- `No Base MCP action can be prepared right now.`

No failure may expose endpoint URLs, API keys, provider stack traces, raw
provider bodies, calldata, transaction hashes, wallet data, or Telegram token
refs.

## Local Verification

Required before push or deploy:

```powershell
npm run check:phase-7j
npm run check:phase-7
deno test --quiet supabase/functions
npm run build
git diff --check
```

## Live Smoke Checklist

Before enabling `KYRA_BASE_MCP_PREP_ENABLED=true`:

- confirm target Supabase project and Netlify site
- confirm endpoint is HTTPS
- confirm API key is backend-only
- confirm no `VITE_` Base MCP secret exists
- confirm storage hook remains unwired
- confirm Telegram refuses swap/wallet/onchain/Base MCP requests

After enabling the gate:

- owner dashboard status request returns `preview_ready` or bounded failure
- wrong-owner request fails before provider access
- stale request returns `invalid_request`
- unsupported action kind returns `base_mcp_unknown_action`
- provider timeout returns `base_mcp_timeout`
- provider failure returns `base_mcp_unavailable`
- response includes no endpoint, API key, owner id, workspace id, agent id,
  wallet data, calldata, provider payload, or transaction hash
- disabling the gate returns `base_mcp_disabled`

## Rollback Plan

Primary rollback:

- set `KYRA_BASE_MCP_PREP_ENABLED` away from exact `true`
- remove or rotate `KYRA_BASE_MCP_API_KEY` if configured
- clear or replace `KYRA_BASE_MCP_ENDPOINT`
- keep `storePreparedActionSummary` unwired
- keep Telegram execution disabled
- re-run `npm run check:phase-7`
- smoke that dashboard shows disabled or not-configured copy

## Done Criteria

- Runtime dependencies wire only the read-only provider adapter.
- Disabled runtime path remains inert.
- Ownership lookup stays before provider access.
- Provider payload remains bounded and excludes owner/workspace/agent/wallet
  scope.
- Prepared-action storage remains unwired.
- Telegram and public routes cannot trigger Base MCP.
- Automated Phase 7J checker exists and is included in `npm run check:phase-7`.
