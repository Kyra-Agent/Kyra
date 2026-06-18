# Phase 7E Wallet Prompt And Signing Audit

Date: 2026-06-19

Status: audit packet started. Wallet prompts, signing, transaction submission,
and transaction hash persistence remain disabled in production.

## Objective

Phase 7E audits the wallet prompt and signing boundary before Kyra can open any
real wallet prompt.

This phase does not enable wallet signing. The goal is to prove that future
wallet prompts can only be reached through explicit owner action from the
dashboard, and that Telegram, public pages, background effects, and read-only
Base MCP actions cannot trigger signing.

## Current Finding

Current state is acceptable for Phase 7E entry:

- `appConfig.integrations.walletExecution` is hard-disabled.
- Wallet provider packages are installed behind `WalletProviderBoundary`.
- `WalletProviderBoundary` returns children without `WagmiProvider` while
  wallet execution is disabled.
- `WalletRuntimeProviders` uses Wagmi, Viem, Base Account, Coinbase Wallet,
  React Query, and `reconnectOnMount={false}`.
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

The first signable action requires a separate decision packet and must include:

- reviewed action kind
- owner-scoped prepared action record
- validated unsigned transaction handoff
- explicit risk review
- bounded expiry
- visible route and value summary
- connected wallet gas payer
- sanitized rejection and failure handling
- post-submission transaction hash handling only

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
- Wallet provider runtime remains disabled.
- No production wallet prompt smoke checklist exists.
- No network mismatch live smoke exists.
- No user rejection live smoke exists.
- No transaction submission persistence path is approved.

## Phase 7E Done Criteria

- Wallet prompt/signing audit packet exists.
- Automated Phase 7E check exists.
- Wallet execution remains hard-disabled.
- Wallet provider imports stay isolated behind the runtime provider boundary.
- Demo modal remains non-signing.
- State machine requires explicit owner action before wallet prompt request.
- `base_mcp_status_check` remains non-signable.
- Telegram and public paths cannot open wallet prompts.
- Phase 7 checks pass with 7E included.

## Next Step

Proceed to Phase 7F only after this audit stays green:

- Telegram execution boundary audit
- `canExecuteFromTelegram` false verification
- `canCreateDraftNow` false verification
- unsafe intent refusal review
- no Telegram-created approval or prepared-action drafts
