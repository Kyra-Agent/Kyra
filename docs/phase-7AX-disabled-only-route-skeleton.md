# Phase 7AX Disabled-Only Route Skeleton

Date: 2026-06-20

Status: local disabled-only skeleton complete. Runtime remains NO-GO.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `docs/phase-7AV-disabled-route-test-harness-plan.md`
- `docs/phase-7AW-disabled-only-route-skeleton-approval-packet.md`

## Approval Record

The owner explicitly approved Phase 7AX local disabled-only skeleton work on
2026-06-20.

This approval permits local code and tests only. It does not approve push,
deploy, production function configuration, provider contact, OAuth enablement,
token handling, Base Account connection, wallet prompts, signing, or
transactions.

## Implemented Boundary

Phase 7AX adds:

- independent exact-`true` route gate parsing
- fixed sanitized disabled responses
- fixed sanitized not-implemented responses
- secret-bearing text detection and fallback redaction
- five disabled-only route entry points
- gate, redaction, route response, unread-body, and no-leak tests
- a static file-boundary and no-wiring checker

The local route skeletons are:

- `official-mcp-oauth-start`
- `official-mcp-oauth-callback`
- `official-mcp-token-broker`
- `official-mcp-revoke`
- `official-mcp-status`

## Fail-Closed Behavior

When a route gate is missing or not the exact lowercase string `true`, the
route returns fixed HTTP 403 with its `*_disabled` result code.

If a route gate is mistakenly set to exact lowercase `true`, the route still
has no enabled implementation and returns fixed HTTP 503 with its
`*_not_implemented` result code.

Therefore setting a gate cannot:

- contact a provider
- produce an authorization URL
- process an OAuth callback
- exchange or persist a token
- create an MCP session
- discover or invoke a tool
- reveal credential state
- open a wallet
- sign
- submit a transaction

## Request Privacy

The route skeletons do not read request bodies and do not parse callback or
status query parameters for business logic.

Tests inject secret-like OAuth codes, state, access tokens, refresh tokens,
credential references, owner IDs, and agent IDs. Fixed responses must not
contain those values.

Responses include:

- `content-type: application/json; charset=utf-8`
- `cache-control: no-store`
- `referrer-policy: no-referrer`
- `x-content-type-options: nosniff`

User wallet authority and user Telegram bot-token privacy remain the highest
priority.

## No-Wiring Boundary

Phase 7AX does not add:

- Supabase production function configuration
- production environment values
- provider URLs or network calls
- OAuth discovery
- PKCE, state, nonce, or cookies
- Supabase auth or database clients
- token schema or migrations
- frontend imports or controls
- Telegram imports or commands
- wallet connector changes
- MCP client or tool code
- signing or transaction code

The functions are not configured for deployment in `supabase/config.toml`.

## Verification Contract

`scripts/check-official-mcp-disabled-routes.mjs` enforces:

- the exact approved file list
- no extra official MCP runtime files
- no provider/network calls
- no provider URL
- no OAuth endpoint or PKCE logic
- no request body or query parsing
- no browser token storage
- no wallet or transaction methods
- no deploy configuration
- no frontend or Telegram wiring
- no official MCP token schema
- independent exact-`true` gates
- fixed fail-closed responses
- required redaction coverage

## Result

Phase 7AX result: `disabled_safe`.

This result only means the local skeleton satisfies the disabled-route
contract. It does not authorize controlled enablement or change Phase 7C from
NO-GO.

## Verification

- `npm run check:official-mcp-disabled-routes`
- `npm run check:phase-7ax`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Owner approval for local disabled-only code is recorded.
- Exact approved files exist and no additional official MCP runtime files exist.
- All five routes fail closed with fixed sanitized responses.
- Exact-`true` gates are independent.
- Request bodies and query values are not processed for business logic.
- Provider, OAuth, token, MCP, wallet, signing, and transaction logic is absent.
- Frontend, public-agent, and Telegram wiring is absent.
- Production function configuration is absent.
- Runtime remains NO-GO.
- No push or deploy occurred.
