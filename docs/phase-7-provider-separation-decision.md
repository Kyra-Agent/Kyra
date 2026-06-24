# Phase 7 Provider Separation Decision

Date: 2026-06-24

Status: canonical architecture decision complete. Runtime execution remains
disabled pending the normal Base Account implementation gates.

## Decision

Kyra's production transaction path must not depend on the hosted official
`mcp.base.org` provider.

The primary path is:

```text
agent or Telegram intent
-> Kyra prepared-action adapter
-> deterministic validation and NYX-05 risk review
-> private owner dashboard review
-> explicit Kyra owner approval
-> Base Account SDK wallet prompt in the browser
-> explicit user signature
-> Base Account submits onchain
-> Kyra records a sanitized owner-only result
```

## Responsibilities

### Base Account SDK

- connects the user's own Base Account
- presents the wallet prompt in the private dashboard
- keeps signing authority with the user
- submits only after an explicit browser approval
- never exposes a private key or seed phrase to Kyra

### Kyra Prepared-Action Adapter

- converts bounded agent intent into Kyra's canonical prepared-action format
- validates chain, action kind, asset, recipient, amount, calldata policy, and
  expiry before wallet presentation
- binds every action to owner, workspace, and deployed agent
- enforces idempotency, cancellation, and replay protection
- cannot sign or submit by itself

### Official Hosted Base MCP Adapter

- remains an optional future provider adapter
- stays disabled while its public authority contract is NO-GO
- must use the same canonical prepared-action, ownership, policy, approval, and
  audit boundaries if it is later qualified
- cannot bypass or replace Base Account user approval

## Gate Separation

The official Base MCP NO-GO blocks only:

- official MCP OAuth and dynamic registration
- official MCP token storage and refresh
- authenticated official MCP sessions
- official MCP tool discovery and invocation
- provider-created approval links

It does not block:

- owner-authenticated Base Account connection in the private dashboard
- Kyra prepared-action generation
- deterministic policy and risk review
- explicit Kyra owner approval
- Base Account SDK wallet signing
- user-approved Base transaction submission

## Non-Negotiable Boundaries

- Telegram cannot connect a wallet, approve, sign, or submit.
- Public pages and page load cannot open wallet prompts.
- The backend cannot hold a user private key or seed phrase.
- LLM output is untrusted intent, never executable authority.
- Every production write is owner/workspace/agent bound and replay-safe.
- Official MCP and Base Account credentials must never share storage or logs.

## Supersession

This decision supersedes older wording that made Base Account connection or
Kyra's primary transaction path depend on Phase 7C changing to GO. Historical
official-MCP packets remain valid for the official hosted adapter only.

## Current Result

- Official `mcp.base.org` adapter: NO-GO and disabled.
- Base Account SDK primary path: architecture-approved, runtime still gated.
- Phase 7D may proceed through its own owner, wallet-prompt, prepared-action,
  signing, rollback, and smoke approvals without enabling official MCP.
- Phase 7D implementation is not enabled by this document alone.
