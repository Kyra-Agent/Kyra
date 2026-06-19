# Phase 7O Official MCP OAuth And Wallet-Authority Threat Model

Date: 2026-06-19

Status: threat model approved locally. Official Base MCP registration,
authorization, tokens, sessions, tools, and wallet authority remain disabled.

## Objective

Define the security contract that must exist before Kyra may implement the
official OAuth-protected Base MCP protocol identified in Phase 7N.

This phase is audit-only. It does not register a client, open an authorization
URL, request a scope, exchange a code, store a token, initialize MCP, list a
tool, invoke a tool, prompt a wallet, sign, or submit a transaction.

## Verified Standards Baseline

The design baseline was reviewed against primary sources on 2026-06-19:

- The MCP `2025-11-25` authorization specification requires Protected Resource
  Metadata for authorization-server discovery, PKCE with metadata capability
  verification, Resource Indicators, and token audience validation. It
  prohibits token passthrough.
- MCP clients should generate and verify transaction-bound `state`, rejecting
  missing or mismatched values.
- OAuth Security BCP RFC 9700 requires exact redirect URI matching, CSRF and
  authorization-code injection defenses, and recommends PKCE for confidential
  clients.
- RFC 9700 recommends sender-constrained access tokens and requires public
  clients to use sender-constrained refresh tokens or refresh-token rotation.
- OAuth privileges should be restricted by audience, resource, scope, and
  action.

Primary references:

- `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`
- `https://www.rfc-editor.org/rfc/rfc9700`
- `https://www.rfc-editor.org/rfc/rfc8707`
- `https://www.rfc-editor.org/rfc/rfc9449`

## Crown Jewels

- The user's wallet authority and ability to transact or escalate.
- Official MCP access tokens, refresh tokens, authorization codes, and client
  registration data.
- PKCE verifier, OAuth `state`, redirect binding, and MCP session identifiers.
- Supabase session, Kyra owner identity, workspace ownership, and agent identity.
- Telegram bot token, webhook secret, owner-linked chat identity, and update
  replay state.
- Prepared actions, approval decisions, unsigned transactions, signatures, and
  transaction hashes.

## Actors

- Authenticated Kyra owner using the private dashboard.
- Kyra backend OAuth client and MCP client, if separately approved later.
- Official protected resource and authorization server.
- Connected user wallet and wallet provider.
- Telegram users, community chats, and public-profile viewers.
- LLM and external provider outputs, which are always untrusted data.
- Network attacker, malicious website, compromised browser extension, stolen
  token holder, wrong-workspace user, and compromised provider.

## Trust Boundaries

1. Browser to Kyra dashboard session boundary.
2. Browser redirect to official authorization-server boundary.
3. OAuth callback to backend transaction-state boundary.
4. Backend token exchange to authorization-server boundary.
5. Backend MCP client to protected-resource boundary.
6. MCP tool result to Kyra deterministic-policy boundary.
7. Prepared action to explicit dashboard approval boundary.
8. Approved handoff to user-controlled wallet boundary.
9. Telegram and public interfaces to the execution boundary.

No authority may cross two boundaries implicitly. In particular, an OAuth
grant does not equal Kyra action approval, and Kyra approval does not equal a
wallet signature.

## Mandatory Security Invariants

### Authorization Initiation

- Only a freshly authenticated owner may initiate from the private dashboard.
- Re-authentication must be required before requesting wallet-authority scopes.
- Initiation must bind one owner, workspace, agent, redirect URI, issuer,
  resource, requested scopes, PKCE verifier, and one-time state value.
- Use Authorization Code flow with PKCE `S256`; implicit flow is forbidden.
- Verify authorization-server metadata advertises PKCE `S256` support before
  opening authorization.
- Redirect URI, issuer, authorization endpoint, token endpoint, and resource
  origins must use exact allowlisted values. No user-provided endpoint.
- Dynamic client registration remains forbidden until separately approved.
- Telegram, LLM output, public pages, page load, route changes, and background
  jobs must never initiate authorization.

### Callback And Code Exchange

- Callback handling must be backend-owned and accept one use only.
- Reject missing, expired, replayed, wrong-owner, wrong-workspace,
  wrong-issuer, wrong-resource, or mismatched state before token exchange.
- Never place codes, verifier values, state, or tokens in application logs,
  activity logs, analytics, URLs beyond the callback, or client persistence.
- Exchange must use the bound PKCE verifier and exact redirect URI.
- Callback errors must be sanitized and must not reveal provider payloads.

### Tokens And Sessions

- Tokens must remain backend-only, encrypted at rest with key separation from
  the database, and excluded from frontend responses and Supabase user rows.
- Store only the minimum metadata needed for owner binding, expiry, rotation,
  revocation, and audit. Never store tokens in activity-log messages.
- Access tokens must be resource and audience restricted. Token passthrough to
  another service is forbidden.
- Prefer sender-constrained tokens when supported. Refresh tokens require
  rotation or sender constraint, reuse detection, and family revocation.
- Revoke and delete tokens on disconnect, owner removal, workspace reset,
  suspected compromise, scope change, or provider mismatch.
