# Phase 7Q Official MCP Scope And Consent Qualification

Date: 2026-06-19

Status: scope qualification complete locally; no official Base MCP scope is
approved. Authorization, tokens, sessions, tools, wallet authority, and
execution remain disabled.

## Objective

Determine whether any scope currently advertised by the official Base MCP
authorization server can be requested safely by Kyra, and define the minimum
consent contract for any future scope.

This phase does not open an authorization URL, request a scope, register a
client, exchange a code, store a token, initialize MCP, discover live tools,
invoke a tool, create an approval link, prompt a wallet, sign, or transact.

## Current Official Evidence

Observed from official sources on 2026-06-19:

- Authorization Server Metadata advertises only `agent_wallet:transact` and
  `agent_wallet:escalate`.
- Standard Protected Resource Metadata locations tested in Phase 7P return
  404, so resource-specific `scopes_supported` cannot be verified.
- The current Base MCP overview states that it can check balances, send funds,
  swap tokens, sign messages, execute contract calls, and pay x402 APIs across
  multiple networks.
- Base documents read-only tools including `get_wallets`, `get_portfolio`, and
  `get_transaction_history`.
- Base documents write surfaces including send, swap, sign, `send_calls`, and
  `complete_x402_request`.
- Custom plugins may produce unsigned calldata and execute it through
  `send_calls`.
- Base states that write actions require user approval in Base Account.
- No current official documentation was found that maps either advertised
  OAuth scope to an exact tool allowlist, chain set, value limit, destination
  policy, message-signing policy, plugin boundary, or escalation behavior.
- No current official definition of `agent_wallet:escalate` was found in the
  Base documentation corpus.

Primary references:

- `https://mcp.base.org/.well-known/oauth-authorization-server`
- `https://docs.base.org/ai-agents/index`
- `https://docs.base.org/ai-agents/guides/check-balance`
- `https://docs.base.org/ai-agents/guides/view-history`
- `https://docs.base.org/ai-agents/guides/send-tokens`
- `https://docs.base.org/ai-agents/guides/swap-tokens`
- `https://docs.base.org/ai-agents/guides/sign-messages`
- `https://docs.base.org/ai-agents/guides/batch-calls`
- `https://docs.base.org/ai-agents/guides/x402-payments`
- `https://docs.base.org/ai-agents/plugins/custom-plugins`
- `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`

The archived `base/base-mcp-legacy` repository is historical evidence only and
is not treated as the contract for the current hosted OAuth service.

## Scope Selection Hazard

The MCP authorization specification defines fallback scope selection when a
specific scope is not supplied by the resource. That fallback can use the
protected resource's complete `scopes_supported` set. Because the official
Protected Resource Metadata is unavailable, Kyra cannot verify what safe
fallback set, if any, applies.

Kyra therefore must not:

- omit the scope parameter to perform a test
- request an empty scope and assume read-only behavior
- use the full advertised scope set as a default
- infer scope semantics from the scope name
- infer a read-only scope from read-only tools
- treat provider approval links as a substitute for OAuth scope qualification

The approved default scope set remains empty, and an empty set means no
authorization request is allowed.

## Qualification Matrix

| Candidate | Observed Authority | Risk | Decision |
| --- | --- | --- | --- |
| Omitted or empty scope | MCP fallback may select the full resource scope set, which is currently unverifiable | Critical ambiguity and unintended authority | Rejected |
| `agent_wallet:transact` | Name implies transaction authority; current product surface includes send, swap, sign, contract calls, x402, plugins, and multiple networks | Critical and not tool-bounded | Rejected |
| `agent_wallet:escalate` | No official semantics or authority boundary found | Unbounded privilege escalation | Rejected |
| Both advertised scopes | Transaction plus undefined escalation authority | Maximum available privilege | Rejected |
| Hypothetical read-only scope | Balance, wallet, portfolio, and owned-wallet history only | Potentially qualifyable after exact metadata/tool mapping | Not currently available |

No scope is eligible for implementation, smoke testing, consent UX, or token
storage.

## Capability Risk Classification

### Read-Only Context

Documented examples:

- `get_wallets`
- `get_portfolio`
- `get_transaction_history`

These can reveal sensitive financial context, owned addresses, assets,
portfolio value, transaction history, supported chains, agent wallets, and
session authorization state. Read-only does not mean public. Any future
read-only scope still requires owner/workspace binding, private dashboard
consent, bounded retention, redacted logs, and no Telegram/public exposure.

### Token And Native-Asset Movement

Send and swap can move value across supported mainnet networks. Required future
controls include exact chain and asset allowlists, recipient policy, per-action
and cumulative value ceilings, quote expiry, slippage limits, simulation,
fee visibility, and fresh owner approval.

### Message Signing

Plain-message and EIP-712 signing can create authentication, permit,
authorization, or offchain-order effects without an onchain transaction.
Message signing must never be treated as lower risk than token movement merely
because gas or calldata is absent.

### Arbitrary Contract Calls And Plugins

