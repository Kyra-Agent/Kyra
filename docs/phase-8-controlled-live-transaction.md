# Phase 8 Controlled Live Transaction

Date: 2026-07-03

Status: Batch 20 live balance and gas readiness. Runtime execution remains default-off. Explicit owner-window flag enablement is required before activation.

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
## Batch 9 - Owner-Only Result Closeout Bridge

Batch 9 connects the isolated submitter result back into the private dashboard models. A successful submit produces only an owner-only sanitized hash reference and moves the dashboard into submitted-pending-confirmation monitoring.

Required Batch 9 controls:

- submitter emits only a sanitized transaction hash event after provider submission
- event state is owner-only and never public
- dashboard stores the event in browser state only
- result closeout is cleared when the owner resets, disconnects, changes agent, or invalidates the active arming state
- `phase8ControlledSubmission` consumes the submitted event as owner-only closeout evidence
- `resultMonitoringCloseout` observes provider-submitted status only after the sanitized hash exists
- rejected or failed prompts do not create fake transaction hashes
- Telegram, public profiles, automation, swaps, token approvals, calldata, and non-zero value remain blocked

Implementation evidence:

- `onResultCloseout` bridge in `src/components/Phase8ControlledSubmitter.tsx`
- `phase8SubmitterResult` owner-only dashboard state
- `phase8ControlledSubmission` submitted-state result event binding
- `resultMonitoringCloseout` provider-submitted hash observation
- `scripts/check-phase-8-owner-live-window-activation.mjs`

Batch 9 does not make confirmations automatic. It records only the immediate provider-submitted hash reference after the owner approves a Base Account prompt. Confirmation persistence remains a later production hardening step.

User wallet authority and user Telegram bot-token privacy remain priority one.

## Batch 10 - Runtime Enablement Preflight

Batch 10 adds the final runtime preflight before the owner-dashboard submitter can be considered open. It does not create a Telegram, public profile, automation, swap, token approval, calldata, or non-zero value path.

Required Batch 10 controls:

- explicit runtime flag: `VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=owner_approved_window`
- signed-in owner session
- selected deployed agent
- connected owner Base Account
- controlled submission must be `ready_to_submit`
- owner live-window activation must be ready
- no existing owner-only result closeout can already be recorded
- private owner dashboard source only
- Telegram and public profiles remain blocked

Implementation evidence:

- `src/types/phase8RuntimeEnablementPreflight.ts`
- `scripts/test-phase-8-runtime-enable-preflight.mjs`
- `scripts/check-phase-8-runtime-enable-preflight.mjs`
- dashboard runtime enablement preflight panel
- `Phase8ControlledSubmitter` requires `preflight.runtimeSubmitterEnabled`
- `npm run check:phase-8-runtime-preflight`

Batch 10 is the controlled opening checklist. When it passes under the explicit runtime flag, the submitter can request one owner-approved Base Account zero-value/no-calldata transaction for the selected agent. User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 11 - Base ETH Gas Readiness Guard

Batch 11 adds a native ETH gas readiness guard after the first live Base Account prompt showed that a zero-value transaction still needs Base ETH for gas. It does not create token approval, swap, calldata, non-zero value, Telegram, public profile, or automation execution authority.

Required Batch 11 controls:

- read the connected owner Base Account native ETH balance on Base only
- disable the controlled submit button when the Base ETH balance is unavailable or zero
- show owner-facing copy that the transaction is zero-value but gas still requires ETH
- keep the runtime preflight, owner live-window, selected agent, and controlled submission gates unchanged
- keep Telegram and public profiles blocked from balance-gated submit authority

Implementation evidence:

- `Phase8ControlledSubmitter` uses `useBalance` for native Base ETH gas readiness
- `baseAccountAddress={baseAccountConnectionStatus.address}` is passed from the private dashboard only
- submitter requires `gasReady` before `sendTransactionAsync`
- `getGasReadiness` blocks `wallet_required`, `address_required`, `checking`, `unavailable`, and `empty` states
- `npm run check:phase-8-runtime-preflight`

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 12 - Submitter Closeout Hardening

Batch 12 hardens the owner-only closeout after a provider returns a transaction hash. It does not add token approval, swap, calldata, non-zero value, Telegram, public profile, or automation execution authority.

Required Batch 12 controls:

- successful provider submission is converted through `createPhase8SubmittedCloseoutEvent`
- owner, workspace, agent, prepared action, and submission nonce scope are required before closeout is recorded
- transaction hash must be a valid `0x` transaction hash before the event is accepted
- closeout event remains owner-only and sanitized
- Dashboard passes the active owner-window submission nonce into the isolated submitter
- failure copy remains safe and does not expose provider payloads, calldata, secrets, or wallet internals

