# Phase 7F Telegram Execution Boundary Audit

Date: 2026-06-19

Status: audit packet started. Telegram remains read-only for wallet, approval,
Base MCP, prepared-action, signing, and onchain execution paths.

## Objective

Phase 7F audits the Telegram execution boundary before Kyra can ever let
Telegram create execution-adjacent state.

This phase does not enable Telegram execution. The goal is to prove that
Telegram can classify unsafe execution intent, but cannot create approval
records, prepared actions, Base MCP calls, wallet prompts, signatures, or
transaction submissions.

## Current Finding

Current state is acceptable for Phase 7F entry:

- Telegram parser emits `commandKind: "read_only"` only.
- Supported slash commands are `/help`, `/status`, `/agent`, `/actions`,
  `/modules`, and `/policy`.
- Plain text is treated as bounded read-only chat.
- `reviewTelegramExecutionGate` keeps `canExecuteFromTelegram: false`.
- `reviewTelegramExecutionGate` keeps `canCreateDraftNow: false`.
- Owner/admin execution-like text can only become
  `approval_draft_candidate`.
- `approval_draft_candidate` creates no database row today.
- Direct execution wording is blocked.
- Non-owner execution intent is blocked.
- Secret-like content is blocked.
- Replay key construction is local-only and validated.
- The read-only pipeline can replace unsafe chat replies with a refusal, but it
  does not write state.
- Agent-brain prompts and provider requests are constrained to `read_only`.
- Agent-brain output cannot claim wallet, approval, Base, or onchain execution
  happened.
- Telegram runtime does not call Base MCP preparation.
- Telegram runtime does not read or write prepared-action storage.
- Telegram runtime does not open wallet prompts or sign transactions.

## Allowed Telegram Behavior

Telegram may:

- answer `/help`, `/status`, `/agent`, `/actions`, `/modules`, and `/policy`
- answer bounded read-only natural chat
- classify unsafe execution intent
- refuse unsafe execution requests
- describe that future execution must continue from the owner dashboard
- provide read-only risk review or checklist language
- enrich read-only replies with reviewed template context
- enrich read-only replies with reviewed LLM provider output

## Blocked Telegram Behavior

Telegram must not:

- execute swaps, transfers, approvals, or contract calls
- sign messages or transactions
- submit or broadcast transactions
- open wallet prompts
- create approval records
- create prepared actions
- call Base MCP runtime preparation
- store transaction hashes
- process private keys, seed phrases, API keys, or Telegram tokens in chat text
- rely on LLM output to bypass execution gates
- treat community or public chats as execution-authorized

## Execution Gate Rules

The execution gate may return only:

- `read_only_allowed`
- `approval_draft_candidate`
- `blocked`

Every decision must keep:

- `canExecuteFromTelegram: false`
- `canCreateDraftNow: false`

`approval_draft_candidate` is naming for a future dashboard flow only. It must
not create any row until prepared-action storage, approval writes, replay
protection, rate limits, dashboard review, and owner wallet approval are
approved together.

## Agent Brain Rules

LLM output must remain subordinate to deterministic gates:

- provider request mode must be `read_only`
- prompt says to answer only in read-only mode
- prompt forbids claiming wallet, approval, Base, or onchain execution happened
- unsafe execution intent must get a refusal, not extra generated content
- provider failures fall back safely
- provider output is bounded and sanitized

## Phase 7F Current Gaps

These remain blockers before Telegram can create execution-adjacent state:

- Prepared-action SQL is not applied.
- Runtime storage is not wired.
- Base MCP provider preparation is not wired.
- No Telegram-created draft schema exists.
- No Telegram draft replay/rate-limit storage exists.
- No dashboard handoff from Telegram draft to owner approval exists.
- Wallet prompt and signing remain disabled.

## Phase 7F Done Criteria

- Telegram execution boundary audit packet exists.
- Automated Phase 7F check exists.
- Parser remains read-only only.
- Execution gate keeps both execution booleans false.
- Telegram unsafe intent creates no rows.
- Telegram runtime has no Base MCP, prepared-action storage, wallet prompt, or
  signing call path.
- Agent-brain remains read-only and bounded.
- Phase 7 checks pass with 7F included.

## Next Step

Proceed to Phase 7G only after this audit stays green:

- logs, errors, and observability audit
- runtime `console.*` review
- provider/wallet/MCP/Telegram error sanitization
- no secret or raw payload logging
