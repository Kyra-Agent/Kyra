# Phase 7AR Token Lifecycle And Revocation Blueprint

Date: 2026-06-20

Status: blueprint complete. Runtime remains NO-GO and disabled.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `docs/phase-7AQ-owner-wallet-authority-blueprint.md`
- `docs/phase-7O-official-mcp-oauth-threat-model.md`
- `docs/phase-7P-official-mcp-oauth-client-architecture.md`

## Objective

Define the future official Base MCP token lifecycle, storage boundary, refresh
rules, revocation contract, disconnect behavior, and incident response before
Kyra implements OAuth, token persistence, MCP sessions, wallet prompts,
signing, or transaction submission.

This phase is a blueprint only. It does not add OAuth routes, callback
handlers, token exchange, token storage schema, provider secrets, MCP sessions,
tool discovery, tool invocation, wallet prompts, signing, transactions,
Supabase deploys, Netlify deploys, or GitHub pushes.

## Current Decision

Phase 7D remains NO-GO while Phase 7C official Base MCP provider evidence is
insufficient.

Current runtime must remain limited to:

- disabled wallet execution
- owner-dashboard-only read-only `base_mcp_status_check`
- default-off custom status bridge
- no official Base MCP OAuth start route
- no official Base MCP OAuth callback route
- no official token broker
- no token refresh function
- no token revocation function
- no official MCP session or tool runtime
- no wallet prompt
- no signing
- no transaction submission

## Token Classes

Future implementation must treat every OAuth and MCP secret as a separate data
class with separate retention rules.

| Class | Future lifetime | Storage boundary | Browser exposure |
| --- | --- | --- | --- |
| Authorization code | callback-only, one use | never persisted after exchange | never |
| PKCE verifier | OAuth transaction TTL, max five minutes | encrypted or secret-reference only | never |
| OAuth state | one use, max five minutes | hash only | never raw |
| Browser-binding nonce | one use, max five minutes | host-only cookie plus server hash | cookie only, never JS |
| Access token | short provider TTL | encrypted backend-only reference | never |
| Refresh token family | provider lifetime or owner disconnect | encrypted backend-only reference | never |
| Credential reference | until revoked/deleted | opaque backend identifier | never public |
| MCP session ID | bounded by token and provider session TTL | backend-only | never |

The frontend, Telegram runtime, LLM context, public agent pages, analytics,
activity logs, Markdown docs, and Git history must never contain raw
authorization codes, PKCE verifiers, OAuth states, access tokens, refresh
tokens, provider response bodies, wallet payloads, signatures, calldata, or
Telegram bot tokens.

## Binding Contract

Every future credential reference must bind exactly one:

```text
owner
-> workspace
-> deployed agent
-> Base Account
-> provider
-> issuer
-> resource/audience
-> exact granted scope set
-> consent packet version
-> token family
```

No global credential, shared workspace credential, shared Telegram credential,
platform-owned wallet credential, or cross-agent token reuse is allowed.

Every read, refresh, MCP initialization, tool discovery, tool invocation,
prepared action, approval, and result lookup must revalidate this binding.

## Storage Boundary

Future official Base MCP credentials may be stored only through a reviewed
backend secret boundary.

Minimum requirements:

- service-role-only access path
- encrypted at rest outside browser-readable rows
- key separation from ordinary database data
- opaque credential references in application records
- no raw token columns readable by `anon` or `authenticated`
- no token material in Supabase realtime payloads
- no token material in Edge Function responses
- no token material in frontend state, local storage, session storage, or URL
- no token material in Telegram rows, messages, sessions, or logs
- no token material in LLM prompts or tool context
- no token material in public profiles, public APIs, or GitHub docs

Any future SQL must receive a separate RLS review before it is applied.

## Refresh Lifecycle

Future refresh must be performed only by a backend-only token broker.

Required behavior:

1. Resolve one opaque credential reference.
2. Revalidate owner, workspace, agent, issuer, resource, scope, consent packet,
   revoked state, and expiry.
3. Acquire a single-flight lock for the credential reference and token family.
4. Reject stale rotation versions.
5. Refresh only through the reviewed provider token endpoint.
6. Validate token type, audience, resource, scope, expiry, and rotation
   version.
7. Store the new encrypted token reference atomically.
8. Tombstone the previous refresh token reference if rotation is used.
9. Record only a sanitized owner-only audit event.
10. Return raw tokens only to the internal MCP transport, never to callers.

Refresh-token reuse, duplicate rotation, wrong resource, wrong scope, wrong
owner, wrong agent, decrypt failure, audit failure, or provider mismatch must
revoke the token family and fail closed.

## Revocation Triggers

Future revocation must run for any of these triggers:

