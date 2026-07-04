# Phase 8 Controlled Live Transaction

Date: 2026-07-03

Status: Batch 8 owner self-check candidate. Runtime execution remains default-off. Owner-approved window is required before activation.

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

## Batch 3 - Wallet Prompt Opening

Batch 3 adds controlled wallet prompt opening after Batch 2 live-window
preparation is ready. It still does not submit transactions.

Required Batch 3 controls:

- controlled wallet prompt opening from the private owner dashboard only
- one-time prompt nonce bound to the owner, workspace, agent, and frozen action
- owner-click Base Account prompt opening
- owner-only prompt audit for opened, approved, rejected, and failed prompt
  states
- sanitized audit events only
- Telegram, automation, and public profile sources remain blocked
- `transactionSubmissionAllowed: false` for every Batch 3 result

Implementation evidence:

- `src/types/phase8WalletPromptOpening.ts`
- `scripts/test-phase-8-wallet-prompt-opening.mjs`
- `scripts/check-phase-8-wallet-prompt-opening.mjs`
- private dashboard Phase 8 wallet prompt opening panel
- `npm run check:phase-8-wallet-prompt`

The model can return `ready_to_open_prompt`, `prompt_opened`,
`prompt_approved`, `prompt_rejected`, or `prompt_failed`. Approval records that
the wallet prompt accepted the request, but Batch 3 still keeps transaction
submission disabled. Submission belongs to the next controlled execution batch.

Batch 3 negative cases cover blocked live-window preparation, Telegram prompt
source, public prompt source, missing nonce, reused nonce, wrong frozen action
binding, missing audit, unsafe audit, and public visibility.

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 4 - Controlled Transaction Submission

Batch 4 adds the owner-only controlled submission gate after Batch 3 records a
Base Account approval. This is still not a public execution surface and does not
enable swaps, token approvals, token spend, arbitrary transfers, contract
calldata, Telegram execution, or public profile execution.

Required Batch 4 controls:

- controlled transaction submission from the private owner dashboard only
- one-time submission nonce bound to the owner, workspace, agent, and frozen
  prepared action
- Base Account approval recorded before submission
- Base mainnet only
- zero-value transaction only
- no calldata
- sanitized transaction hash reference only
- owner-only result closeout for submitted, confirmed, and failed states
- rollback readiness before submission
- emergency disablement readiness before submission
- post-transaction audit readiness before submission
- Telegram, automation, and public profile sources remain blocked

Implementation evidence:

- `src/types/phase8ControlledSubmission.ts`
- `scripts/test-phase-8-controlled-submission.mjs`
- `scripts/check-phase-8-controlled-submission.mjs`
- private dashboard Phase 8 controlled submission panel
- `npm run check:phase-8-submission`

The model can return `ready_to_submit` only after the Batch 3 wallet prompt is
owner-approved, the one-time submission nonce is unused, Base Account approval is
recorded, the frozen action remains zero-value/no-calldata, and rollback,
emergency disablement, and post-transaction audit are ready.

After submission, the model moves to `submitted_pending_confirmation`,
`closed_confirmed`, or `closed_failed` only with owner-only sanitized result
evidence. Result events must contain only a transaction hash reference, not raw
wallet payloads, private data, secrets, or Telegram tokens.

Batch 4 negative cases cover missing wallet prompt approval, Telegram submission,
public profile submission, missing or reused nonce, wrong frozen action binding,
missing Base Account approval, non-Base chain, non-zero value, calldata, missing
transaction hash, unsafe result evidence, missing rollback, missing emergency
disablement, and missing post-transaction audit.

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 5 - Owner Dashboard Submitter Wiring

Batch 5 installs the isolated owner-dashboard submitter boundary. It is the only
frontend component outside the wallet runtime provider that may import the wallet
transaction hook. The component remains disabled unless all Batch 1-4 model gates
pass and the explicit Phase 8 controlled submission runtime window is enabled.

Required Batch 5 controls:

- isolated `Phase8ControlledSubmitter` component
- `useSendTransaction` allowed only inside that submitter boundary
- zero-value/no-calldata/Base-only request builder
- explicit runtime flag: `VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=owner_approved_window`
- default production state remains `disabled`
- private owner dashboard source only
- no Telegram, public profile, automation, swap, token approval, non-zero value,
  or calldata path
- safe failure copy for rejected or failed wallet prompts
- sanitized hash display only after wallet submission returns a hash

Implementation evidence:

