# Phase 7J Controlled Live Transaction Gate

Date: 2026-06-25

Status: complete as a local controlled-live gate definition. Phase 7J does not
enable wallet prompts, signing, transaction submission, provider transaction
calls, Telegram execution, or transaction hash persistence.

Historical note: this file previously tracked Base MCP status provider wiring.
That read-only adapter remains default-off and optional. The canonical Phase 7J
scope is now the controlled live transaction gate described here.

## Decision

Define the final gate that must be green before Kyra can request a later
controlled live smoke window:

- one owner session
- one workspace scope
- one deployed agent scope
- one owner Base Account connection
- Base mainnet chain id `8453`
- exactly one prepared action candidate
- deterministic allowlist pass
- low-risk action classification
- Kyra owner approval and Base Account approval boundaries ready
- owner-only result monitoring and closeout ready
- rollback plan ready
- emergency disablement ready
- post-transaction audit ready
- Telegram has no authority
- public profile visibility is forbidden
- wallet prompt, signing, and submission runtime switches remain locked in
  Phase 7J

## Runtime Boundary

Phase 7J is a gate model only:

- no wallet prompt is opened
- no signature is requested
- no transaction is submitted
- no transaction hash is persisted
- no provider transaction endpoint is called
- no prepared-action production row is created by this phase
- no Telegram command can approve, sign, submit, swap, transfer, or execute
- no public profile may show controlled-live transaction state

If any wallet prompt, signing, or submission runtime switch is enabled during
Phase 7J, the gate fails closed as
`runtime_execution_must_remain_locked`.

## Product Boundary

The dashboard may show owner-only evidence that the controlled-live gate is:

- blocked by missing prerequisites
- ready for explicit live-window approval
- approved but still runtime locked

Even when the gate is approved, Phase 7J returns:

- `walletPromptAllowed: false`
- `walletSigningAllowed: false`
- `transactionSubmissionAllowed: false`

The later controlled smoke phase must make the separate enablement decision.

## Security Boundary

Controlled-live data must not include:

- private keys
- seed phrases
- Telegram bot tokens
- OpenRouter or Supabase secrets
- raw provider payloads
- calldata beyond reviewed bounded handoff data
- unreviewed transaction hashes
- wallet execution authority from Telegram or public routes

The user's wallet remains the final authority. Kyra can prepare and gate only;
it cannot silently execute.

## Implementation

Current implementation:

- `src/types/controlledLiveTransactionGate.ts`
- `scripts/test-controlled-live-transaction-gate.mjs`
- `scripts/check-phase-7j-base-mcp-provider-wiring.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-7j`

The dashboard evidence panel is informational and owner-only. It does not add a
transaction button, wallet prompt, signing call, provider submission, or storage
write.

## Failure Boundary

User-facing failures stay bounded:

- controlled live transaction requires an owner session
- controlled live transaction requires one workspace scope
- controlled live transaction requires one deployed agent scope
- connect one owner Base Account before review
- controlled live transaction must target Base
- exactly one prepared action is required
- the prepared action must pass deterministic allowlist
- the first live transaction candidate must be low risk
- rollback, emergency disablement, and post-transaction audit must be ready
- Telegram cannot authorize or execute controlled live transactions

No failure may expose endpoint URLs, API keys, provider stack traces, raw
provider bodies, private wallet data, Telegram token refs, or unredacted
transaction payloads.

## Local Verification

Required before push or deploy:

```powershell
npm run check:phase-7j
npm run check:phase-7
npm run build
git diff --check
```

## Live Smoke Checklist

Before moving beyond Phase 7J:

- confirm target Supabase project and Netlify site
- confirm target owner account is signed in
- confirm one deployed agent is selected
- confirm one Base Account is connected on Base
- confirm the prepared action is allowlisted and low risk
- confirm Kyra owner approval and Base Account approval boundaries are separate
- confirm rollback and emergency disablement are ready
- confirm post-transaction audit fields are ready
- confirm Telegram still rejects wallet/swap/onchain commands
- confirm public profile does not show wallet or controlled-live internals

Do not enable wallet prompt, signing, or transaction submission during this
phase.

## Rollback Plan

Primary rollback:

- keep wallet execution disabled
- keep wallet signing disabled
- keep transaction submission disabled
- keep Telegram execution disabled
- keep official hosted Base MCP authority disabled unless separately approved
- remove any accidental live-window approval flag
- re-run `npm run check:phase-7j`
- re-run `npm run check:phase-7`

## Done Criteria

- Controlled live transaction gate model exists.
- Gate requires one owner, one workspace, one deployed agent, one Base Account,
  one allowlisted low-risk action, rollback, emergency disablement, and
  post-transaction audit.
- Gate fails closed if Telegram or public routes gain authority.
- Gate fails closed if runtime wallet prompt, signing, or transaction
  submission is enabled in Phase 7J.
- Dashboard shows owner-only evidence.
- Automated Phase 7J checker is included in `npm run check:phase-7`.
