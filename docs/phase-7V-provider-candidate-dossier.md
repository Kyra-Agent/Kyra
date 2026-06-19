# Phase 7V Provider Candidate Dossier

Date: 2026-06-19

Status: local provider candidate dossier template complete. No provider is
approved, no endpoint or credential is selected, no provider call has been
made, no runtime gate has been enabled, and the custom bridge smoke remains
blocked.

## Objective

Define the minimum dossier required before any `kyra_status_v1` provider can be
considered for Kyra's custom read-only Base MCP status smoke.

This phase does not nominate, approve, contact, probe, or integrate a provider.
It defines the evidence package required before a provider can enter review.

## Candidate Summary

Every candidate dossier must include:

- provider legal or project name
- endpoint owner
- operational contact
- rollback contact
- endpoint origin without credentials
- expected protocol: `kyra_status_v1`
- expected path: `POST /status-check`
- credential type, described without secret value
- credential rotation owner
- credential revocation path
- supported timeout window
- data retention statement
- incident contact path

Do not include API keys, bearer tokens, Basic auth strings, signed URLs, private
headers, Telegram bot tokens, Supabase service-role keys, wallet addresses,
session tokens, or private user identifiers.

## Contract Evidence

The candidate must provide evidence for the exact Phase 7M contract:

- HTTPS endpoint.
- Not `mcp.base.org`.
- Request accepts only `base_mcp_status_check`.
- Protocol is exactly `kyra_status_v1`.
- Chain is exactly `base`.
- Mode is exactly `read_only`.
- Response is JSON and no larger than 4096 bytes.
- Response has exactly six fields.
- Response binds the exact Kyra request id.
- Provider rejects or ignores wallet, calldata, signing, Telegram, and user
  identity data.

The dossier must also include negative-case evidence for:

- extra response fields
- wrong request id
- wrong protocol
- wrong action kind
- wrong chain
- wrong mode
- malformed JSON
- non-JSON content type
- oversized response
- timeout or abort
- non-2xx response

Negative-case evidence must be summarized. Do not paste raw provider bodies.

## Credential Lifecycle

Credential review must answer:

- who creates the credential
- where it is stored
- who can read it
- how it is rotated
- how it is revoked
- how failed or leaked credentials are detected
- whether the credential grants anything beyond read-only status checks
- whether the credential can access wallet, signing, calldata, transaction,
  Telegram, Supabase, or user identity data

Any credential with broader authority than the read-only status check keeps the
candidate blocked.

## Data Boundary

The provider must not receive:

- owner id
- workspace id
- agent id
- wallet address
- token amount
- recipient
- calldata
- transaction hash
- Telegram bot token
- Telegram token ref
- Supabase session
- Supabase service role key
- user email
- private key
- seed phrase

The provider may receive only the bounded `kyra_status_v1` status-check request
shape already defined in Phase 7M.

## Approval Path

A candidate can move to smoke review only when:

1. The dossier is complete.
2. Contract evidence is reviewed.
3. Credential lifecycle is reviewed.
4. Data boundary is reviewed.
5. Phase 7U target Supabase verifier readiness is satisfied.
6. Phase 7T go/no-go rows are ready.
7. Owner approves the exact provider, endpoint, smoke window, and rollback
   operator.

Approval of the dossier does not enable the runtime gate. It only permits a
separate smoke approval discussion.

## No-Go Conditions

Reject or pause the candidate if:

- endpoint includes credentials
- endpoint is not HTTPS
- endpoint is `mcp.base.org`
- endpoint requires official Base MCP OAuth
- endpoint requires `agent_wallet:*` scopes
- provider asks for wallet, Telegram, Supabase, or user identity data
- provider cannot explain credential rotation and revocation
- provider returns non-contract fields
- provider stores raw request bodies longer than the approved smoke window
- provider requires public frontend configuration
- provider requires Telegram initiation
- provider cannot provide rollback contact
- owner approval is missing

## Redacted Owner Summary

When reporting a candidate to the owner, use this bounded format:

```text
Provider candidate dossier
Provider: <name>
Endpoint origin: <origin only, no credentials>
Protocol: kyra_status_v1
Contract evidence: complete|incomplete
Credential lifecycle: complete|incomplete
Data boundary: complete|incomplete
Rate-limit verifier readiness: ready|blocked
Smoke go/no-go: ready|blocked
Decision: blocked|ready for smoke approval discussion
```

Do not paste raw provider responses, credentials, user identifiers, wallet data,
Telegram token data, Supabase tokens, database rows, or private contact details
into chat, commits, issues, public docs, or screenshots.

## Current Decision

Current decision: blocked.

Reason: no provider candidate dossier exists, no provider is approved, no target
rate-limit verifier has passed, no smoke window is approved, and no runtime gate
is enabled.

## Files

- This packet: `docs/phase-7V-provider-candidate-dossier.md`
- Provider contract:
  `docs/phase-7M-provider-contract-qualification.md`
- Smoke go/no-go:
  `docs/phase-7T-custom-bridge-smoke-go-no-go.md`
- Target verifier readiness:
  `docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md`
- Provider adapter: `supabase/functions/base-mcp-prepare/provider-adapter.ts`
- Provider contract: `supabase/functions/base-mcp-prepare/provider-contract.ts`
- Guard: `scripts/check-phase-7v-provider-candidate-dossier.mjs`

## Verification

- `npm run check:phase-7v`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Candidate summary requirements are explicit.
- Contract evidence includes positive and negative cases.
- Credential lifecycle review is required without storing secret values.
- Data boundary excludes wallet, Telegram, Supabase, transaction, and user
  identity data.
- Approval path requires Phase 7U, Phase 7T, and owner approval.
- Redacted owner summary is bounded and non-secret.
- Current decision remains blocked.
- Automated checker is included in `npm run check:phase-7`.
- No schema, SQL application, secret write, provider endpoint selection,
  provider call, runtime gate enablement, deploy, push, wallet prompt,
  signature, transaction, Telegram execution, or public-route execution
  occurred.
