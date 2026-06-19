# Phase 7 Pre-Execution Audit

Date: 2026-06-19

Status: Phase 7S provider drift response runbook complete. The first read-only
Base MCP status adapter and owner-dashboard caller are protected by an exact
protocol gate and service-role rate-limit contract. No compatible production
provider is approved and the runtime gate remains disabled. No production wallet prompt,
prepared-action write, signing, swap, transfer, contract call, Telegram
execution, or transaction submission is enabled.

## Objective

Phase 7 moves Kyra from a hardened non-executing foundation toward one narrow
live execution candidate, but only after a full security and ownership audit.

The first goal is not speed. The first goal is proving that no execution path can
touch a user wallet, Telegram token, prepared-action record, Base MCP runtime,
or transaction submission path without explicit owner approval and a reviewed
gate.

## Crown Jewels

These remain the highest-priority assets:

- User wallet security.
- User Telegram bot token security.
- Owner workspace boundaries.
- Prepared-action ownership and replay protection.
- Transaction submission integrity.
- Sanitized logs and user-facing errors.

If a product shortcut conflicts with any of these, the shortcut loses.

## Phase 7 Entry State

Phase 6 is closed as a hardened foundation:

- Telegram + LLM read-only replies are live.
- Telegram execution requests are refused.
- Wallet/Base readiness and review surfaces exist.
- Base MCP preparation remains backend-only. Phase 7J wires only the read-only
  status provider adapter behind exact runtime gate, HTTPS endpoint, owner auth,
  ownership lookup, and request freshness.
- Prepared-action storage SQL remains review-only.
- Wallet provider dependencies are installed but runtime-gated.
- Wallet prompt/signing/submission paths are not enabled.
- Owner dashboard sensitive reads are column-scoped.
- Activity log messages are sanitized before backend writes and dashboard
  display.

## Non-Negotiable Gates

Do not enable any of these until the matching audit packet, verifier, rollback,
and owner approval are complete:

- Prepared-action SQL in production.
- Base MCP runtime adapter calls.
- Prepared-action storage writes.
- Wallet connect prompts.
- Wallet signing.
- Transaction submission.
- Telegram-created approval drafts.
- Telegram-triggered execution.
- Arbitrary swaps, transfers, or contract calls.
- Public viewer-triggered actions.

## Audit Scope

### 7A - Entry Lock And Source Audit

- Confirm Phase 6 check suite still passes.
- Confirm public docs do not overclaim execution.
- Confirm source-of-truth context says Phase 7 starts with audit.
- Confirm no public route exposes wallet, approval, prepared-action, Telegram
  token, or transaction-sensitive fields.
- Confirm dashboard owner reads stay column-scoped.

### 7B - Ownership, RLS, And Write Path Audit

- Audit packet: `docs/phase-7B-ownership-rls-write-path-audit.md`.
- Review every write path that could create, update, or resolve execution
  records.
- Confirm writes require authenticated owner context or service-role backend
  mediation.
- Confirm wrong-owner access fails closed.
- Confirm anon access has no sensitive table privileges.
- Confirm verifier SQL returns booleans only and no row data.
- Confirm rollback SQL is reviewed before any forward SQL is applied.

### 7C - Base MCP Runtime Audit

- Audit packet: `docs/phase-7C-base-mcp-runtime-audit.md`.
- Keep `base-mcp-prepare` disabled until runtime config, provider endpoint,
  request signing, ownership, replay, rate limits, and failure sanitization are
  reviewed together.
- Keep provider adapter read-only for the first runtime smoke.
- Do not send owner, workspace, agent, wallet, token, or secret scope to the
  provider.
- Do not return raw provider payloads, calldata, token approvals, or transaction
  hashes.

### 7D - Prepared Action Storage Audit

- Audit packet: `docs/phase-7D-prepared-action-storage-approval.md`.
- Apply no storage SQL until forward, rollback, verifier, RLS, column grants,
  idempotency, expiry, replay protection, and owner-summary view are approved.
- Store only bounded owner-summary fields.
- Do not store wallet addresses, raw calldata, private keys, seed phrases,
  Telegram token refs, raw provider payloads, API keys, or transaction hashes.
- Keep public profiles free of prepared-action data.

### 7E - Wallet Prompt And Signing Audit

- Audit packet: `docs/phase-7E-wallet-prompt-signing-audit.md`.
- Wallet prompts must be user-initiated from the owner dashboard.
- No prompt opens on page load, public pages, Telegram messages, or background
  effects.
- The first signable action must be a separately reviewed action kind, not
  `base_mcp_status_check`.
- User rejection must not create a transaction hash.
- Network mismatch must fail safely before signing.
- The connected wallet pays gas.