- `src/components/Phase8ControlledSubmitter.tsx`
- `src/types/phase8OwnerSubmitRequest.ts`
- `scripts/test-phase-8-owner-submit-request.mjs`
- `scripts/check-phase-8-controlled-submitter.mjs`
- `npm run check:phase-8-submitter`

Batch 5 wires the final browser-side handoff point, but does not enable it by
default. The next operator step is an owner-approved live window using the
specific runtime flag, one selected agent, one connected owner Base Account, and
one frozen zero-value/no-calldata prepared action.

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 6 - Owner Live-Window Activation Lock

Batch 6 adds the final operator arming layer before the isolated submitter can
call the Base Account transaction hook. The submitter is no longer gated only by
the controlled-submission model and runtime flag; it also requires a separate
owner live-window activation result.

Required Batch 6 controls:

- runtime window must be explicitly enabled by `VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=owner_approved_window`
- controlled submission must already be `ready_to_submit`
- owner operator acknowledgement must be recorded for the exact agent, action,
  Base Account, and rollback plan
- rollback readiness must be true
- emergency disable readiness must be true
- post-transaction audit readiness must be true
- activation source must remain the private owner dashboard
- Telegram, public profile, automation, token approval, swap, calldata, and
  non-zero value paths remain blocked

Implementation evidence:

- `src/types/phase8OwnerLiveWindowActivation.ts`
- `scripts/test-phase-8-owner-live-window-activation.mjs`
- `scripts/check-phase-8-owner-live-window-activation.mjs`
- dashboard live-window activation panel
- submitter requires `activation.transactionSubmissionAllowed`

Batch 6 is intentionally default-locked in production. Operator acknowledgement
is false until the owner opens a narrow live window for one selected agent and one
frozen zero-value/no-calldata action.

User wallet authority and user Telegram bot-token privacy remain priority one.

## Batch 7 - Owner Arming UX

Batch 7 connects the owner live-window activation model to explicit private-dashboard controls. It still does not make Telegram, public profiles, automation, swaps, token approvals, calldata, or non-zero value eligible for execution.

Required Batch 7 controls:

- owner can arm the selected agent only from the private dashboard
- arming is browser-session only and stores no wallet key
- arming binds owner, workspace, agent, frozen action, prompt nonce, and submission nonce
- changing owner, workspace, agent, or frozen action invalidates the active arming state
- reset button clears the browser-session arming state
- wallet prompt and controlled submission models receive nonces only while the owner arming is current
- activation still requires the explicit runtime flag `VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=owner_approved_window`
- isolated submitter remains locked unless runtime, controlled submission, activation, rollback, emergency disablement, and audit gates all pass

Implementation evidence:

- private dashboard owner arming controls
- `phase8OwnerArming` browser-session state
- `phase8FrozenAction` binding
- one-time prompt and submission nonces derived only after owner arming
- `scripts/check-phase-8-owner-live-window-activation.mjs`
- `npm run check:phase-8-owner-live-window`

Batch 7 opens the owner-controlled readiness path without weakening the runtime gate. Production transaction submission remains default-off until the owner intentionally enables the controlled live window and completes the Base Account approval flow.

User wallet authority and user Telegram bot-token privacy remain priority one.

## Batch 8 - Owner Self-Check Candidate

Batch 8 replaces the placeholder Phase 8 transaction candidate with a deterministic owner self-check candidate. The candidate uses the connected browser-session Base Account address as the recipient, remains zero-value, and carries no calldata.

Required Batch 8 controls:

- candidate can be created only when owner, workspace, selected agent, Base Account connection, Base chain, and browser-session address are present
- recipient is the connected owner Base Account address, masked in UI
- value remains `0`
- calldata remains `0x`
- candidate summary is bounded and owner-dashboard sourced
- changing/disconnecting the Base Account invalidates the candidate and active arming state
- Telegram, public profiles, automation, swaps, token approvals, calldata, and non-zero value remain blocked

Implementation evidence:

- `src/types/phase8OwnerActionCandidate.ts`
- `scripts/test-phase-8-owner-action-candidate.mjs`
- Base Account dashboard status includes browser-session address
- private dashboard owner candidate panel
- `scripts/check-phase-8-owner-live-window-activation.mjs`

Batch 8 makes the first controlled transaction path safer and easier to review because the owner can see the exact self-check candidate before arming the live window. Runtime submission remains default-off and still requires owner arming, Base Account approval, rollback readiness, emergency disablement readiness, and owner-only audit.

User wallet authority and user Telegram bot-token privacy remain priority one.
