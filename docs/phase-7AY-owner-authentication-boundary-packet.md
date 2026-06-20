# Phase 7AY Owner Authentication Boundary Packet

Date: 2026-06-20

Status: owner-authentication boundary audit complete. Runtime remains NO-GO.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7B-ownership-rls-write-path-audit.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AQ-owner-wallet-authority-blueprint.md`
- `docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md`
- `docs/phase-7AX-disabled-only-route-skeleton.md`

## Objective

Define the authentication, ownership, and caller-class boundaries that must be
approved before any official MCP route may read identity fields, request
bodies, callback query parameters, OAuth state, token data, or credential
state.

This phase is documentation and verification only. It does not add auth
helpers, Supabase clients, ownership queries, callback state, cookies, route
configuration, provider calls, OAuth processing, token handling, frontend
wiring, Telegram wiring, wallet prompts, signing, transactions, deploys, or
pushes.

## Current Decision

Decision state: `owner_auth_contract_defined`.

The contract is ready for a separate future approval packet covering local
owner-auth helper code and tests. It does not approve adding authentication or
request processing to the Phase 7AX route skeletons.

Phase 7C remains NO-GO. All five route skeletons must retain their Phase 7AX
fixed fail-closed behavior.

## Identity Source Of Truth

The only owner identity source for owner-facing routes is a Supabase Auth user
validated by the backend from the presented bearer session.

The backend must derive `ownerUserId` from the verified session. It must never
accept owner identity from:

- request JSON
- query parameters
- URL path parameters
- custom browser headers
- Telegram user or chat IDs
- LLM output
- wallet addresses
- Base Account profile fields
- service-role credentials
- provider callback parameters

A service-role client may perform a reviewed backend lookup after caller
authentication. Possession of the service-role key is not caller
authentication and is not evidence of ownership.

## Canonical Ownership Chain

Owner-facing route authorization must verify this exact chain:

```text
verified Supabase user id
  -> workspaces.owner_user_id
  -> agent_instances.workspace_id
  -> requested workspace id and agent id
