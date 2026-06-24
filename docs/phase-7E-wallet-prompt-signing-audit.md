# Phase 7E Wallet Prompt And Signing Audit

Date: 2026-06-24

Status: audit packet started. Wallet prompts, signing, transaction submission,
and transaction hash persistence remain disabled in production. Phase 7E
closeout guard is implemented for prompt eligibility, but the runtime signing
gate remains disabled.

## Objective

Phase 7E audits the wallet prompt and signing boundary before Kyra can open any
real wallet prompt.

This phase does not enable wallet signing or transaction submission. The goal
is to prove that future wallet prompts can only be reached through explicit
owner action from the dashboard, and that Telegram, public pages, background
effects, and read-only Base MCP actions cannot trigger signing.

## Current Finding

Current state is acceptable for Phase 7E closeout:

- `appConfig.integrations.walletExecution` is hard-disabled.
- Phase 7D owner-click Base Account connection is deployed on production and
  verified by owner smoke.
- Wallet provider packages are installed behind `WalletProviderBoundary`.
- `WalletProviderBoundary` mounts the wallet runtime only for owner-click
  connection while signing and transaction execution stay disabled.
- `WalletRuntimeProviders` uses Wagmi, Viem, Base Account, React Query,
  `storage: null`, and `reconnectOnMount={false}`.
- `WalletApprovalModal` is a demo review modal only.
- The modal does not import wallet provider hooks.
- The modal does not call `connect`, `signMessage`, `sendTransaction`, or
  `writeContract`.
- The UI does not show `submitted` or `confirmed` as wallet states while
  wallet execution is disabled.
- `request_wallet_prompt` requires `ownerAction`.
- `base_mcp_status_check` is explicitly rejected as a signable handoff.
- The only signable kind is currently `base_reviewed_transaction`.
- The connected wallet must pay gas.
- User rejection must not include a transaction hash.
- Failed actions before submission must not include a transaction hash.
- Dashboard reads still exclude `prepared_tx` and `tx_hash`.
- Telegram runtime has no wallet provider, prepared-action storage, signing, or
  transaction submission path.
- `src/types/walletPromptEligibility.ts` centralizes the Phase 7E prompt
  eligibility contract.
- Dashboard shows a Phase 7E signing boundary status card, but it does not
  expose a signing button or call a wallet signing API.
- The guard currently blocks prompts because `walletExecution` is still
  disabled, prepared-action review is not live, risk review is not bound to a
  persisted action, owner approval is not recorded, and no valid handoff can be
  signed.

## Prompt Eligibility Rules

A real wallet prompt may only open when all of these are true:

- Signed-in owner is on the owner dashboard.
- The action belongs to the owner's workspace.
- The prepared action storage path has been approved and verified.
- The action kind is signable and is not `base_mcp_status_check`.
- The unsigned handoff validates.
- Risk review is ready or explicitly review-required.
- Owner clicks a wallet prompt button.
- Network is Base before signing.
- The connected wallet is the gas payer.
- The handoff has not expired.
- `walletExecution` has been changed through a separately reviewed runtime
  gate.

## Blocked Prompt Sources

Wallet prompts must never open from:

- page load
- route change
- public agent page
- Telegram message
- Telegram webhook
- LLM output
- Base MCP provider response
- background retry
- activity log replay
- unauthenticated viewer
- wrong workspace owner

## Signable Action Boundary

`base_mcp_status_check` stays read-only and cannot be signed.

`base_reviewed_transaction` is the only modeled signable action kind, but it is
not executable until Phase 7F/7G/7H complete the allowlist, persistence,
approval, and prompt handoff.

The first executable signable action requires a separate decision packet and
must include:

- reviewed action kind
- owner-scoped prepared action record
- validated unsigned transaction handoff
- explicit risk review
- bounded expiry
- visible route and value summary
- connected wallet gas payer
- sanitized rejection and failure handling
- post-submission transaction hash handling only

The following is intentionally not enough to open a prompt:

- connected Base Account only
- LLM output only
- Telegram command only
- Base MCP status response only
- dashboard page load only
- unpersisted demo review only

## Failure Boundary

Allowed wallet failure messages are sanitized:

- `User rejected the wallet request.`
- `Wallet must be connected to Base.`
- `Wallet provider is unavailable.`
- `This action is not supported for wallet signing.`
- `Wallet approval window expired.`
- `Wallet signing failed safely.`

Do not expose:

- provider stack traces
- raw RPC errors
- private keys
- seed phrases
- raw provider payloads
- Telegram tokens
- API keys
- calldata as primary UI
- transaction hashes before submission

## Phase 7E Current Gaps

These remain blockers before live wallet prompts:

- Prepared-action SQL is not applied.
- No first signable action decision packet exists.
- No live owner-summary dashboard read is approved.
- Wallet signing runtime remains disabled.
- No production wallet signing smoke checklist exists.
- No network mismatch live smoke exists.
- No user rejection live smoke exists.
- No transaction submission persistence path is approved.

These blockers are expected and are now represented in code by the Phase 7E
prompt eligibility guard. They do not invalidate Phase 7E; they define the
next gates.

## Phase 7E Done Criteria

- Wallet prompt/signing audit packet exists.
- Automated Phase 7E check exists.
- Pure prompt eligibility guard exists.
- Prompt eligibility rejects disabled runtime, missing owner session, missing
  selected agent, missing Base Account connection, wrong chain, missing
  prepared-action review, missing risk review, missing owner approval, invalid
  handoff, expired handoff, and forbidden prompt sources.
- Dashboard exposes signing boundary evidence without a signing button.
- Wallet execution remains hard-disabled.
- Wallet provider imports stay isolated behind the runtime provider boundary.
- Demo modal remains non-signing.
- State machine requires explicit owner action before wallet prompt request.
- `base_mcp_status_check` remains non-signable.
- Telegram and public paths cannot open wallet prompts.
- Phase 7 checks pass with 7E included.

## Phase 7E Closeout Result

Phase 7E is complete as a signing security boundary, not as live signing.

What is now true:

- Base Account connection can exist from the private dashboard.
- Signing eligibility has a deterministic fail-closed contract.
- Every non-owner-dashboard prompt source is rejected.
- Runtime signing remains blocked by `walletExecution: "disabled"`.
- No `useSignMessage`, `signMessage`, `sendTransaction`, or `writeContract`
  path exists in the dashboard, modal, public page, or Telegram runtime.
- No transaction hash persistence is enabled.
- No token approval, swap, transfer, or contract call can be initiated.

## Next Step

Proceed to Phase 7F after this audit stays green:

- prepared-action adapter allowlist
- exact signable action schema
- deterministic policy and NYX-05 binding
- no LLM/provider arbitrary calldata
- no Telegram-created approval or prepared-action drafts