Implementation evidence:

- `src/types/phase8SubmitterCloseout.ts`
- `scripts/test-phase-8-submitter-closeout.mjs`
- `src/components/Phase8ControlledSubmitter.tsx`
- `src/pages/Dashboard.tsx`
- `npm run check:phase-8-submitter`

User wallet authority and user Telegram bot-token privacy remain priority one.

## Batch 13 - Owner-Only Result Persistence

Batch 13 persists the owner-only result record after the isolated submitter emits a sanitized closeout event. The first persistence layer is browser-session scoped so it can prove product behavior without adding public exposure, Telegram authority, token approval, swap, calldata, or non-zero value execution.

Required Batch 13 controls:

- result persistence requires owner, workspace, agent, prepared action, and submission nonce scope
- only submitted, confirmed, or failed sanitized events can be persisted
- transaction hash must be valid before it can be stored or displayed
- persisted execution result remains `owner-only`
- public agent profiles cannot access Phase 8 persisted owner results
- persisted hash display is masked in the dashboard result list
- session-scoped storage is used until a reviewed Supabase write path is approved

Implementation evidence:

- `src/types/phase8ResultPersistence.ts`
- `src/services/phase8ResultPersistenceStore.ts`
- `scripts/test-phase-8-result-persistence.mjs`
- `scripts/check-phase-8-result-persistence.mjs`
- `src/pages/Dashboard.tsx`
- `npm run check:phase-8-result-persistence`

User wallet authority and user Telegram bot-token privacy remain priority one.


## Batch 14 - Funding and Gas UX

Batch 14 hardens the owner-facing funding path after the Base Account prompt proved that even a zero-value transaction needs native ETH on Base for gas. This batch does not add token approval, swap, calldata, non-zero value execution, Telegram authority, public profile authority, seed phrase handling, or private-key handling.

Required Batch 14 controls:

- funding readiness is modeled in `src/types/phase8FundingReadiness.ts`, not only in UI copy
- submitter can open only when the connected owner Base Account has native ETH on Base
- empty, unavailable, checking, missing wallet, and missing address states stay blocked
- owner-facing funding copy tells the user to fund the connected Base Account with Base ETH
- funding guidance remains owner-dashboard only
- Kyra never stores private keys, never requests seed phrases, and never asks Telegram or public profiles to fund or submit
- public agent profiles and Telegram webhook code cannot access Phase 8 funding UX authority

Implementation evidence:

- `src/types/phase8FundingReadiness.ts`
- `src/components/Phase8ControlledSubmitter.tsx`
- `scripts/test-phase-8-funding-readiness.mjs`
- `scripts/check-phase-8-funding-readiness.mjs`
- `src/styles.css`
- `npm run check:phase-8-funding-readiness`

User wallet authority and user Telegram bot-token privacy remain priority one.

## Batch 15 - Controlled Smoke Closeout

Batch 15 adds an owner-only controlled smoke closeout model after the first live submit path. The closeout distinguishes not started, submitted pending confirmation, confirmed, failed, and aborted states without exposing wallet internals, provider payloads, Telegram authority, public profile authority, token approvals, swaps, calldata, or non-zero value execution.

Required Batch 15 controls:

- controlled smoke closeout requires owner, workspace, selected agent, and prepared action scope
- submitted, confirmed, and failed closeouts require a valid transaction hash
- confirmed closeout requires provider confirmation data
- failed closeout requires a sanitized failure reason
- aborted closeout can close safely without a transaction hash
- closeout remains owner-only and hidden from public profiles and Telegram
- public hardening can continue only after confirmed, failed, or aborted closeout

Implementation evidence:

- `src/types/phase8SmokeCloseout.ts`
- `scripts/test-phase-8-smoke-closeout.mjs`
- `scripts/check-phase-8-smoke-closeout.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-smoke-closeout`

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 16 - User-Safe Transaction Policy

Batch 16 adds an owner-only user-safe transaction policy above the controlled smoke path. The policy keeps the current live transaction surface conservative while documenting the exact gates required before user transactions can expand beyond the zero-value, no-calldata owner smoke.

Required Batch 16 controls:

- policy review requires signed-in owner, private dashboard, selected agent, connected Base Account, and Base chain
- a reviewed prepared action is required before owner review can continue
- allowed action kind remains `base_reviewed_transaction`
- max value remains `0` wei until the next explicit expansion gate
- calldata, token approvals, swaps, Telegram requests, and public profile triggers remain blocked
- owner cooldown state is modeled before broader transaction rollout
- public agent profiles and Telegram webhook code cannot access Phase 8 user-safe policy authority

Implementation evidence:

