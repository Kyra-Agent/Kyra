# Phase 7G Logs, Errors, And Observability Audit

Date: 2026-06-19

Status: audit packet started. This phase does not enable wallet prompts,
signing, transaction submission, Telegram execution, Base MCP writes, or
prepared-action production storage.

## Objective

Phase 7G audits Kyra's observability boundary before any execution-adjacent
feature can move closer to production. The goal is to prove that runtime errors,
activity logs, dashboard events, Telegram delivery failures, provider failures,
and Base MCP failures are useful enough to debug but never leak crown-jewel
data.

## Crown-Jewel Log Boundary

Logs, UI errors, API responses, activity logs, local browser observability, and
test output must not include:

- Telegram bot tokens.
- Telegram webhook secret tokens.
- wallet private keys, seed phrases, mnemonics, or raw signing payloads.
- raw calldata.
- raw provider payloads.
- OpenRouter, OpenAI-compatible, Supabase secret, or service-role API keys.
- JWT access tokens.
- unbounded request or response bodies.
- unredacted owner identifiers where a bounded status message is enough.

## Current Findings

- Runtime Edge Function source has no raw `console.*` logging.
- Browser-side backend events are local-only, bounded to `MAX_EVENTS = 8`, and
  sanitized before storage.
- Dashboard activity logs are column-scoped and sanitized before display.
- Deploy activity logs are sanitized before backend insert.
- Supabase REST errors are collapsed through `sanitizeSupabaseMessage`.
- Telegram connect, dashboard status, webhook, delivery, token resolver, owner
  link, disconnect, and template-context paths use `HttpError` with bounded
  messages.
- Telegram agent-brain provider failures collapse to fixed unavailable or
  invalid-response messages.
- Base MCP provider failures collapse to bounded adapter failures and never
  return raw provider payloads.
- Execution result failures use fixed `ExecutionFailureCode` messages.

## Runtime Logging Rules

- Runtime Edge Functions must not call raw `console.log`, `console.error`,
  `console.warn`, `console.info`, `console.debug`, or `console.trace`.
- Any future server log sink must accept structured, allowlisted fields only.
- Request bodies, Telegram update bodies, provider responses, wallet payloads,
  calldata, auth headers, and tokens must not be logged.
- Test/check scripts may print pass/fail summaries, but must not print secrets
  or runtime payloads.

## User-Facing Error Rules

- Provider, wallet, Base MCP, Telegram, Supabase, and backend failures must map
  to bounded product messages.
- Unknown errors may select a safe category, but must not echo raw exception
  text unless it is first sanitized and bounded.
- Telegram delivery failures must not expose bot tokens or Telegram API
  response bodies.
- Agent-brain failures must not expose provider status bodies, request payloads,
  prompt internals, or API keys.
- Base MCP failures must not expose provider JSON-RPC bodies, endpoint payloads,
  calldata, or token spend fields.

## Activity Log Rules

- Activity log writes are limited to product-level state transitions.
- Activity log display sanitizes Telegram tokens, API keys, JWTs, private-key
  looking values, and secret phrases.
- Dashboard activity log reads stay column-scoped and bounded.
- Execution result activity copy may include a shortened transaction hash only
  after a submitted/confirmed state exists.

## Observability Rules

- Browser observability stays local-only and bounded.
- Backend event messages, codes, and sources are sanitized before local storage.
- Observability must never block the product flow.
- Observability must not create a second persistence path for sensitive data.

## Gaps Before Production Execution

- No external error-monitoring sink is configured yet. If added later, it needs
  a separate allowlist and redaction packet before production use.
- No production execution logs are enabled yet because production execution is
  still gated.
- Live smoke logging for Phase 7H still needs a reviewed checklist and rollback
  criteria.

## Phase 7G Done Criteria

- Logs/errors/observability audit packet exists.
- Automated checker blocks raw runtime `console.*` logging.
- Automated checker blocks raw secret-looking values in public/runtime source.
- Automated checker verifies dashboard and deploy activity-log sanitization.
- Automated checker verifies browser observability is bounded and sanitized.
- Automated checker verifies provider, Telegram, Base MCP, wallet, and execution
  failure boundaries use sanitized fixed messages.
- `npm run check:phase-7` includes the Phase 7G checker.
- No execution capability is enabled by this audit.

## Next Step

Proceed to Phase 7H only after this audit stays green:

- release and rollback audit
- live smoke checklist
- rollback plan for every production gate
- Netlify push batching discipline
