# Phase 7M Provider Contract Qualification

Date: 2026-06-19

Status: local provider contract hardened; no production provider approved.

## Objective

Define and enforce the only provider protocol accepted by Kyra's first
read-only Base MCP status candidate. A provider must pass this contract before
its endpoint or credential can be considered for a controlled smoke.

## Request Contract

Kyra sends `POST /status-check` with `Content-Type: application/json` and the
exact bounded body below:

```json
{
  "actionKind": "base_mcp_status_check",
  "protocol": "kyra_status_v1",
  "chain": "base",
  "mode": "read_only",
  "requestId": "base-status:<bounded-random-id>",
  "requestedAt": "<ISO-8601 timestamp>"
}
```

The request does not contain owner id, workspace id, agent id, wallet address,
token amount, recipient, calldata, transaction hash, Telegram token, private
key, or seed phrase.

## Response Contract

The provider must return HTTP 2xx, `Content-Type: application/json`, no more
than 4096 bytes, and exactly these six fields:

```json
{
  "protocol": "kyra_status_v1",
  "status": "ok",
  "actionKind": "base_mcp_status_check",
  "chain": "base",
  "mode": "read_only",
  "requestId": "<exact request id received from Kyra>"
}
```

No extra fields are accepted. Kyra does not accept or expose provider calldata,
payload references, wallet data, transaction material, or provider diagnostics.

## Automatic Rejection Matrix

- Non-2xx response.
- Missing or non-JSON content type.
- Invalid or oversized content length.
- Streamed body larger than 4096 bytes.
- Invalid JSON, arrays, null, or primitive values.
- Missing or extra response fields.
- Protocol, action, chain, or mode mismatch.
- Request-id mismatch or replayed response.
- Timeout, transport failure, or abort.

Every case collapses to a fixed sanitized unavailable or timeout result. Raw
provider errors and response bodies are never returned to the dashboard.

## Qualification Decision

`https://mcp.base.org/` is not approved for this adapter because the observed
endpoint does not implement `POST /status-check` with `kyra_status_v1`.

A candidate provider is approved only when:

1. Its ownership and operator are documented.
2. Its HTTPS endpoint and credential lifecycle are reviewed.
3. It passes the exact local contract and negative-case suite.
4. It agrees not to require wallet, signing, calldata, or Telegram data.
5. Timeout, rate-limit, observability, and rollback behavior are approved.
6. The owner explicitly approves one controlled smoke window.

## Preserved Boundaries

- Runtime gate remains default-off.
- Rate-limit SQL remains review-only.
- Telegram and public routes cannot call the provider.
- No prepared-action storage write is enabled.
- No wallet prompt, signing, transaction submission, swap, transfer, approval,
  bridge, or contract call is enabled.
- No provider secret is stored in frontend variables or committed files.

## Verification

- `deno test --quiet supabase/functions/base-mcp-prepare`
- `npm run check:phase-7m`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Exact request and response contracts are enforced in runtime code.
- Response size and content type are bounded.
- Request-id binding prevents mismatched success responses.
- Negative cases fail closed with sanitized output.
- No production provider is claimed approved without evidence.
