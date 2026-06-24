# Phase 7AO Official Base MCP Go/No-Go Decision Packet

Date: 2026-06-20

Status: decision packet complete. Current decision: NO-GO for the official
hosted Base MCP adapter.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7C-official-base-mcp-provider-contract-audit.md`
- `docs/phase-7AL-official-base-mcp-unblock-readiness.md`
- `docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md`

## Objective

Freeze the current official Base MCP decision in one operator-readable packet
so Kyra can continue Phase 7 without changing the product flow or accidentally
starting wallet authority before the provider contract is safe.

This phase does not implement Base Account connection, official MCP OAuth,
dynamic client registration, token exchange, token storage, MCP session
initialization, MCP tool discovery, MCP tool invocation, wallet prompts,
signing, transaction submission, SQL deployment, Netlify deployment, or push.

## Current Decision

Decision: **NO-GO**.

Meaning:

- Phase 7C remains blocked.
- The official hosted MCP adapter must not start.
- Official Base MCP OAuth must not start.
- Official MCP tokens must not be requested or stored.
- Official MCP tools must not be listed or invoked.
- Wallet prompts, signing, and transactions remain disabled by their separate
  Base Account execution gates, not by this decision packet.

This is not a product failure. It is the correct security decision while the
official Base MCP provider contract is still ambiguous for wallet authority.

## Evidence Considered

Latest production checkpoint:

- `docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md`
- observation timestamp: `2026-06-20T10:04:36.669Z`
- provider monitor decision: `blocked`
- baseline match: `true`
- changes: `[]`

Latest provider monitor re-run for this decision packet:

- observation timestamp: `2026-06-20T10:11:20.655Z`
- provider monitor decision: `blocked`
- baseline match: `true`
- changes: `[]`

Current known public signals:

- issuer: `https://mcp.base.org`
- authorization endpoint known
- token endpoint known
- registration endpoint known
- PKCE S256 advertised
- advertised scopes: `agent_wallet:escalate`, `agent_wallet:transact`
- protected resource metadata unavailable at tested standard routes
- unauthenticated `/mcp` challenge returns bearer realm `mcp`
- unauthenticated `/mcp` challenge does not provide `resource_metadata`
- unauthenticated `/mcp` challenge does not provide scope guidance
- documentation does not verify exact scope-to-tool mapping
- documentation does not verify escalation semantics

## No-Go Reasons

The current state fails the minimum wallet-authority bar for these reasons:

| Area | Current State | Decision |
| --- | --- | --- |
| Protected resource metadata | unavailable | no-go |
| Resource/audience | not verified | no-go |
| Least-privilege scope | not verified | no-go |
| Scope-to-tool mapping | not verified | no-go |
| Escalation semantics | not verified | no-go |
| Approval-link behavior | not verified | no-go |
| Token lifecycle | not verified | no-go |
| Revocation/disconnect | not verified | no-go |
| Owner consent copy | incomplete | no-go |

Known OAuth endpoint URLs are not enough to authorize implementation.
Broad wallet-authority scopes are not acceptable without exact tool and
approval semantics.

## Required GO Conditions

The decision can be reconsidered only after a reviewed evidence packet proves
all of the following:

1. Stable Protected Resource Metadata exists and is captured without secrets.
2. Exact resource/audience identifier is verified.
3. Exact issuer and OAuth endpoints are re-verified against that resource.
4. Exact least-privilege non-escalating scope is identified.
5. Exact scope-to-tool mapping is verified.
6. Exact first allowed tool ID and schema are snapshotted.
7. Tool output privacy and retention boundaries are owner-only.
8. Approval-link behavior is verified for owner, agent, action, chain, value,
   expiry, cancellation, and replay.
9. Token expiry, refresh, rotation, revocation, disconnect, and incident
   response behavior are verified.
10. Consent UX copy names the owner, workspace, agent, scope, tools, chains,
    limits, storage, revocation, and Telegram prohibition.
11. Telegram, public routes, page load, background jobs, and LLM output cannot
    initiate authorization, approval, signing, or execution.
12. Owner explicitly approves enabling the official hosted MCP adapter.

## If GO Later

A future GO decision opens only official MCP adapter preparation.

It does not automatically authorize:

- token storage
- tool invocation
- provider approval link creation
- wallet prompt
- signing
- transaction submission

Those remain separately gated by Phase 7E, 7F, 7G, 7H, 7I, and the final
controlled transaction plan.

## Allowed Work While NO-GO

- continue read-only provider monitoring
- keep production UI honest about the blocked Base MCP boundary
- maintain check scripts and documentation
- prepare architecture that cannot run OAuth, wallet prompts, signing, or
  transactions while disabled
- keep Telegram live read-only

## Forbidden Work While NO-GO

- official Base MCP OAuth start or callback
- dynamic client registration
- access token or refresh token request
- access token or refresh token storage
- authenticated official MCP session initialization
- official MCP tool discovery
- official MCP tool invocation
- provider approval-link creation
- prepared action created from an official MCP write tool

## Verification

- `npm run status:base-mcp`
- `npm run observe:base-mcp-provider`
- `npm run check:phase-7ao`
- `npm run check:phase-7`

## Done Criteria

- The current official Base MCP decision is explicitly NO-GO.
- The evidence source for the decision is documented.
- Required GO conditions are listed.
- The future GO scope is bounded to the official hosted MCP adapter only.
- Forbidden NO-GO work remains explicit.
- Automated decision-packet check exists.
- No OAuth, token, session, MCP tool, wallet, signing, transaction, SQL deploy,
  Netlify deploy, or push occurred during this phase.
