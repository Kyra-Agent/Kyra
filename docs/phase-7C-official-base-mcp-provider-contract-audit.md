# Phase 7C Official Base MCP Provider Contract Audit

Date: 2026-06-20

Status: no-go for live wallet authority. Official Base MCP implementation
remains blocked by provider-contract ambiguity.

Canonical reference: `docs/product-phase-roadmap.md`

## Objective

Verify whether Kyra can safely begin official Base MCP implementation for a
user-owned deployed agent.

This audit only checks public provider contract evidence. It does not register
an OAuth client, open an authorization URL, request scopes, exchange tokens,
initialize an authenticated MCP session, list tools, invoke tools, create
prepared actions, prompt a wallet, sign, or submit transactions.

## Sources Verified

Official Base and MCP sources checked on 2026-06-20 and refreshed on
2026-06-24:

- `https://mcp.base.org/.well-known/oauth-authorization-server`
- `https://mcp.base.org/.well-known/oauth-protected-resource`
- `https://mcp.base.org/.well-known/oauth-protected-resource/mcp`
- `https://mcp.base.org/mcp`
- `https://docs.base.org/agents/quickstart`
- `https://docs.base.org/agents/guides/check-balance`
- `https://docs.base.org/agents/guides/send-tokens`
- `https://docs.base.org/agents/guides/swap-tokens`
- `https://docs.base.org/agents/guides/sign-messages`
- `https://docs.base.org/agents/guides/batch-calls`
- `https://docs.base.org/agents/guides/x402-payments`
- `https://docs.base.org/agents/plugins/custom-plugins`
- `https://docs.base.org/agents/llms-full.txt`
- `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`

## Current Verified Endpoint Contract

`https://mcp.base.org/.well-known/oauth-authorization-server` returns:

- issuer: `https://mcp.base.org`
- authorization endpoint: `https://mcp.base.org/authorize`
- token endpoint: `https://mcp.base.org/token`
- registration endpoint: `https://mcp.base.org/register`
- grant types: `authorization_code`, `refresh_token`
- PKCE method: `S256`
- token endpoint auth method: `none`
- scopes: `agent_wallet:transact`, `agent_wallet:escalate`

Protected resource metadata checks returned:

- `https://mcp.base.org/.well-known/oauth-protected-resource`: 404
- `https://mcp.base.org/.well-known/oauth-protected-resource/mcp`: 404
- unauthenticated `https://mcp.base.org/mcp`: 401 with
  `WWW-Authenticate: Bearer realm="mcp"` and no observed `resource_metadata`
  or scope challenge

The 2026-06-24 monitor refresh still returns the same wallet-authority OAuth
surface and the same protected-resource metadata blockers. Documentation paths
have moved from `/ai-agents/...` to `/agents/...`, but the observed product
surface still includes send, swap, sign, batched contract calls, x402 payments,
custom plugin `send_calls`, and approval-link based write flows.

## Official Capability Surface

Base documentation currently describes Base MCP as able to:

- connect an assistant to a user's Base Account
- check balances and portfolios
- list wallets, including Base Account and agent wallets
- send native tokens and ERC-20 tokens
- swap supported tokens on supported mainnet chains
- sign plain messages and EIP-712 typed data
- execute batched raw contract calls through `send_calls`
- pay x402 APIs with USDC on Base or Base Sepolia
- use custom plugins that translate external responses into `send_calls`,
  `swap`, or `sign`

The docs also state that write actions require user approval in Base Account.
That provider approval is required, but it is not sufficient for Kyra. Kyra
must still require its own owner binding, policy review, and explicit Kyra
approval before any provider approval link can be created.

## Contract Gaps

Kyra cannot safely implement official Base MCP wallet authority yet because the
verified public contract still does not provide:

- protected resource metadata with a resource identifier
- exact scope-to-tool mapping
- a non-escalating read-only scope
- exact semantics for `agent_wallet:transact`
- exact semantics for `agent_wallet:escalate`
- tool schema versioning guarantees
- chain and wallet type limits per scope
- agent wallet lifecycle and autonomy rules
- approval-link expiry, replay, cancellation, and binding rules
- token audience, expiry, refresh, rotation, and revocation details
- incident or emergency revocation procedure

The MCP authorization spec requires clients to use protected resource metadata
for authorization server discovery and defines fallback scope behavior when
scope guidance is absent. Because Base's protected resource metadata was not
available in this audit and the unauthenticated challenge did not provide a
specific scope, Kyra must not infer least-privilege authorization from the
authorization-server scope list alone.

## Scope Decision

| Scope Candidate | Decision | Reason |
| --- | --- | --- |
| omitted scope | rejected | MCP fallback behavior can request broader provider-supported authority when scope guidance is absent |
| `agent_wallet:transact` | rejected | appears to cover send, swap, sign, contract calls, x402, plugins, and multiple chains without exact tool bounds |
| `agent_wallet:escalate` | rejected | no verified public semantics; treated as unbounded escalation |
| both advertised scopes | rejected | combines transaction authority with undefined escalation |
| hypothetical read-only scope | blocked | potentially useful, but not currently advertised or mapped to exact tools |

## Kyra Decision

No-go for Phase 7D wallet/Base MCP implementation.

Kyra must not:

- open `https://mcp.base.org/authorize`
- call `https://mcp.base.org/register`
- request either advertised scope
- request an omitted or empty scope
- create OAuth state, PKCE verifier, client metadata, access token, or refresh
  token storage
- initialize an authenticated official MCP session
- list official MCP tools
- invoke official MCP tools
- create provider approval links
- prompt Base Account from Telegram, public pages, page load, LLM output, or
  background jobs

Current permitted work:

- keep Telegram live read-only
- keep the custom `kyra_status_v1` bridge separate and read-only
- maintain pre-Base MCP cleanup and security gates
- monitor official provider metadata, unauthenticated `/mcp` challenge, and
  docs for the missing contract
- prepare local architecture docs/checks that do not request authority

## Go Criteria Before Phase 7D

Phase 7D can start only after a new audit verifies all of the following:

1. Protected resource metadata is available and stable.
2. Exact OAuth resource identifier is known.
3. Exact non-escalating scope candidate is known.
4. Scope-to-tool mapping is published or otherwise verifiable.
5. Tool IDs and input schemas are versioned or snapshot-able.
6. Agent wallet behavior is bounded and documented.
7. Provider approval links are bound, expiring, and replay-safe.
8. Token lifecycle, revocation, disconnect, and incident kill-switch behavior
   are documented.
9. Kyra can show owner consent that names the exact owner, workspace, agent,
   scope, tools, chains, assets, limits, storage boundary, revocation path, and
   Telegram prohibition.

## Security Priority

User wallet security and user Telegram bot token security stay above product
velocity.

No Base MCP integration is allowed to weaken:

- owner/workspace/agent binding
- Telegram read-only boundary
- service-role-only token storage
- private dashboard approval
- sanitized logging
- public route privacy
- emergency disablement

## Verification

- `npm run check:phase-7c-contract`
- `npm run observe:base-mcp-provider`
- `npm run check:phase-7`
- `deno test supabase/functions`
- `npm run build`
