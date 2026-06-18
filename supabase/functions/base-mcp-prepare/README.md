# base-mcp-prepare

Default-off Edge Function for read-only Base MCP status preparation.

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
- Call only the reviewed read-only status provider adapter.
- Return only a bounded read-only preparation summary.
- Keep `opaquePayloadRef` null for the first status-check candidate.
- Treat missing, invalid, or non-HTTPS Base MCP endpoints as not configured.
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
