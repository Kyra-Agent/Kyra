# Phase 7C GO Criteria Hard Gate

Date: 2026-06-24

Status: hard gate complete. Current decision remains NO-GO.

## Objective

Make the Phase 7C exit criteria explicit enough that Kyra cannot drift into
Phase 7D runtime Base Account connection or Phase 7E OAuth/token runtime by
accident.

This gate does not implement official Base MCP OAuth, dynamic registration,
token exchange, token storage, MCP sessions, tool discovery, tool invocation,
Base Account prompts, wallet prompts, signing, transactions, deploys, or
pushes.

## Current Evidence State

The latest read-only monitor result remains:

- `decision`: `blocked`
- `baselineMatch`: `true`
- protected resource metadata: unavailable
- unauthenticated `/mcp` challenge: bearer realm `mcp`
- unauthenticated `/mcp` challenge: no `resource_metadata`
- unauthenticated `/mcp` challenge: no scope guidance
- advertised scopes: `agent_wallet:transact`, `agent_wallet:escalate`
- exact scope-to-tool mapping: unverified
- escalation semantics: unverified
- authoritative MCP input schemas: unverified
- approval expiry, cancellation, binding, and replay guarantees: unverified
- OAuth token expiry, rotation, revocation, disconnect, and incident behavior:
  unverified

This is enough evidence to continue monitoring. It is not enough evidence to
request wallet authority.

## Required GO Evidence

Phase 7C can move to GO only after a reviewed evidence packet proves all of
these:

1. Stable protected resource metadata exists.
2. Exact resource/audience identifier is verified.
3. Exact issuer and OAuth endpoints are verified against that resource.
4. Exact non-escalating least-privilege scope is known.
5. Exact scope-to-tool mapping is verified outside untrusted tool text.
6. Exact first allowed tool ID is known.
7. Exact first allowed tool input schema is snapshotted.
8. Chain, asset, value, recipient, calldata, and wallet-type limits are known.
9. Approval-link binding covers owner, workspace, agent, action, chain, value,
   expiry, cancellation, and replay.
10. Token expiry, refresh, rotation, revocation, disconnect, and incident
    response behavior are documented.
11. Owner consent copy names owner, workspace, agent, resource, scope, tools,
    chains, assets, limits, storage boundary, revocation path, and Telegram
    prohibition.
12. Owner explicitly approves the transition from Phase 7C to Phase 7D.

## Hard Stop Conditions

Any one of these keeps Phase 7C as NO-GO:

- protected resource metadata is unavailable
- resource/audience is unknown
- no non-escalating scope is published or verifiable
- scope omission or fallback scope behavior is required
- only wallet-authority scopes are available
- `agent_wallet:escalate` semantics remain unverified
- tool descriptions are the only source of authority definition
- approval-link expiry, replay, cancellation, or binding is unknown
- token refresh, revocation, disconnect, or incident response is unknown
- Telegram, public routes, page load, background jobs, or LLM output can start
  authorization, approval, signing, or execution

## Allowed While NO-GO

- run `npm run observe:base-mcp-provider`
- maintain documentation and status copy
- maintain local static guards
- improve tests that request no authority
- refine threat models and owner-consent copy drafts

## Forbidden While NO-GO

- official Base MCP OAuth start
- official Base MCP callback processing
- dynamic client registration
- access-token or refresh-token request
- access-token or refresh-token storage
- authenticated official MCP session
- official MCP tool discovery
- official MCP tool invocation
- provider approval-link creation
- Base Account connection prompt
- wallet prompt
- signing
- transaction submission

## Verification

- `npm run observe:base-mcp-provider`
- `npm run check:phase-7c-hard-gate`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Phase 7C GO criteria are explicit.
- Hard-stop conditions are explicit.
- Runtime Phase 7D and Phase 7E remain blocked while current evidence is
  blocked.
- Full Phase 7 checks enforce the hard gate.
