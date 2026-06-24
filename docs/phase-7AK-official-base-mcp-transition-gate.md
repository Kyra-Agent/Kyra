# Phase 7AK Official Base MCP Transition Gate

Date: 2026-06-20

Status: local transition gate complete. Current decision: blocked.

Canonical reference: `docs/product-phase-roadmap.md`

## Objective

This gate prevents Kyra from moving from Phase 7C monitoring into official MCP
OAuth, token storage, MCP tool discovery, tool invocation, or provider approval
links until the official Base MCP provider contract is verified. It does not
block the independent Base Account SDK primary lane.

It does not implement wallet connection, OAuth registration, token exchange,
tool calls, prepared-action writes, wallet prompts, signing, or submission.

## Current Decision

Kyra must stay blocked before official Base MCP authority.

The latest verified provider evidence still shows:

- authorization metadata exists for `https://mcp.base.org`
- advertised scopes are `agent_wallet:transact` and `agent_wallet:escalate`
- protected resource metadata is unavailable
- unauthenticated `/mcp` returns `WWW-Authenticate: Bearer realm="mcp"`
- unauthenticated `/mcp` does not expose observed `resource_metadata`
- unauthenticated `/mcp` does not expose observed scope guidance
- exact scope-to-tool mapping is not verified
- escalation semantics are not verified

Because this is wallet authority, absence of least-privilege evidence is a
blocker, not an implementation detail.

## Blocked Until

The official hosted MCP adapter may start only after a new reviewed audit
proves all of these:

- protected resource metadata is available and stable
- exact resource identifier is known
- exact issuer and audience are verified
- exact non-escalating scope exists
- exact scope-to-tool mapping is verified
- tool IDs and schemas are snapshot-able
- approval links are bound to owner, workspace, agent, action, chain, limits,
  and expiry
- OAuth token lifecycle, rotation, revocation, and disconnect are documented
- Kyra can present consent naming the owner, workspace, agent, scope, tools,
  chains, limits, storage boundary, revocation path, and Telegram prohibition

## Transition Rules

Until the blocked decision changes:

- do not open `https://mcp.base.org/authorize`
- do not call `https://mcp.base.org/register`
- do not request `agent_wallet:transact`
- do not request `agent_wallet:escalate`
- do not request omitted or fallback scopes
- do not create OAuth client metadata
- do not create PKCE or state for official Base MCP
- do not store official MCP access or refresh tokens
- do not initialize an authenticated official MCP session
- do not list official MCP tools
- do not invoke official MCP tools
- do not create official provider approval links
- do not prompt a Base Account from Telegram, a public page, page load, LLM
  output, or a background job

## Allowed Work

Safe official-MCP work may continue only in these lanes:

- monitor official provider metadata, unauthenticated `/mcp` challenge, and docs
- keep Telegram live read-only
- keep custom `kyra_status_v1` bridge separate and read-only
- maintain local audits, tests, and fail-closed gates
- prepare architecture notes that request no official MCP authority
- continue the independently gated Base Account SDK primary lane

## Security Priority

User wallet security and user Telegram bot token security remain the highest
priority. Product progress cannot override:

- owner, workspace, and agent binding
- private dashboard approval
- Base Account manual approval
- Telegram read-only boundary
- backend-only token handling
- sanitized logs and errors
- emergency disablement

## Done Criteria

- Transition gate document exists.
- Automated transition check exists.
- Roadmap still declares Phase 7C blocked.
- Phase 7C audit still declares no-go for live wallet authority.
- Phase 7R baseline still records the blocked provider evidence.
- Code and env examples still contain no official Base MCP OAuth start,
  callback, token, scope, or tool-call implementation.
- Phase 7 checks include this transition gate.

## Verification

- `npm run check:phase-7ak`
- `npm run check:phase-7al`
- `npm run check:phase-7`
