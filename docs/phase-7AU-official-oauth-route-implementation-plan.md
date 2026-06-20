# Phase 7AU Official OAuth Route Implementation Plan

Date: 2026-06-20

Status: implementation plan complete. Runtime remains NO-GO and disabled.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7O-official-mcp-oauth-threat-model.md`
- `docs/phase-7P-official-mcp-oauth-client-architecture.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md`

## Objective

Define the future implementation plan for official Base MCP OAuth start and
callback routes before any route, token exchange, token storage, MCP session,
wallet prompt, signing, or transaction runtime is created.

This phase is planning only. It does not create Edge Functions, OAuth routes,
callback handlers, authorization URLs, PKCE values, state values, cookies,
token requests, token storage, MCP sessions, UI controls, SQL migrations,
deploys, or pushes.

## Current Decision

Phase 7D remains NO-GO. Official Base MCP provider evidence still lacks the
required Protected Resource Metadata and exact non-escalating scope/tool
contract. Kyra must not implement or expose official OAuth routes yet.

## Future Route Set

Future executable work may propose these routes only after Phase 7C changes to
GO and the owner approves the transition:

| Route | Method | Purpose | Current state |
| --- | --- | --- | --- |
| `official-mcp-oauth-start` | POST | issue one provider authorization URL after owner validation | absent |
| `official-mcp-oauth-callback` | GET | consume one callback and exchange one code backend-side | absent |
| `official-mcp-token-broker` | internal only | resolve and refresh tokens for approved MCP transport | absent |
| `official-mcp-revoke` | POST | disconnect one owner/workspace/agent/provider binding | absent |
| `official-mcp-status` | GET | owner-only sanitized binding status | absent |

No route may be callable from Telegram, public agent pages, public APIs, LLM
output, background jobs, page load, route changes, or unauthenticated sessions.

## Gate Model

Every future route must be guarded by independent exact-true backend gates:

```text
KYRA_OFFICIAL_MCP_METADATA_DISCOVERY_ENABLED
KYRA_OFFICIAL_MCP_OAUTH_START_ENABLED
KYRA_OFFICIAL_MCP_OAUTH_CALLBACK_ENABLED
KYRA_OFFICIAL_MCP_TOKEN_PERSISTENCE_ENABLED
KYRA_OFFICIAL_MCP_TOKEN_REFRESH_ENABLED
KYRA_OFFICIAL_MCP_REVOKE_ENABLED
KYRA_OFFICIAL_MCP_STATUS_ENABLED
KYRA_OFFICIAL_MCP_SESSION_ENABLED
KYRA_OFFICIAL_MCP_TOOL_DISCOVERY_ENABLED
KYRA_OFFICIAL_MCP_TOOL_INVOCATION_ENABLED
KYRA_WALLET_EXECUTION_ENABLED
```

All gates default off. Enabling one gate must not enable another.
`KYRA_WALLET_EXECUTION_ENABLED` remains off until separate execution approval.

## OAuth Start Contract

Future `official-mcp-oauth-start` must:

1. Accept POST only.
2. Require a fresh authenticated owner session.
3. Require explicit private-dashboard owner action.
4. Revalidate owner, workspace, and deployed agent.
5. Reject public, Telegram, background, LLM, and unauthenticated callers.
6. Fetch and validate Protected Resource Metadata.
7. Fetch and validate Authorization Server Metadata from the discovered issuer.
8. Require exact HTTPS issuer, authorization endpoint, token endpoint,
   resource, redirect URI, PKCE `S256`, and approved scope set.
9. Reject provider-supplied or browser-supplied endpoint, resource, redirect,
   or scope overrides.
10. Generate one 256-bit state.
11. Generate one transaction-specific PKCE verifier.
12. Generate one browser-binding nonce.
13. Store only hashes or encrypted secret references.
14. Set one short-lived host-only `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
15. Return one bounded authorization URL with no token, verifier, raw state,
   raw nonce, provider secret, wallet payload, or approval shortcut.

If any validation fails, the route must return a sanitized refusal and create
no authorization URL.

## OAuth Callback Contract

Future `official-mcp-oauth-callback` must:

1. Accept GET only on one fixed first-party Kyra callback path.
2. Allow only expected query keys and bounded query length.
3. Reject missing, duplicated, expired, or malformed `state`.
4. Require the browser-binding cookie.
5. Atomically consume one unexpired OAuth transaction before token exchange.
6. Reject replay, wrong owner, wrong workspace, wrong agent, wrong issuer,
   wrong resource, missing cookie, browser-binding mismatch, or expired state.
7. Exchange code backend-side with the bound PKCE verifier and exact redirect
   URI.
