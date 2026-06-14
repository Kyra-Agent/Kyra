# Phase 6B Base MCP Adapter Contract

Status: contract plus default-off backend skeleton. No live Base MCP call,
wallet prompt, signing, or transaction submission is enabled by this document or
the current function skeleton.

## Security Rule

User privacy, user wallet security, and user Telegram bot token security are the
top priority.

The adapter must fail closed. If any input, config, response, timeout, owner
scope, or action kind is uncertain, Kyra must not prepare an action.

## Runtime Gates

Do not add browser-exposed `VITE_` variables for Base MCP secrets.

Future Edge Function secrets:

- `KYRA_BASE_MCP_PREP_ENABLED`
  - default: disabled
  - enabled only when the exact value is `true`
- `KYRA_BASE_MCP_ENDPOINT`
  - backend-only endpoint URL
  - required only when preparation is enabled
- `KYRA_BASE_MCP_API_KEY`
  - backend-only secret if the selected provider requires it
  - never returned to the browser
- `KYRA_BASE_MCP_TIMEOUT_MS`
  - default: `2500`
  - maximum: `5000`

## First Allowed Action

Only one action kind is allowed for the first adapter slice:

- `base_mcp_status_check`

Explicitly not allowed:

- swaps
- sends
- approvals
- transfers
- bridges
- claims
- contract calls
- arbitrary calldata
- Telegram-triggered execution

## Request Shape

```ts
type BaseMcpStatusCheckRequest = {
  actionKind: "base_mcp_status_check";
  agentId: string;
  workspaceId: string;
  requestId: string;
  chain: "base";
  mode: "read_only";
  requestedAt: string;
};
```

Rules:

- `agentId` and `workspaceId` must be owner-scoped.
- `requestId` must be unique per preparation attempt.
- `mode` must be `read_only`.
- unsupported `actionKind` returns a fixed blocked response.
- no wallet address is required for the status-check candidate.
- no token amount, recipient, calldata, private key, seed phrase, or Telegram
  token field is accepted.

## Success Response Shape

```ts
type BaseMcpPrepareSuccess = {
  ok: true;
  status: "preview_ready";
  summary: {
    actionKind: "base_mcp_status_check";
    chain: "Base";
    routeSummary: string;
    valueSummary: string;
    risk: "read-only";
    expiryIso: string | null;
    opaquePayloadRef: string | null;
  };
};
```

Rules:

- `valueSummary` must make clear there is no token spend and no gas request.
- `opaquePayloadRef` stays `null` for the first status-check candidate.
- raw provider payloads are not displayed in the UI.
- public profiles must never receive this response.

## Failure Response Shape

```ts
type BaseMcpPrepareFailure = {
  ok: false;
  status: "blocked" | "failed";
  code:
    | "base_mcp_disabled"
    | "base_mcp_not_configured"
    | "base_mcp_unknown_action"
    | "base_mcp_timeout"
    | "base_mcp_unavailable";
  message: string;
};
```

User-facing failure messages must be fixed and sanitized.

Allowed user-facing messages:

- `Base MCP preparation is disabled.`
- `Base MCP preparation is not configured.`
- `This Base MCP action is not supported.`
- `Base MCP preparation timed out.`
- `No Base MCP action can be prepared right now.`

Do not return:

- provider stack traces
- endpoint URLs
- API keys
- request headers
- raw JSON-RPC errors
- raw calldata
- transaction hashes
- Telegram token refs

## Timeout And Retry

Initial adapter timeout:

- default: 2500 ms
- max: 5000 ms
- retry count: 0 for the first implementation

Timeouts return:

- `ok: false`
- `status: "failed"`
- `code: "base_mcp_timeout"`
- `message: "Base MCP preparation timed out."`

## Replay And Expiry

Preparation requests must be fresh before ownership lookup or adapter access.

Current request freshness contract:

- maximum request age: 5 minutes
- maximum future clock skew: 60 seconds
- stale or future `requestedAt` values return `invalid_request`

Preview expiry contract:

- `expiryIso` may be `null` for the first status-check candidate
- non-null preview expiry must be in the future
- non-null preview expiry must be no more than 10 minutes from request handling
- expired or excessive preview expiry is treated as an invalid adapter response
  and returned as a sanitized unavailable response

## Dashboard Preview

The owner dashboard may show only a summary:

- action name
- chain
- risk
- route summary
- value summary
- expiry
- approval requirement
- safety note

The dashboard must not show raw transaction payloads as the primary UX.

## Public Profile Boundary

Public profiles must not expose:

- wallet address
- wallet policy
- approval requests
- prepared transaction payloads
- transaction hashes
- Base MCP raw responses
- Telegram token refs

## Telegram Boundary

Telegram stays read-only.

Telegram may not:

- call the Base MCP adapter
- create prepared actions
- approve actions
- sign actions
- submit transactions

Telegram may only refuse execution requests and optionally describe that
preparation is dashboard-gated.

## Implementation Order

1. Keep the current dashboard preview contract. Done.
2. Add a backend-only Edge Function skeleton behind disabled gates. Done.
3. Add tests for allowed action kind, sanitizer behavior, default-off behavior,
   and owner-scope ordering. Done.
4. Add request freshness and preview expiry guards. Done.
5. Add a live provider adapter only after explicit review.
6. Add live status-check call only after explicit enablement approval.
7. Keep wallet signing deferred to Phase 6C.
