# base-mcp-prepare

Default-off Edge Function for read-only Base MCP status preparation.

This function implements Kyra's custom `kyra_status_v1` status bridge. It is
not an authenticated client for the official OAuth endpoint at `mcp.base.org`.

Phase 7M hardens the exact provider contract around the Phase 7K signed-in
owner-dashboard caller and Phase 7L smoke preparation. The caller does not
change the backend runtime gate, provider credential boundary, storage state,
wallet state, or Telegram execution boundary.

Current behavior:

- `OPTIONS` returns CORS `ok`.
- `POST` validates method, JSON content type, and body size.
- With `KYRA_BASE_MCP_PREP_ENABLED` disabled or unset, returns
  `base_mcp_disabled` before reading request body, required env values, user
  session, service-role clients, or database data.

Enabled contract:

- Require `Authorization: Bearer`.
- Validate the Supabase session.
- Accept only the `base_mcp_status_check` action shape.
- Verify agent ownership before any adapter call.
- Require exact provider protocol `kyra_status_v1`.
- Enforce a persistent service-role rate limit before any provider call.
- Call only the reviewed read-only status provider adapter.
- Require the exact `kyra_status_v1` request/response contract.
- Require the provider response request id to match the current request.
- Reject non-JSON, extra-field, mismatched, or over-4096-byte responses.
- Return only a bounded read-only preparation summary.
- Keep `opaquePayloadRef` null for the first status-check candidate.
- Treat missing, invalid, or non-HTTPS Base MCP endpoints as not configured.
- Treat missing or mismatched provider protocol as not configured.
- Reject `mcp.base.org` because it is not the custom bridge protocol.
- Return only bounded request-id and outcome correlation headers.
- Keep prepared-action storage unwired until separate SQL/storage approval.

Hard boundaries:

- Do not expose `KYRA_BASE_MCP_ENDPOINT`, `KYRA_BASE_MCP_API_KEY`, service-role
  keys, owner IDs, workspace internals, Telegram token refs, raw provider
  errors, raw calldata, transaction hashes, or prepared transaction payloads.
- Do not call this function from Telegram.
- Do not accept swaps, sends, approvals, transfers, contract calls, bridges,
  claims, arbitrary calldata, token amounts, recipients, private keys, seed
  phrases, or Telegram bot tokens.
- Do not expand beyond the reviewed read-only status provider adapter without a
  separate review.
- Do not enable the runtime gate until the rate-limit SQL verifier and a
  compatible provider have been approved.
- Do not add official MCP OAuth registration, wallet scopes, token storage, or
  tool calls without a separate security review.
- Phase 7O defines that review contract; this custom function remains outside
  the official OAuth, token, MCP-session, and wallet-authority boundaries.
- Phase 7P selects a future backend-for-frontend OAuth architecture but keeps
  implementation blocked and separate from this custom bridge.
