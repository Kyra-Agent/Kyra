# Phase 6 Execution Result Logging

Status: local model implemented. No wallet submission, Base MCP execution, or
Telegram execution is enabled.

## Goal

Every execution attempt must produce a small, owner-only state trail that is
safe to inspect after wallet interaction.

The model covers:

- `pending`
- `approved`
- `rejected`
- `submitted`
- `failed`
- `confirmed`

## Current Implementation

- `src/types/executionResult.ts` defines the transition and validation model.
- `scripts/test-execution-result.mjs` checks the state boundary.
- Dashboard now shows an owner-only execution audit trail.
- Supabase dashboard reads derive execution summaries from approval records
  without selecting `prepared_tx` or `tx_hash`.

## Safety Rules

- Transaction hashes are rejected before `submitted`.
- `confirmed` requires a transaction hash and confirmation data.
- `rejected` must not contain a transaction hash.
- `failed` must use sanitized failure copy.
- Execution result records must remain owner-only.
- Public profiles must not show execution result records.
- Telegram must not create a submitted or confirmed state.

## Rollback And Retry Rules

- `rejected`, `failed`, and `confirmed` are terminal states.
- Retry must create a new prepared action and a new execution result record.
- Failed pre-submission actions must not store a transaction hash.
- Failed post-submission actions may keep the submitted hash only if the hash
  came from a user-submitted wallet transaction.
- Rollback for a bad local state means hiding the unsafe state and preserving a
  sanitized owner-only activity note, not mutating public profile data.

## Sanitization

Raw provider, wallet, Base MCP, or backend errors must collapse into approved
copy such as:

- `User rejected the wallet request.`
- `Wallet must be connected to Base.`
- `Transaction submission failed safely.`
- `Transaction confirmation was not observed in time.`
- `Execution failed safely.`

Do not store raw RPC responses, provider stack traces, private keys, seed
phrases, Telegram bot tokens, or raw transaction payloads in owner-facing
execution result summaries.

## Not Enabled

- No wallet prompt.
- No transaction submission.
- No confirmation polling.
- No Telegram execution.
- No public execution feed.