### 7F - Telegram Execution Boundary Audit

- Audit packet: `docs/phase-7F-telegram-execution-boundary-audit.md`.
- Telegram remains read-only until the dashboard/wallet path is live and
  reviewed.
- `canExecuteFromTelegram` remains `false`.
- `canCreateDraftNow` remains `false`.
- Telegram can classify unsafe intent but must not create approval records,
  prepared actions, wallet prompts, Base MCP calls, signatures, or transaction
  submissions.
- Telegram bot tokens remain backend-only.

### 7G - Logs, Errors, And Observability Audit

- Audit packet: `docs/phase-7G-logs-errors-observability-audit.md`.
- Runtime Edge Functions do not use raw `console.*` logging without reviewed
  sanitization.
- Provider, wallet, MCP, Telegram, and backend errors collapse to sanitized
  user-facing messages.
- Activity logs stay bounded and sanitized.
- No logs include bot tokens, wallet secrets, raw payloads, calldata, API keys,
  transaction signing payloads, or unredacted user identifiers.

### 7H - Release And Rollback Audit

- Audit packet: `docs/phase-7H-release-rollback-audit.md`.
- Every production gate needs a rollback plan before enabling.
- Every enabled runtime gate needs a live smoke checklist.
- Live smoke must use a low-risk test account.
- Netlify deploys should be batched to avoid unnecessary credit usage.
- Push only after local checks and owner approval.

### 7I - First Live Candidate Decision

- Audit packet: `docs/phase-7I-base-mcp-status-decision.md`.
- The first selected candidate is read-only Base MCP status preparation.
- Candidate action kind is exactly `base_mcp_status_check`.
- Candidate chain is exactly `base`.
- Candidate surface is owner dashboard only.
- Wallet prompts, signing, transaction submission, prepared-action production
  writes, and Telegram-triggered execution remain disabled.

### 7J - Base MCP Status Provider Wiring

- Audit packet: `docs/phase-7J-base-mcp-provider-wiring.md`.
- Runtime dependencies wire only `createBaseMcpStatusCheckAdapter`.
- Runtime gate still requires exact `KYRA_BASE_MCP_PREP_ENABLED=true`.
- Provider endpoint still must be HTTPS and backend-only.
- Provider payload excludes owner id, workspace id, agent id, wallet data,
  token amounts, calldata, transaction hashes, and Telegram token refs.
- Prepared-action storage remains unwired.
- Telegram and public routes cannot trigger Base MCP.
- Wallet prompts, signing, transaction submission, swaps, transfers, approvals,
  and contract calls remain disabled.

### 7K - Owner Dashboard Base MCP Status Caller

- Audit packet: `docs/phase-7K-owner-dashboard-status-caller.md`.
- One explicit owner click can request only `base_mcp_status_check`.
- The request uses the selected persisted agent and its workspace id.
- Session freshness is checked before the request.
- Browser response parsing requires the exact read-only summary shape.
- The backend runtime gate remains default-off until separately approved.
- No storage write, wallet prompt, approval, signing, submission, public route,
  or Telegram execution path is enabled.

### 7L - Controlled Live Smoke Preparation

- Audit packet: `docs/phase-7L-controlled-live-smoke-preparation.md`.
- Require exact provider protocol `kyra_status_v1`; generic MCP endpoints are
  not compatible by assumption.
- Require persistent service-role rate limiting before provider calls.
- Keep rate-limit forward, verifier, and rollback SQL review-only until explicit
  target-project approval.
- Use bounded correlation headers without external raw-data logging.
- Keep the production runtime gate disabled until a compatible provider,
  database verifier, rollback, and controlled smoke window are approved.

### 7M - Provider Contract Qualification

- Audit packet: `docs/phase-7M-provider-contract-qualification.md`.
- Require exact bounded request and response shapes for `kyra_status_v1`.
- Bind provider success to the original request id.
- Reject non-JSON, malformed, mismatched, extra-field, and oversized responses.
- Cap provider response bodies at 4096 bytes, including streamed bodies.
- Keep provider errors sanitized and keep the production gate disabled until a
  real candidate passes qualification with owner approval.

### 7N - Official Base MCP Protocol Decision

- Audit packet: `docs/phase-7N-official-base-mcp-protocol-decision.md`.
- Treat the custom `kyra_status_v1` bridge and official OAuth MCP as separate
  protocol lanes.
- Reject `mcp.base.org` from the custom endpoint normalizer.
- Do not register, authorize, request tokens, initialize authenticated MCP, or
  request agent-wallet scopes during this phase.
- Require a separate wallet-authority, consent, token-storage, and tool audit
  before official MCP implementation.