- `src/types/phase8UserSafeTransactionPolicy.ts`
- `scripts/test-phase-8-user-safe-transaction-policy.mjs`
- `scripts/check-phase-8-user-safe-transaction-policy.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-user-safe-policy`

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 17 - Low-Value Transaction Readiness

Batch 17 adds the readiness gate for the first low-value owner transaction without opening broader execution. The current submitter remains separate and conservative while Kyra verifies value cap, gas requirements, owner approval, Base-only execution, and private-dashboard-only authority before any low-value submit path can be promoted.

Required Batch 17 controls:

- low-value review requires signed-in owner, private dashboard, selected agent, connected Base Account, Base chain, prepared action, and recorded owner approval
- max low-value cap is `0.0001 ETH` (`100000000000000` wei)
- required balance is modeled as requested value plus estimated Base gas fee
- missing gas estimate or insufficient Base ETH blocks review
- calldata, token approvals, swaps, Telegram requests, and public profile triggers remain blocked
- Batch 17 is readiness only; it does not replace the current zero-value controlled submitter
- public agent profiles and Telegram webhook code cannot access Phase 8 low-value readiness authority

Implementation evidence:

- `src/types/phase8LowValueTransactionReadiness.ts`
- `scripts/test-phase-8-low-value-transaction-readiness.mjs`
- `scripts/check-phase-8-low-value-transaction-readiness.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-low-value-readiness`

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 18 - Low-Value Submit Request Skeleton

Batch 18 adds the owner-only low-value submit request skeleton. This prepares the request object for the first value-bearing owner transaction without exposing a public, Telegram, swap, token approval, or arbitrary calldata execution path.

Required Batch 18 controls:

- submit request requires owner, workspace, selected agent, private dashboard, connected Base Account, Base chain, reviewed prepared action, and explicit owner approval
- recipient must be a valid EVM address
- value must be positive and less than or equal to `0.0001 ETH` (`100000000000000` wei)
- request uses Base mainnet, owner-only result scope, and `0x` calldata only
- token approvals, swaps, Telegram requests, and public profile triggers remain blocked
- Batch 18 is a request skeleton only; the separate low-value submitter UI remains gated for the next batch
- public agent profiles and Telegram webhook code cannot access Phase 8 low-value submit request authority

Implementation evidence:

- `src/types/phase8LowValueSubmitRequest.ts`
- `scripts/test-phase-8-low-value-submit-request.mjs`
- `scripts/check-phase-8-low-value-submit-request.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-low-value-submit-request`

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 19 - Isolated Low-Value Submitter Gate

Batch 19 adds the isolated owner-dashboard low-value submitter gate. The gate uses the Batch 18 request skeleton, stays behind a separate default-off runtime flag, and records successful provider handoff through the owner-only closeout path.

Required Batch 19 controls:

- low-value submitter is a separate component from the zero-value controlled submitter
- runtime flag is `VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=owner_low_value_window`
- default runtime state is disabled
- submit button requires connected owner wallet, armed owner window, no prior result, low-value readiness, and valid low-value request skeleton
- successful provider handoff records owner-only closeout evidence through the existing sanitized result path
- Telegram, public profiles, token approvals, swaps, arbitrary calldata, seed phrases, and private keys remain blocked
- public agent profiles and Telegram webhook code cannot access Phase 8 low-value submitter authority

Implementation evidence:

- `src/components/Phase8LowValueSubmitter.tsx`
- `src/config/appConfig.ts`
- `scripts/test-phase-8-low-value-submitter-gate.mjs`
- `scripts/check-phase-8-low-value-submitter-gate.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-low-value-submitter`

User wallet authority and user Telegram bot-token privacy remain priority one.
## Batch 20 - Live Balance And Gas Readiness

Batch 20 wires live Base ETH balance into the low-value readiness gate before any value-bearing submit can become available. The owner dashboard now reads the connected Base Account balance through the browser wallet provider and feeds that value into the Phase 8 low-value readiness model.

Required Batch 20 controls:

- live Base ETH balance is read only from the connected owner Base Account
- balance is browser-session scoped and is not stored in Supabase or public profiles
- readiness remains blocked when balance is missing, loading, unavailable, or below value plus gas
- low-value submitter remains behind `VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=owner_low_value_window`
- Telegram, public profiles, token approvals, swaps, arbitrary calldata, seed phrases, and private keys remain blocked

Implementation evidence:

- `src/pages/Dashboard.tsx` uses `useBalance` for the owner Base Account and passes the result into `evaluatePhase8LowValueTransactionReadiness`
- `src/pages/Dashboard.tsx` displays live Base balance and gas/value source in the owner-only dashboard
- `scripts/check-phase-8-low-value-balance-gas-readiness.mjs`
- `npm run check:phase-8-low-value-balance-gas`

User wallet authority and user Telegram bot-token privacy remain priority one.