- owner disconnects a Base Account binding
- owner deletes an agent
- owner leaves or resets a workspace
- owner revokes consent or removes a scope
- provider metadata drifts from the reviewed contract
- issuer, resource, audience, or scope mismatch is detected
- refresh-token reuse is detected
- token decrypt fails
- token refresh fails in a suspicious way
- MCP challenge or tool metadata changes unexpectedly
- unknown, escalated, or write-capable tool appears
- audit event cannot be written
- Telegram bot token compromise forces an owner security review
- incident kill switch is activated
- owner requests emergency disablement

Telegram bot token compromise must never expose wallet tokens. It may only
force review or revocation of affected owner bindings.

## Disconnect Contract

Future disconnect must be owner-only and private-dashboard-only.

Disconnect must:

- target one owner/workspace/agent/provider/resource binding
- show the exact binding and scope being disconnected
- revoke provider credentials when provider revocation is available
- tombstone or delete local encrypted credential references
- invalidate pending OAuth transactions
- invalidate pending prepared actions
- stop refresh attempts
- stop MCP sessions
- clear dashboard connection state
- preserve sanitized audit evidence
- keep Telegram sessions separate

Disconnect must not be possible from Telegram, public pages, LLM output,
external links, background jobs, page load, route changes, or unauthenticated
sessions.

## Kill Switches

Future runtime must expose independent default-off backend gates for:

- OAuth start
- OAuth callback exchange
- token persistence
- token refresh
- token revocation
- MCP initialize
- MCP read-only tool discovery
- MCP read-only tool invocation
- MCP write-capable tools
- prepared-action creation
- wallet execution

Turning on one gate must not turn on another. Emergency disablement must be
able to stop all gates without deleting audit evidence.

## Audit Event Allowlist

Future audit events may contain only:

- event kind
- timestamp
- request correlation ID
- owner ID
- workspace ID
- agent ID
- provider ID
- issuer label
- resource label
- granted scope labels
- credential reference hash
- consent packet version
- sanitized result code

Audit events must never contain:

- authorization code
- access token
- refresh token
- PKCE verifier
- raw OAuth state
- raw browser-binding nonce
- authorization URL query
- token endpoint response body
- provider error body
- MCP session secret
- wallet payload
- wallet signature
- calldata
- transaction raw data
- Telegram bot token
- Telegram token secret reference

If a required audit event cannot be recorded safely, the related token or
execution path must fail closed.

## Failure Handling

Future token lifecycle failures must use deterministic failure states:

| Failure | Required result |
| --- | --- |
| Expired access token | attempt broker refresh once if allowed, otherwise disconnect-required |
| Refresh failure | fail closed, no MCP call |
| Refresh-token reuse | revoke token family |
| Provider 401 or 403 | stop MCP calls and require owner review |
| Scope drift | revoke or require fresh consent |
| Metadata drift | disable provider binding |
| Wrong owner/workspace/agent | reject before token resolution |
| Wrong audience/resource | revoke token family |
| Decrypt failure | revoke and open incident review |
| Audit failure | fail closed |
| Kill switch active | reject before provider call |

All error messages returned to frontend or Telegram must be sanitized.

## Implementation Preconditions

No token runtime may be implemented until all are true:

1. Phase 7C changes from NO-GO to GO through reviewed official provider
   evidence.
2. The owner explicitly approves Phase 7D transition.
3. Protected Resource Metadata is available or an official reviewed equivalent
   is accepted.
4. Exact resource/audience and issuer validation are defined.
5. Exact least-privilege scope and tool-authority mapping are verified.
6. OAuth client registration or static client policy is approved.
7. SQL/RLS design for token classes is approved.
8. Key management and secret storage are approved.
9. Revocation and incident runbooks are approved.
10. Owner consent UX and disconnect UX are approved.
11. Runtime gates and tests are mapped before any route is added.

## Current Repository Boundary

The repository must remain in this state after Phase 7AR:

- no `supabase/functions/official-mcp-oauth-start`
- no `supabase/functions/official-mcp-oauth-callback`
- no `supabase/functions/official-mcp-token-broker`
- no `supabase/functions/official-mcp-refresh-token`
- no `supabase/functions/official-mcp-revoke`
- no official Base MCP token schema
- no official Base MCP access or refresh token environment variable
- no official MCP session runtime
- no official MCP tool runtime
- `walletExecution` remains `disabled`
- custom bridge still rejects `mcp.base.org`

## Verification

- `npm run check:phase-7ar`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Token classes and lifetimes are explicit.
- Backend-only storage boundary is explicit.
- Credential binding is owner/workspace/agent/Base Account/provider scoped.
- Refresh lifecycle and rotation/reuse behavior are explicit.
- Revocation, disconnect, kill switch, audit, and failure behavior are
  explicit.
- Runtime remains NO-GO and disabled.
- Automated checks prove no official OAuth/token runtime was added.
- No OAuth, token exchange, token storage, MCP session, wallet prompt, signing,
  transaction, deploy, or push occurred during this phase.
