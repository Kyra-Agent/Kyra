# Phase 7AL Official Base MCP Unblock Readiness

Date: 2026-06-20

Status: readiness matrix complete. Current decision: blocked.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7C-official-base-mcp-provider-contract-audit.md`
- `docs/phase-7AK-official-base-mcp-transition-gate.md`

## Objective

Define the exact evidence Kyra needs before Phase 7C can change from no-go to
go and before the official hosted MCP adapter may begin. Phase 7D Base Account
SDK connection is an independent lane.

This phase does not implement wallet connection, official MCP OAuth, client
registration, token exchange, token storage, MCP initialization, tool discovery,
tool invocation, prepared-action writes, wallet prompts, signing, or
transaction submission.

## Current Result

Phase 7C remains blocked.

Observed evidence is useful for monitoring, but not sufficient for wallet
authority:

- official issuer is known
- authorization, token, and registration endpoints are known
- PKCE S256 is advertised
- protected resource metadata is unavailable
- unauthenticated `/mcp` exposes bearer realm `mcp` only
- no observed `resource_metadata` challenge exists
- no observed scope challenge exists
- advertised scopes are wallet-authority scopes
- exact scope-to-tool mapping remains unverified
- escalation semantics remain unverified

Known issuer and OAuth endpoints do not authorize implementation by themselves.

## Unblock Matrix

| Evidence | Current State | Required Before Official MCP Activation |
| --- | --- | --- |
| Protected Resource Metadata | unavailable at tested standard locations | stable metadata URL and response |
| Resource identifier | not verified | exact resource/audience value |
| Issuer and endpoints | observed | re-verified against protected resource metadata |
| Non-escalating scope | not advertised or verified | exact scope string with bounded authority |
| Scope-to-tool mapping | not verified | published or otherwise verifiable mapping |
| Tool IDs | not snapshotted | exact tool IDs for first allowed capability |
| Tool schemas | not snapshotted | schema versions or deterministic schema snapshot |
| Read-only privacy boundary | not mapped to scope | owner-only output contract and retention rule |
| Write authority | advertised through broad wallet scopes | excluded or bounded by exact action policy |
| Escalation semantics | undefined | documented as absent or explicitly bounded |
| Approval-link behavior | not verified | owner/action/chain/value/expiry/replay binding |
| Token lifecycle | not verified | expiry, refresh, rotation, revocation, disconnect |
| Incident controls | not verified | provider revocation and Kyra kill-switch path |
| Consent UX fields | not complete | owner/workspace/agent/scope/tool/limit copy |

Any missing required evidence keeps the result blocked.

## Minimum Go Packet

A future go packet must include all of the following:

- current monitor output with semantic drift reviewed
- protected resource metadata capture with no secrets
- exact resource identifier and issuer
- exact requested scope and why it is least privilege
- exact tools, schemas, chains, assets, and limits
- clear statement that Telegram cannot authorize or execute
- token storage and revocation design
- owner consent copy
- rollback and emergency disablement plan
- test plan for a non-wallet read-only smoke before write authority
- explicit owner approval for official hosted MCP activation

## Hard No-Go Conditions

The transition stays blocked if any of these are true:

- protected resource metadata is still unavailable
- only `agent_wallet:transact` and `agent_wallet:escalate` are available
- scope omission or fallback is required
- read-only capability requires a wallet-authority scope
- tool descriptions are the only source of authority definition
- approval-link binding, expiry, or replay behavior is unknown
- token refresh or revocation behavior is unknown
- Telegram, public routes, LLM output, page load, or background jobs can start
  authorization or execution
- user wallet addresses, tokens, Telegram secrets, raw provider bodies, or
  transaction payloads would need to be written into public docs or frontend
  state

## Current Allowed Work

- keep running the read-only provider monitor
- update the baseline only after reviewed public evidence changes
- prepare local architecture and check scripts
- keep Telegram live read-only
- keep all official MCP authority disabled
- keep Base Account wallet execution disabled until its independent gates pass

## Verification

- `npm run status:base-mcp`
- `npm run check:phase-7al`
- `npm run check:phase-7am`
- `npm run check:phase-7`

## Done Criteria

- Readiness matrix exists.
- Automated readiness check exists.
- Current result remains blocked.
- Required go packet is explicit.
- Hard no-go conditions are explicit.
- Package Phase 7 checks include this readiness gate.
- No OAuth, token, session, tool, wallet prompt, signing, transaction, deploy,
  or push occurred.
