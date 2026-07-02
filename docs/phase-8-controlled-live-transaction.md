# Phase 8 Controlled Live Transaction

Date: 2026-07-03

Status: Batch 2 live-window preparation guard. Runtime execution remains default-off.

## Purpose

Phase 8 is the first product phase that may open a real owner wallet prompt and
submit a controlled Base transaction. It must remain narrow enough to review
end to end.

The initial candidate is intentionally limited to:

- one authenticated owner
- one workspace
- one selected deployed agent
- one owner-click Base Account connection
- one frozen prepared action
- Base mainnet only
- zero-value transaction
- no calldata
- explicit Kyra approval
- explicit owner click for execution
- explicit Base Account approval
- owner-only result monitoring

No swap, token approval, token spend, arbitrary transfer, calldata, contract
call, Telegram execution, or public execution surface is part of Batch 1.

## Runtime Boundary

Phase 8 has two gates:

1. The Phase 7 launch packet must be owner-approved while runtime remains
   disabled.
2. The Phase 8 runtime enablement must be explicitly enabled for the controlled
   live window.

If either gate is missing, wallet prompt and transaction submission remain
blocked.

## Implementation

- `src/types/phase8ControlledExecution.ts`
- `scripts/test-phase-8-controlled-execution.mjs`
- `scripts/check-phase-8-controlled-execution.mjs`
- private dashboard Phase 8 evidence panel
- `npm run check:phase-8`

The Phase 8 model can return `ready_for_owner_wallet_prompt` only when all
owner, agent, Base Account, launch packet, runtime, frozen action, rollback,
emergency disablement, audit, Telegram, and public visibility gates pass.

The model can return `transactionSubmissionAllowed: true` only after the Base
Account prompt state is owner-approved. Result closeout remains owner-only.

## Required Negative Cases

The checker must prove:

- default runtime enablement blocks wallet prompt
- missing owner click blocks wallet prompt
- missing launch packet blocks wallet prompt
- non-zero value blocks wallet prompt
- calldata blocks wallet prompt
- Telegram authority blocks wallet prompt
- public profile visibility blocks wallet prompt
- source files do not call `sendTransaction`, `writeContract`,
  `eth_sendTransaction`, `signMessage`, or `signTypedData` outside the isolated
  wallet provider boundary

## Done Criteria

- Phase 8 controlled execution model exists.
- Unit test covers ready, prompt opened, submitted, confirmed, default-locked,
  unsafe action, unsafe surfaces, and missing launch packet states.
- Dashboard shows owner-only Phase 8 status.
- Default production state remains locked until explicit runtime enablement.
- Telegram cannot authorize execution.
- Public profiles cannot show execution state.
- User wallet authority and user Telegram bot-token privacy remain priority
  one.

## Batch 2 - Live Window Preparation

Batch 2 adds the owner-approved live window layer before any wallet prompt can
be considered ready. It still does not submit transactions.

Required Batch 2 controls:

- owner-approved live window scoped to the active owner, workspace, and agent
- private owner dashboard execute intent only
- explicit owner click inside that private dashboard intent
- Frozen action binding across owner, workspace, agent, Base chain, zero value,
  and no calldata
- Base Account prompt readiness before any prompt can open
- Telegram, automation, and public profile sources remain blocked
- transaction submission remains disabled

Implementation evidence:

- `src/types/phase8LiveWindowPreparation.ts`
- `scripts/test-phase-8-live-window-preparation.mjs`
- `scripts/check-phase-8-live-window-preparation.mjs`
- private dashboard Phase 8 live window panel
- `npm run check:phase-8-live-window`

The model can return `ready_for_wallet_prompt`, `wallet_prompt_opened`, or
`wallet_prompt_approved`, but every Batch 2 result keeps
`transactionSubmissionAllowed: false`. Real submission is reserved for the next
controlled execution batch after explicit owner approval.

Batch 2 negative cases cover expired live windows, revoked live windows, wrong
owner, wrong workspace, wrong agent, wrong chain, Telegram intent, public
profile intent, non-zero value, calldata, and Base Account prompt readiness
failure.

User wallet authority and user Telegram bot-token privacy remain priority one.
