# Phase 7C Base MCP Runtime Audit

Date: 2026-06-19

Status: audit packet started. Base MCP runtime preparation remains disabled and
unwired for production execution.

## Objective

Phase 7C audits the Base MCP runtime boundary before Kyra can enable any
provider-backed preparation call.

The target is not to enable Base MCP yet. The target is to prove that enabling
the environment gate alone cannot create an unsafe execution path, and that any
future provider call stays read-only, owner-scoped, bounded, sanitized, and
separate from wallet signing or transaction submission.

## Current Finding

Current state is acceptable for Phase 7C entry:

- `base-mcp-prepare` is default-off.
- Disabled runtime returns before bearer parsing, required env reads, body read,
  session validation, service-role client creation, ownership lookup, provider
  adapter access, or storage writes.
- Runtime enablement requires exact `KYRA_BASE_MCP_PREP_ENABLED=true`.
- Provider endpoint normalization accepts only valid `https://` URLs.
- Runtime timeout defaults to 2500 ms and caps at 5000 ms.
- Enabled dependency factory wires auth and ownership lookup only.
- Runtime dependency factory does not wire `prepareBaseMcpAction`.
- Runtime dependency factory does not wire `createBaseMcpStatusCheckAdapter`.
- Runtime dependency factory does not wire `storePreparedActionSummary`.
- If enabled but adapter is unwired, the function returns
  `base_mcp_not_configured`.
- The only allowed action kind is `base_mcp_status_check`.
- Request mode must be `read_only`.
- Request freshness and future clock skew are bounded.
- Preview expiry is bounded.
- Provider adapter draft exists but is not wired into runtime dependencies.
- Prepared-action storage adapter exists but is not wired into runtime
  dependencies.

## Runtime Gate Rules

Base MCP runtime may not be enabled until all of these are true:

- Owner approval is captured.
- Provider endpoint is selected and documented.
- Endpoint is HTTPS only.
- Timeout and retry policy are reviewed.
- Provider auth model is reviewed.
- Request freshness is preserved.
- Ownership lookup runs before adapter access.
- Response sanitizer is reviewed.
- Storage adapter remains off unless Phase 7D approves storage.
- Telegram and public routes cannot call the function.
- Frontend cannot reference backend secrets or Base MCP environment variables.

## Request Boundary

Allowed request shape:

- `actionKind: "base_mcp_status_check"`
- `agentId`
- `workspaceId`
- `requestId`
- `chain: "base"`
- `mode: "read_only"`
- `requestedAt`

Rejected request content:

- wallet address
- token amount
- recipient
- raw calldata
- transaction hash
- private key
- seed phrase
- Telegram token
- API key
- arbitrary provider payload
- unsupported action kind

## Provider Adapter Boundary

The provider adapter draft may only send:

- `actionKind`
- `chain`
- `mode`
- `requestId`
- `requestedAt`

It must not send:

- owner user id
- workspace id
- agent id
- wallet address
- Telegram token refs
- private keys
- seed phrases
- raw calldata
- transaction hashes
- API keys in response bodies

Current adapter result must remain:

- route: `Base MCP status check only.`
- value: `No token spend, no gas request, no calldata.`
- risk: `read-only`
- `opaquePayloadRef: null`

## Storage Boundary

Prepared-action storage is not live in Phase 7C.

The storage adapter may exist as a draft, but it must not be wired into runtime
dependencies until Phase 7D approves:

- storage SQL
- rollback SQL
- verifier SQL
- RLS behavior
- idempotency
- replay protection
- owner-summary view columns
- runtime storage hook

## Failure Boundary

Allowed user-facing Base MCP failure messages:

- `Base MCP preparation is disabled.`
- `Base MCP preparation is not configured.`
- `This Base MCP action is not supported.`
- `Base MCP preparation timed out.`
- `No Base MCP action can be prepared right now.`

Do not return:

- endpoint URLs
- API keys
- provider stack traces
- raw JSON-RPC errors
- raw payload bodies
- calldata
- transaction hashes
- wallet addresses
- Telegram token refs

## Gaps Before Live Runtime

These must be resolved before any Base MCP provider call is enabled:

- No production provider endpoint has been selected.
- No provider-specific auth review exists.
- No provider replay/idempotency policy exists beyond request freshness.
- No live rate-limit policy exists for Base MCP preparation.
- No production storage path is approved.
- No low-risk live smoke account is selected.
- No rollback checklist exists for runtime enablement.

## Phase 7C Done Criteria

- Base MCP runtime audit packet exists.
- Automated Phase 7C check exists.
- Runtime dependency factory remains unwired for provider and storage.
- Runtime config remains exact-gate and HTTPS-only.
- Provider adapter remains read-only and sends no owner/wallet/secret scope.
- Storage adapter remains draft-only and unwired.
- Phase 7 checks pass with 7C included.

## Next Step

Proceed to Phase 7D only after this audit stays green:

- prepared-action storage approval packet
- RLS verifier review
- rollback review
- owner-summary view finalization
- storage adapter wiring decision
