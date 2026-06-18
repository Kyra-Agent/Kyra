# Phase 7K Owner Dashboard Base MCP Status Caller

Date: 2026-06-19

Status: local owner-dashboard caller implemented. The production Base MCP
runtime gate remains default-off. This phase does not enable prepared-action
storage, wallet prompts, signing, approvals, transaction submission, Telegram
execution, swaps, transfers, or contract calls.

## Objective

Provide one explicit owner-dashboard control for the reviewed read-only Base
MCP status action:

- action kind: `base_mcp_status_check`
- chain: `base`
- mode: `read_only`
- caller: signed-in owner dashboard
- agent scope: currently selected persisted agent
- workspace scope: selected agent workspace
- request freshness: generated at owner click

## Dashboard Boundary

The caller requires:

1. A signed-in Supabase session.
2. A persisted selected agent.
3. The selected agent workspace id.
4. An explicit owner click.
5. A fresh session check before the request.
6. Backend ownership verification before provider access.

The dashboard cannot provide:

- action kind overrides
- arbitrary chain selection
- arbitrary mode selection
- wallet address
- token amount
- recipient
- calldata
- transaction payload
- provider endpoint
- provider API key
- Telegram bot token

## Response Boundary

The browser accepts a success only when:

- `ok` is exactly `true`
- status is exactly `preview_ready`
- action kind is exactly `base_mcp_status_check`
- chain is exactly `Base`
- risk is exactly `read-only`
- `opaquePayloadRef` is exactly `null`
- route and value summaries are non-empty and bounded to 160 characters
- expiry is null or a future timestamp no more than 10 minutes away

Invalid or unexpected provider responses collapse to a generic unavailable
message. Raw response text, endpoint details, stack traces, and secrets are not
displayed.

## Runtime State

The dashboard caller can be shipped while the backend gate remains disabled.
Until `KYRA_BASE_MCP_PREP_ENABLED=true` is deliberately configured, an owner
click receives the bounded `base_mcp_disabled` response.

Enabling the backend gate still requires:

- reviewed HTTPS provider endpoint
- backend-only API key, if required
- live smoke approval
- rollback readiness

## Preserved Safety Boundaries

- Prepared-action storage remains unwired.
- No database write occurs from the status check.
- No wallet provider or wallet prompt is invoked.
- No approval record is created.
- No signing or transaction submission is possible.
- Public agent pages cannot call the function.
- Telegram runtime cannot call the function.
- Base MCP provider credentials remain backend-only.

## Verification

```powershell
npm run check:phase-7k
npm run check:phase-7
deno test --quiet supabase/functions
npm run build
git diff --check
```

## Done Criteria

- Owner dashboard has one explicit read-only status control.
- Session refresh happens before the request.
- Agent and workspace scope come from persisted owner dashboard data.
- Request fields are fixed and bounded.
- Response is strictly validated before display.
- Stale responses are discarded after agent or account changes.
- Backend runtime gate remains default-off.
- Storage, wallet, approval, signing, submission, public, and Telegram paths
  remain disabled.