`send_calls` and custom plugins can carry arbitrary unsigned calldata and batch
multiple interactions. The semantic effect cannot be safely inferred from a
generic transaction scope or natural-language tool description.

Future support would require exact target contracts, selectors, decoded
arguments, token approvals, asset flows, simulation, batch ordering, and
postconditions. Unknown contracts or selectors fail closed.

### x402 Payments

x402 can sign and submit a USDC payment authorization to an external service,
then replay the original request. Consent must bind the destination origin,
HTTP method, resource, price, asset, chain, maximum charge, response handling,
and replay behavior. Arbitrary user- or LLM-supplied destinations are forbidden.

### Agent Wallets And Escalation

Official docs reference in-session agent wallets and session authorization
state, but the OAuth metadata does not define the relationship between those
features and `agent_wallet:escalate`.

Until the provider publishes exact semantics, escalation is treated as capable
of increasing wallet autonomy, session authority, value limits, duration, tool
access, or approval bypass. This is a conservative inference, not a confirmed
provider contract, and is sufficient to reject the scope.

## Provider Approval Is Necessary But Not Sufficient

Base documentation states that current write actions produce an approval link
and require confirmation in Base Account. Kyra must still enforce its own
independent layers:

1. OAuth scope consent.
2. Kyra owner/workspace/agent authorization.
3. Kyra deterministic policy and risk review.
4. Kyra explicit action approval.
5. Base Account approval link.
6. User-controlled wallet signature or provider confirmation.
7. Transaction submission and confirmation.

No layer may silently satisfy another. A provider approval link does not prove
that Kyra authorized the tool, decoded the action, enforced limits, or bound the
request to the correct owner and workspace.

## Minimum Consent Contract

Kyra must not render an enable button until every field below is known from a
reviewed provider contract and local policy.

Consent must show:

- provider and verified issuer
- protected resource and exact scope string
- plain-language authority description
- exact approved tool IDs and schema versions
- read-only, signing, spending, contract-call, payment, and escalation flags
- owner, workspace, and agent receiving the integration
- exact supported chains, with Base-only as Kyra's initial maximum
- allowed assets and destination policy
- per-action and rolling cumulative value ceilings
- arbitrary calldata and plugin policy
- message and typed-data signing policy
- x402 destination, replay, and maximum-price policy
- access-token and refresh-token lifetime
- integration expiry and re-consent triggers
- token storage boundary
- revocation and disconnect path
- incident kill switch
- statement that Telegram and LLM output cannot authorize or execute
- statement that every write still needs separate Kyra and provider approval

Consent must not use generic language such as:

- "Connect Base"
- "Enable wallet"
- "Allow transactions"
- "Enable agent"
- "Continue"

Consent cannot be valid if the exact tool set, scope semantics, limits, or
escalation behavior are unknown.

## Re-Consent Triggers

Fresh consent and recent re-authentication are required for:

- any added or changed scope
- any new or changed tool ID or input schema
- any new chain, asset, contract, selector, destination class, or plugin
- any increased per-action or cumulative limit
- any longer expiry or refresh-token lifetime
- any change in provider issuer, resource, authorization, or token endpoint
- any introduction of agent wallets, session permissions, or escalation
- any change from read-only to signing or spending

Scope or tool drift must revoke or suspend the integration before the new
authority is used.

## Required Provider Contract Before Reconsideration

Base must provide verifiable current documentation or metadata for:

- Protected Resource Metadata and resource identifier
- exact meaning of every scope
- exact scope-to-tool mapping
- exact tool schemas and versioning policy
- chain and wallet types available to each tool
- whether agent wallets can act without per-action owner approval
- exact meaning and lifecycle of escalation
- approval-link expiry, binding, replay, and cancellation behavior
- token audience, expiry, refresh, revocation, and rotation behavior
- security contact and incident-revocation procedure

Kyra does not need to implement against undocumented authority.

## Repository Invariants

- No official MCP scope constant exists in frontend or Telegram runtime.
- No authorization request builder exists.
- No consent button or approval screen claims official MCP readiness.
- No official token, callback, MCP session, or tool runtime exists.
- The custom `kyra_status_v1` bridge remains separate.
- Wallet execution remains disabled.

## Next Decision

Phase 7R should define the provider qualification evidence contract and a
repeatable metadata/documentation monitor. It must remain read-only and must
not poll authorization, registration, or token endpoints.

OAuth implementation remains blocked until at least one exact non-escalating
scope can be mapped to a reviewed tool set and consent contract.

## Verification

- `npm run check:phase-7q`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Every advertised scope has an explicit qualification decision.
- Scope omission and fallback behavior are rejected.
- Read, spend, sign, contract-call, plugin, x402, and escalation risks are
  classified.
- Provider approval is explicitly separated from Kyra consent and approval.
- Minimum consent and re-consent contracts are defined.
- Automated checks prove no scope or OAuth runtime wiring was added.
- No authorization, registration, token, MCP session, tool call, wallet prompt,
  signature, transaction, deploy, or push occurred.