8. Validate token type, audience, resource, scope, expiry, and provider issuer.
9. Persist tokens only through an approved encrypted credential boundary.
10. Clear the browser-binding cookie on every terminal outcome.
11. Return `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
12. Redirect with HTTP 303 to one fixed dashboard result route containing no
   code, state, verifier, token, provider body, user-controlled URL, wallet
   payload, calldata, signature, or transaction data.

The callback must not trust the current browser Supabase session as ownership
proof. Ownership comes from the consumed server-side OAuth transaction.

## Token Broker Contract

Future token broker must be internal-only and must:

- accept only opaque credential references from approved backend callers
- revalidate owner, workspace, agent, provider, issuer, resource, scope, and
  consent packet
- use single-flight refresh locking
- detect refresh-token reuse
- revoke token family on mismatch or suspicious failure
- return raw tokens only to the internal official MCP transport
- never return tokens to frontend, Telegram, LLM, public routes, logs, or
  activity messages

## Revoke And Status Contract

Future revoke route must:

- require authenticated owner session
- require private-dashboard explicit action
- target one owner/workspace/agent/provider/resource/scope binding
- revoke provider credentials when available
- tombstone local credential references
- invalidate pending OAuth transactions and prepared actions
- stop refresh and MCP sessions
- return sanitized owner-only status

Future status route may return only owner-safe summary fields approved by
Phase 7AS. It must not return credential refs, token family IDs, state hashes,
nonce hashes, provider payloads, approval links, wallet payloads, calldata,
signatures, or transaction raw data.

## Test Matrix Before Implementation

Future route implementation must include tests for:

| Area | Required cases |
| --- | --- |
| Start auth | POST only, owner required, dashboard origin, exact agent ownership |
| Provider metadata | missing PRM, wrong issuer, wrong resource, non-HTTPS endpoint |
| Scope | missing scope map, scope drift, unapproved wallet authority |
| PKCE/state | S256 required, random state, one-time state, expired state |
| Browser binding | missing cookie, wrong cookie, expired cookie, cleared cookie |
| Callback | replay, duplicated query keys, oversized query, provider error |
| Token exchange | wrong token type, wrong audience, wrong scope, expired token |
| Storage | no raw token in response, logs, activity messages, browser rows |
| Revocation | owner-only, one binding only, tombstone, no refresh after revoke |
| Public routes | cannot start, callback, status, revoke, or read credentials |
| Telegram | cannot start, callback, status, revoke, or receive links |
| Kill switch | every gate default-off and independently enforced |

Every failure must be sanitized and fail closed.

## Rollback And Incident Plan

Future route rollout must include:

- gates off before deploy
- route deploy without enabling gates
- tests proving disabled behavior
- owner-approved gate window
- immediate gate-off rollback
- token-family revocation procedure
- provider metadata drift response
- audit evidence preservation without secrets
- owner notification copy without sensitive data

Rollback must not require deleting audit evidence or exposing tokens.

## Forbidden Shortcuts

Future implementation must not:

- hardcode authorization discovery while Protected Resource Metadata is missing
- call dynamic client registration at runtime without separate approval
- copy Supabase frontend session storage patterns for official MCP tokens
- request `agent_wallet:transact` or `agent_wallet:escalate` without exact
  consent, tool, value, and approval review
- start OAuth from Telegram
- return authorization URLs from public pages
- store raw tokens in SQL rows readable by browser clients
- log authorization URL queries, codes, states, verifiers, tokens, wallet
  payloads, calldata, signatures, or Telegram tokens
- treat OAuth consent as Kyra approval
- treat Kyra approval as Base Account approval
- enable wallet execution during route rollout

## Current Repository Boundary

The repository must remain in this state after Phase 7AU:

- no `supabase/functions/official-mcp-oauth-start`
- no `supabase/functions/official-mcp-oauth-callback`
- no `supabase/functions/official-mcp-token-broker`
- no `supabase/functions/official-mcp-revoke`
- no `supabase/functions/official-mcp-status`
- no official OAuth route imports in frontend
- no official OAuth route imports in Telegram runtime
- no official Base MCP token schema
- no official MCP session or tool runtime
- no wallet prompt
- no signing
- no transaction submission
- `walletExecution` remains `disabled`

## Implementation Preconditions

No route implementation may start until:

1. Phase 7C changes from NO-GO to GO.
2. The owner explicitly approves Phase 7D/7E transition.
3. Phase 7AQ, 7AR, 7AS, and 7AT remain current.
4. Provider metadata, resource, issuer, scope, tool authority, and approval
   semantics are verified.
5. SQL/RLS forward, rollback, and verifier packets are approved.
6. Key management and secret storage are approved.
7. Consent and disconnect UI copy are approved.
8. Disabled-route tests are written before gates can turn on.

## Verification

- `npm run check:phase-7au`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Future OAuth route set is explicit.
- Gate model is explicit and independent.
- Start, callback, token broker, revoke, status, test, rollback, and incident
  contracts are explicit.
- Forbidden shortcuts are explicit.
- Runtime remains NO-GO and disabled.
- No Edge Function, OAuth route, authorization URL, PKCE, state, cookie, token
  exchange, token storage, MCP session, wallet prompt, signing, transaction,
  SQL migration, deploy, or push occurred.
