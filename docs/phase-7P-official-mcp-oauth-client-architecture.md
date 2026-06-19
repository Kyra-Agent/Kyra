# Phase 7P Official MCP OAuth Client Architecture Decision

Date: 2026-06-19

Status: backend-for-frontend architecture selected locally; implementation is
blocked. Official Base MCP registration, authorization, callback exchange,
tokens, sessions, tools, wallet authority, and execution remain disabled.

## Objective

Select the only acceptable Kyra OAuth client architecture for the official
Base MCP endpoint without creating an OAuth client or adding runtime wiring.

This phase does not add Edge Functions, callback routes, database tables,
secrets, frontend controls, authorization URLs, token exchanges, MCP sessions,
tool calls, wallet prompts, signatures, or transactions.

## Live Provider Evidence

Observed directly from the official endpoint on 2026-06-19:

- `https://mcp.base.org/.well-known/oauth-authorization-server` returns issuer,
  authorization, token, and dynamic registration endpoints.
- The authorization server supports Authorization Code and Refresh Token
  grants.
- PKCE `S256` is advertised.
- `token_endpoint_auth_methods_supported` contains only `none`, which describes
  a public OAuth client with no client secret at the token endpoint.
- The only advertised scopes are `agent_wallet:transact` and
  `agent_wallet:escalate`.
- `https://mcp.base.org/.well-known/oauth-protected-resource` returns 404.
- `https://mcp.base.org/.well-known/oauth-protected-resource/mcp` returns 404.

The MCP `2025-11-25` authorization specification requires clients to use
Protected Resource Metadata for authorization-server discovery. Kyra must not
silently replace missing discovery with hardcoded authorization endpoints.

## Decision

Kyra will use a backend-for-frontend OAuth client architecture if and only if
the provider blockers are resolved and every later approval is granted.

The browser may initiate a request and follow a redirect, but the backend owns
the OAuth transaction, callback validation, code exchange, token lifecycle, and
MCP session. The browser never receives an official MCP access token, refresh
token, authorization code after callback processing, or PKCE verifier.

The callback must use a reviewed first-party Kyra host so the initiating user
agent can be bound with a short-lived host-only cookie. A callback on an
unrelated third-party function domain is not approved.

The official OAuth client remains separate from:

- the frontend Supabase account-session implementation
- the custom `kyra_status_v1` Base MCP status bridge
- Telegram session and secret storage
- wallet providers and wallet signing
- LLM and template-agent runtime

## Rejected Architectures

### Browser OAuth Client

Rejected because it would expose transaction state or tokens to browser
storage, application JavaScript, extensions, analytics, and XSS risk.

The existing frontend Supabase session pattern must not be copied for official
MCP tokens.

### Telegram OAuth Initiation Or Callback

Rejected because Telegram is read-only and cannot safely bind browser consent,
Kyra ownership, OAuth callback state, and wallet authority.

### Reusing The Custom Status Bridge

Rejected because `kyra_status_v1` is not MCP OAuth and intentionally rejects
`mcp.base.org`.

### Hardcoded Authorization Discovery

Rejected while Protected Resource Metadata is missing. Authorization Server
Metadata alone does not satisfy the reviewed MCP discovery contract.

### Dynamic Client Registration At Runtime

Rejected until provider ownership, registration policy, client lifecycle,
redirect management, deletion, rotation, and abuse controls receive a separate
decision. A registration endpoint existing does not authorize Kyra to call it.

### Shared Global User Token

Rejected. A provider token may never be shared across owners, workspaces,
agents, environments, or Telegram sessions.

## Proposed Component Boundaries

These are future component contracts, not implemented routes.

### OAuth Start Boundary

A future owner-authenticated backend endpoint would:

1. Accept POST only with a fresh Supabase bearer session.
2. Revalidate the user and agent/workspace ownership server-side.
3. Require explicit dashboard owner action and recent re-authentication.
4. Fetch and validate Protected Resource Metadata.
5. Fetch and validate Authorization Server Metadata from the discovered issuer.
6. Require exact issuer, endpoint, HTTPS, PKCE S256, and approved scope set.
7. Generate 256-bit state and a transaction-specific PKCE verifier.
8. Generate a separate browser-binding nonce and set it in a short-lived,
   host-only `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
9. Store only hashes of state and browser binding plus protected transaction
   material server-side.
10. Return one bounded authorization URL with no token or verifier.

It must not accept issuer, authorization endpoint, token endpoint, resource,
redirect URI, or scope values supplied by the browser.

### OAuth Callback Boundary

A future public backend callback would:

1. Accept only the fixed provider redirect path.
2. Apply strict query-size and parameter allowlists.
3. Require the exact short-lived browser-binding cookie and compare its hash
   before consuming the transaction.
4. Atomically consume one unexpired state transaction before exchange.
5. Reject replay, missing cookie, browser-binding mismatch, wrong
   issuer/resource, wrong owner/workspace, or invalid PKCE metadata.
6. Exchange the code server-side with the bound verifier and redirect URI.
7. Validate token type, audience, resource, scope, and bounded expiry.
8. Store tokens only through an approved encrypted secret boundary.
9. Clear the browser-binding cookie on every terminal outcome.
10. Return `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, avoid
   query logging where the platform permits, and redirect with HTTP 303 to one
   fixed dashboard result route containing no
   code, state, verifier, token, provider error, or user-controlled URL.

