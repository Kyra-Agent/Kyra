# Phase 7 Pre-Execution Audit

Date: 2026-06-18

Status: Phase 7A started. No production wallet prompt, Base MCP runtime call,
prepared-action write, signing, swap, transfer, contract call, or transaction
submission is enabled.

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
- Base MCP preparation remains backend-only and runtime-disabled.
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