### 7O - Official MCP OAuth And Wallet-Authority Threat Model

- Audit packet: `docs/phase-7O-official-mcp-oauth-threat-model.md`.
- Define assets, actors, trust boundaries, threats, and fail-closed outcomes.
- Require exact issuer, redirect, resource, audience, owner, workspace, PKCE,
  and one-time state binding before any future code exchange.
- Keep official OAuth environment variables, token storage, sessions, tool
  calls, agent-wallet scopes, and wallet execution absent from runtime.
- Require separate architecture, scope, storage, tool, and smoke approvals
  before implementation.

### 7P - Official MCP OAuth Client Architecture

- Architecture packet:
  `docs/phase-7P-official-mcp-oauth-client-architecture.md`.
- Select a backend-for-frontend client with server-owned transaction state,
  callback exchange, encrypted token lifecycle, and MCP transport.
- Reject browser token handling, Telegram initiation, custom-bridge reuse,
  hardcoded discovery, runtime registration, and shared user tokens.
- Keep implementation blocked while Protected Resource Metadata is unavailable
  and the provider advertises only wallet-authority scopes.
- Require scope/consent qualification before callback or token-storage work.

### 7Q - Official MCP Scope And Consent Qualification

- Qualification packet:
  `docs/phase-7Q-official-mcp-scope-consent-qualification.md`.
- Reject omitted scopes because MCP fallback can select the protected
  resource's complete scope set, which cannot currently be verified.
- Reject `agent_wallet:transact` because current documented capabilities include
  broad spending, signing, contract-call, x402, plugin, and multi-chain surface
  without an exact scope-to-tool authority map.
- Reject `agent_wallet:escalate` because no current official authority
  definition was found.
- Keep all OAuth implementation blocked until a non-escalating scope, exact
  tool map, and complete consent contract are verifiable.

### 7R - Official Base MCP Provider Evidence Monitor

- Monitor packet: `docs/phase-7R-provider-evidence-monitor.md`.
- Observe only four exact public metadata/documentation URLs with GET, no
  credentials, no body, no redirects, bounded responses, and sanitized output.
- Track a reviewed semantic baseline and report drift without modifying it.
- Never call authorization, registration, token, MCP session, tool, wallet, or
  transaction endpoints.
- Keep drift review manual and keep all OAuth/runtime gates disabled.

### 7S - Provider Drift Response Runbook

- Runbook packet: `docs/phase-7S-provider-drift-response-runbook.md`.
- Classify provider evidence drift as critical or caution before any baseline
  update.
- Treat authorization, token, registration, scope, protected-resource, tool-map,
  and escalation-semantics changes as critical drift.
- Re-run Phase 7O and Phase 7Q before changing any official MCP decision.
- Require explicit owner approval before manually updating the reviewed
  baseline.
- Keep OAuth client work, token storage, MCP sessions, tool calls, wallet
  prompts, signatures, approvals, swaps, transfers, contract calls, Telegram
  drafts, and Telegram execution blocked during drift response.

## Candidate Selection Rules

The first live candidate must be narrow:

- one action kind
- one chain: Base
- one owner workspace
- one reviewed provider path
- one explicit approval path
- no arbitrary calldata
- no arbitrary recipient
- no autonomous execution
- no Telegram execution trigger

The current safest candidate remains read-only Base MCP status preparation. A
real signable action requires a separate Phase 7 decision packet.

## Required Checks

Before any Phase 7 push or deploy:

- `npm run check:phase-6`
- `npm run check:phase-7-entry`
- `npm run check:phase-7b`
- `npm run check:phase-7c`
- `npm run check:phase-7d`
- `npm run check:phase-7e`
- `npm run check:phase-7f`
- `npm run check:phase-7g`
- `npm run check:phase-7h`
- `npm run check:phase-7i`
- `npm run check:phase-7j`
- `npm run check:phase-7k`
- `npm run check:phase-7l`
- `npm run check:phase-7m`
- `npm run check:phase-7n`
- `npm run check:phase-7o`
- `npm run check:phase-7p`
- `npm run check:phase-7q`
- `npm run test:phase-7r`
- `npm run check:phase-7r`
- `npm run check:phase-7s`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

Before any production execution gate:

- Supabase RLS/ownership verifier reviewed.
- Rollback SQL reviewed.
- Runtime environment gate reviewed.
- Low-risk test account selected.
- Owner approval captured.
- Live smoke checklist prepared.

## Phase 7A Done Criteria

- Phase 7 audit packet exists.
- Automated entry check exists.
- Phase 6 suite still passes.
- Current source confirms no production execution is enabled.
- Next work item is selected from audit findings, not guessed.