The callback does not trust a current browser Supabase session as proof of the
transaction owner. Ownership comes from the consumed server-side transaction.
The independent browser-binding cookie prevents an authorization URL initiated
for one Kyra owner from being completed by an unrelated victim browser.

### Token Broker Boundary

A future backend-only token broker would:

- resolve encrypted tokens by opaque owner/workspace/provider binding
- refresh with single-flight locking and rotation/reuse detection
- return tokens only to an approved internal MCP transport
- never return raw tokens to frontend, Telegram, LLM, logs, or activity records
- revoke the full token family on mismatch, reuse, disconnect, or compromise

### MCP Client Boundary

A future official MCP client would:

- accept no user-supplied MCP endpoint
- use only validated resource and authorization metadata
- bind each call to one owner, workspace, agent, token audience, and request ID
- validate protocol version, capabilities, tool schemas, output bounds, and
  content types
- keep tool discovery separate from tool approval
- fail closed for unknown, changed, write-capable, or escalated tools

### Wallet Boundary

Official MCP authorization never opens a wallet prompt. MCP tool output may at
most create a reviewed, non-signing proposal after a separate execution-phase
approval. Dashboard approval, wallet prompt, wallet signature, and transaction
submission remain distinct later boundaries.

## Future Data Classes

No schema is approved here. Any later proposal must keep these classes
separate:

### OAuth Transaction

- hashed state
- hashed browser-binding nonce
- encrypted PKCE verifier or approved secret reference
- owner, workspace, agent, issuer, resource, redirect, and requested scope
- issued, expiry, consumed, and failure timestamps
- one-time status with atomic consumption

Maximum lifetime should be five minutes unless a shorter provider requirement
is verified. Consumed and expired records must become unusable immediately.

### OAuth Credential

- opaque credential reference
- owner, workspace, agent, provider, issuer, resource, and exact granted scope
- encrypted access and refresh token secret references
- access expiry, refresh family, rotation version, revoked state, and reason

Raw tokens, authorization codes, and PKCE verifiers are forbidden in public
tables, user-readable rows, logs, analytics, or activity messages.

### OAuth Audit Event

- bounded event kind
- owner/workspace/agent/provider identifiers
- request correlation ID
- sanitized result code and timestamp

No URL query, code, state, verifier, token, provider body, or wallet payload may
be recorded.

## Required Runtime Gates

Future gates must be independent, exact-true, default-off, and backend-only:

- metadata discovery
- OAuth transaction issue
- callback code exchange
- token persistence
- token refresh
- MCP initialize
- MCP read-only tool discovery
- MCP read-only tool invocation
- MCP write-capable tools
- wallet execution

Enabling one gate must not enable another.

## Current Blocking Decisions

Implementation must not begin because:

1. Protected Resource Metadata required by the reviewed MCP specification is
   unavailable at the standard resource locations tested.
2. No read-only scope is advertised; all available scopes imply wallet
   transaction or escalation authority.
3. No exact tool inventory or scope-to-tool authority map is approved.
4. No OAuth client registration lifecycle is approved.
5. No OAuth transaction or encrypted credential schema is approved.
6. No key-management, refresh rotation, revocation, or incident runbook is
   approved.

Kyra must not request an empty or wallet-authority scope merely to test OAuth.
The next safe work is scope and consent qualification, not callback
implementation.

## Repository Invariants

- No `official-mcp-oauth-start` Edge Function exists.
- No `official-mcp-oauth-callback` Edge Function exists.
- No official MCP OAuth URL or token storage service exists in `src`.
- No official MCP OAuth environment variable exists.
- No official MCP token schema exists.
- No official MCP scopes or tools appear in Telegram runtime.
- The custom status bridge still rejects `mcp.base.org`.
- Wallet execution remains disabled.

## Required Approvals Before Implementation

1. Provider publishes valid Protected Resource Metadata or Kyra receives an
   official documented discovery path that satisfies the current specification.
2. A non-wallet read-only scope and exact tool authority map are verified, or a
   separate wallet-authority product decision is explicitly approved.
3. Static or dynamic client registration lifecycle is reviewed and approved.
4. OAuth transaction and encrypted credential schema receives SQL/RLS review.
5. Key management, token rotation, revocation, and incident response are
   approved.
6. Consent UX and re-authentication requirements are approved.
7. First-party callback hosting and browser-cookie binding are approved.
8. Start and callback contracts receive tests before any provider call.

## Verification

- `npm run check:phase-7p`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- One backend-only OAuth client architecture is selected.
- Browser, Telegram, custom bridge, shared-token, and runtime-registration
  architectures are explicitly rejected.
- Start, callback, token broker, MCP client, and wallet boundaries are defined.
- Missing resource metadata and wallet-only scopes are explicit blockers.
- Automated checks prove no official OAuth runtime wiring was added.
- No schema, registration, authorization, token, session, tool call, wallet
  prompt, signature, transaction, deploy, or push occurred.