- A token grants provider access only. It never bypasses Kyra ownership,
  policy, rate limit, approval, expiry, risk review, or wallet gates.

### Scope And Wallet Authority

- Default requested scope set is empty.
- `agent_wallet:transact` and `agent_wallet:escalate` remain forbidden until
  each scope has an exact tool inventory, value limit, chain limit, and consent
  decision packet.
- Request least privilege per task; no silent scope expansion or incremental
  authorization from provider or LLM output.
- Consent must show provider, exact scope, agent, workspace, chain, action
  class, value ceiling, expiry, revocation path, and whether escalation exists.
- Authorization, Kyra approval, wallet prompt, wallet signature, and chain
  submission are five separate states and user decisions.
- No OAuth or MCP result may create a signature or submit a transaction.

### MCP Tools

- Tool discovery output is untrusted and must be schema-validated and bounded.
- Tool IDs and input schemas require a reviewed allowlist before invocation.
- Unknown, changed, duplicated, escalated, or write-capable tools fail closed.
- Tool descriptions and results cannot override system policy or request
  secrets, scopes, wallet prompts, signatures, or approvals.
- Read-only tool calls require owner binding, rate limits, request correlation,
  timeouts, sanitized errors, and bounded outputs.
- Write-capable tool calls remain disabled until a separate execution review.

## Threat Matrix

| Threat | Required Control | Failure Result |
| --- | --- | --- |
| Login CSRF or callback injection | One-time state, PKCE S256, owner binding | Reject before exchange |
| Authorization code interception | PKCE S256 and exact redirect URI | Reject token exchange |
| Authorization-server mix-up | Exact issuer and endpoint allowlist | Reject callback |
| Counterfeit resource server | Protected Resource Metadata and exact resource binding | No token sent |
| Token replay or theft | Short expiry, audience restriction, sender constraint or rotation | Revoke token family |
| Refresh-token reuse | Rotation, reuse detection, family revocation | Disable integration |
| Scope escalation | Exact approved scope set and fresh consent | Reject authorization |
| Wrong owner or workspace | Backend ownership check at every boundary | Return sanitized denial |
| Token passthrough | Fixed audience/resource and no forwarding | Reject outbound request |
| Malicious tool metadata | Schema bounds and reviewed tool allowlist | No invocation |
| Prompt injection in tool output | Treat result as data under deterministic policy | Ignore instruction |
| Telegram or LLM initiation | Hard execution boundary and no OAuth imports/routes | Refuse request |
| Log or analytics leakage | Field allowlist and secret redaction | Drop sensitive field |
| Provider compromise | Kill switch, revoke tokens, disable issuer/resource | Stop all calls |

## Token Storage Contract Before Implementation

No token table or secret is approved in Phase 7O. A later storage proposal must
define and receive separate review for:

- encrypted token ciphertext and external key reference
- owner, workspace, provider, issuer, resource, and scope binding
- creation, expiry, last rotation, revocation, and deletion timestamps
- refresh-token family and reuse-detection state
- RLS denial for browser clients and service-role-only access path
- bounded audit events containing no code, verifier, state, or token
- emergency bulk revocation and deterministic rollback

Browser storage, local storage, session storage, plaintext database columns,
frontend environment variables, Telegram session rows, agent metadata, and
activity logs are forbidden token locations.

## Kill Switch And Incident Response

The official MCP runtime must have independent default-off switches for OAuth
initiation, callback exchange, read-only tool calls, write-capable tools, and
wallet execution.

Any issuer/resource mismatch, token reuse, unknown tool, scope drift, abnormal
rate, ownership mismatch, decryption failure, or audit-log failure must fail
closed. Incident response must support immediate gate disablement, token-family
revocation, credential rotation, sanitized owner notification, and evidence
preservation without storing secrets.

## Current Repository Decision

- No official MCP OAuth callback route exists.
- No official MCP OAuth environment variable exists.
- No official MCP token store exists.
- No official MCP session, tool discovery, or tool invocation exists.
- The custom `kyra_status_v1` bridge rejects `mcp.base.org`.
- Telegram remains read-only and has no official MCP authority path.
- Wallet execution remains disabled.

## Required Approvals Before Any Implementation

1. Confirm official endpoint ownership and current protocol metadata again.
2. Approve the exact OAuth client architecture and redirect URI.
3. Approve the exact scope set and user consent copy.
4. Approve the encrypted token-storage and key-management design.
5. Approve the exact MCP tool allowlist and schema snapshots.
6. Approve revocation, rollback, monitoring, and incident-response runbooks.
7. Approve a non-wallet read-only smoke before any wallet-authority scope.

## Verification

- `npm run check:phase-7o`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Threat actors, assets, trust boundaries, and wallet-authority risks are
  explicit.
- Authorization, callback, token, scope, tool, approval, and wallet invariants
  are documented.
- Runtime and environment examples contain no official MCP OAuth wiring.
- Telegram and public paths remain unable to initiate OAuth or MCP tools.
- Official MCP and wallet execution gates remain disabled.
- No registration, authorization, token, session, tool call, signature, or
  transaction was created during the audit.
