# base-mcp-prepare

Default-off Edge Function skeleton for future Base MCP preparation.

Current behavior:

- `OPTIONS` returns CORS `ok`.
- `POST` validates method, JSON content type, and body size.
- With `KYRA_BASE_MCP_PREP_ENABLED` disabled or unset, returns
  `base_mcp_disabled` before reading request body, required env values, user
  session, service-role clients, or database data.

Future enabled contract:

- Require `Authorization: Bearer`.
- Validate the Supabase session.
- Accept only the `base_mcp_status_check` action shape.
- Verify agent ownership before any adapter call.
- Return only a bounded read-only preparation summary.
- Keep `opaquePayloadRef` null for the first status-check candidate.

Hard boundaries:

- Do not expose `KYRA_BASE_MCP_ENDPOINT`, `KYRA_BASE_MCP_API_KEY`, service-role
  keys, owner IDs, workspace internals, Telegram token refs, raw provider
  errors, raw calldata, transaction hashes, or prepared transaction payloads.
- Do not call this function from Telegram.
- Do not accept swaps, sends, approvals, transfers, contract calls, bridges,
  claims, arbitrary calldata, token amounts, recipients, private keys, seed
  phrases, or Telegram bot tokens.
- Do not enable a live Base MCP provider call without a separate review.