```

The lookup result must bind `ownerUserId`, `workspaceId`, and `agentId`.

Later official MCP work must additionally bind the Base Account, provider
issuer, protected resource, exact scopes, consent version, and credential
reference. None of those later bindings exist in Phase 7AY.

## Route Caller Classes

### `official-mcp-oauth-start`

Future caller class: private Kyra dashboard owner only.

Required future order:

1. Independent route gate.
2. Reviewed method, origin, content-type, and size checks.
3. Supabase bearer-session validation.
4. Backend-derived owner user ID.
5. Bounded request-body parsing.
6. Agent and workspace ownership validation.
7. Consent and provider-contract checks.
8. Only then may an OAuth transaction be created.

No authorization URL may be generated before ownership and consent validation.

### `official-mcp-status`

Future caller class: private Kyra dashboard owner only.

The route may return only an owner-safe summary after session and ownership
validation. It must not reveal whether another owner has a credential,
credential reference, token family, provider error, wallet address, or Base
Account identifiers.

### `official-mcp-revoke`

Future caller class: private Kyra dashboard owner only.

The route must revalidate owner, workspace, agent, and credential binding at
request time. A credential reference supplied by the browser must never be
sufficient authority. Revocation and disconnect remain separate from wallet
execution approval.

### `official-mcp-oauth-callback`

Future caller class: provider browser redirect bound to a previously
authenticated owner transaction.

The callback must not trust a bearer session, owner ID, workspace ID, agent ID,
wallet address, or scope from callback query parameters. Future callback
authorization must require:

- one-time server-stored OAuth transaction
- high-entropy state hash match
- PKCE verifier held backend-only
- secure HttpOnly browser-binding cookie match
- unexpired and unused transaction
- exact provider issuer and redirect URI
- owner/workspace/agent binding created by the authenticated start route

The callback must consume the transaction exactly once. Missing, mismatched,
expired, replayed, or consumed state must fail closed without revealing which
field failed.

### `official-mcp-token-broker`

Future caller class: internal backend only.

It must not accept browser, Telegram, public API, LLM, callback, or arbitrary
service-role callers. Future authorization requires a reviewed internal
capability or direct module boundary plus an already validated OAuth
transaction or credential binding.

The token broker must never infer owner identity from token claims unless the
provider contract explicitly defines and Kyra independently verifies them.

## Gateway And Function Auth Plan

No `supabase/config.toml` changes are approved in Phase 7AY.

| Route | Gateway JWT intent | Function-level requirement |
| --- | --- | --- |
| start | `verify_jwt = true` | revalidate user and ownership |
| status | `verify_jwt = true` | revalidate user and ownership |
| revoke | `verify_jwt = true` | revalidate user and ownership |
| callback | likely `verify_jwt = false` | one-time state + cookie + transaction binding |
| token broker | not public | internal capability and no browser route |

Gateway JWT verification is defense in depth. It does not replace
function-level user validation and ownership checks.

## Request Processing Order

The Phase 7AX rule remains: disabled routes do not read body or query data.

For a separately approved future auth-only milestone:

1. Evaluate the independent route gate before sensitive request processing.
2. Reject unsupported method, origin, content type, and oversized input.
3. Authenticate the caller class.
4. Derive identity from the trusted source.
5. Parse only the minimum bounded fields required for ownership lookup.
6. Validate ownership and route-specific binding.
7. Return a sanitized auth-only result.

Auth-only code must still stop before provider discovery, authorization URL
generation, callback exchange, token persistence, MCP sessions, wallet
prompts, signing, or transactions.

## Ownership Lookup Rules

Future owner-auth helper code must:

- validate UUID shape before database lookup
- use exact agent and workspace IDs
- confirm the agent belongs to the requested workspace
- confirm the workspace belongs to the authenticated user
- return a normalized binding, not raw database rows
- return no owner ID or workspace metadata to the browser
- sanitize database failures
- fail closed on missing, duplicate, malformed, or inconsistent rows
- avoid trusting browser-readable RLS results as the only server authorization
- keep service-role access inside the backend dependency boundary

## Enumeration And Error Contract

Unauthenticated requests return a fixed sanitized 401.

Authenticated non-owner, missing-agent, missing-workspace, and inconsistent
binding outcomes must not expose another user's existence or identifiers.
Before implementation, the owner-auth helper phase must choose and test one
consistent external policy:

- fixed 404 for all inaccessible bindings, or
- fixed 403 for all inaccessible bindings

Internal audit events may distinguish causes using sanitized result codes, but
must not include bearer tokens, owner IDs in public logs, OAuth values, wallet
payloads, Telegram bot tokens, or service-role keys.

## Session And Replay Rules

Future owner-facing route auth must:

- validate the session on every sensitive request
- reject missing or malformed bearer authorization
- avoid storing the bearer token
- avoid copying the bearer token into logs or errors
- not treat a previous dashboard page load as ongoing authorization
- require fresh ownership validation before revoke or authority changes

OAuth callback replay protection is separate from Supabase session validation
and must use the one-time transaction contract.

## CORS And Origin Boundary

The current shared Telegram `Access-Control-Allow-Origin: *` helper must not be
reused for official MCP owner routes.

Future owner-facing routes require an exact reviewed Kyra dashboard origin
allowlist and no credentialed wildcard origin. Callback behavior must use its
own redirect and browser-cookie policy rather than owner-route CORS.

## Telegram And Public Boundaries

Telegram, public agent pages, public APIs, LLM output, background jobs, and
unauthenticated clients must remain unable to:

- initiate official MCP OAuth
- query connection status
- revoke or disconnect credentials
- call the token broker
- submit owner, workspace, or agent identity claims
- receive authorization links
- receive credential-existence signals

Telegram bot tokens and official MCP credentials remain completely separate.

## Future Auth Helper File Boundary

A later explicitly approved local auth-helper milestone may propose:

```text
supabase/functions/official-mcp-shared/owner-auth.ts
supabase/functions/official-mcp-shared/owner-auth_test.ts
supabase/functions/official-mcp-shared/ownership.ts
supabase/functions/official-mcp-shared/ownership_test.ts
scripts/check-official-mcp-owner-auth-boundary.mjs
```

Those files are not approved in Phase 7AY. Existing Phase 7AX route files must
not import auth helpers until a separate code-bearing route-integration
approval is recorded.

## Required Test Matrix

Before auth helper code may be integrated into routes, tests must prove:

- missing bearer fails before environment, database, body, or query access
- malformed bearer fails with fixed sanitized 401
- rejected Supabase session fails closed
- owner ID cannot come from body, query, path, Telegram, wallet, or provider
- valid session derives one normalized owner user ID
- malformed agent/workspace IDs fail before database access
- missing and mismatched ownership do not leak identifiers
- cross-owner agent access fails
- agent/workspace mismatch fails
- database errors are sanitized
- service-role key is never returned or logged
- ownership is revalidated for status and revoke
- callback cannot use owner identity from query parameters
- token broker rejects every public caller class
- disabled route behavior remains unchanged

## Current Repository Boundary

After Phase 7AY:

- Phase 7AX route skeletons remain `disabled_safe`
- no route reads body or query data for business logic
- no official route validates a Supabase user yet
- no official route performs ownership lookup
- no official route has Supabase function configuration
- no OAuth transaction, state, PKCE, cookie, or token handling exists
- no provider or MCP session code exists
- no frontend or Telegram wiring exists
- wallet execution remains disabled
- no signing or transaction submission exists
- no deploy or push occurred

## Verification

- `npm run check:phase-7ay`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Trusted owner identity source is explicit.
- Owner/workspace/agent binding is explicit.
- Caller classes for all five routes are explicit.
- Callback and token-broker auth are separated from owner bearer auth.
- Gateway JWT intent and function-level validation are distinguished.
- Request ordering, enumeration, replay, CORS, logging, and privacy rules are
  explicit.
- Future auth-helper files and tests are bounded.
- Runtime remains NO-GO and `disabled_safe`.
- No auth helper, request parsing, ownership query, provider call, OAuth
  processing, token handling, MCP session, wallet prompt, signing,
  transaction, deploy, or push occurred.
