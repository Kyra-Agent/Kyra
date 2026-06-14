# Phase 6C Wallet Signing Handoff Audit

Audit date: 2026-06-15

Status: planning and audit only. No wallet provider, wallet prompt, signature,
transaction submission, or transaction hash persistence is enabled by this
document.

## Security Priority

User wallet security is the primary rule. User privacy and Telegram bot token
security remain equally non-negotiable.

Phase 6C must preserve:

- no seed phrase path
- no private key path
- no wallet custody
- no hidden signing
- no hidden transaction submission
- no Telegram-triggered signing or submission
- no transaction hash before user submission
- no raw wallet/provider error leaked to users

## Audited Areas

- `src/config/appConfig.ts`
- `src/components/WalletApprovalModal.tsx`
- `src/components/ActionConsole.tsx`
- `src/services/supabaseDashboardService.ts`
- `src/types/backend.ts`
- `src/types/database.ts`
- `docs/phase-6-wallet-base-checklist.md`
- `docs/phase-6B-review-packet.md`
- `docs/phase-6C-wallet-provider-decision.md`

## Current State

- `appConfig.integrations.walletExecution` is `disabled`.
- `WalletApprovalModal` is a demo modal and does not call a wallet provider.
- Dashboard wallet readiness is owner-only and derived from `wallet_policies`.
- Dashboard approval reads do not fetch `prepared_tx` or `tx_hash`.
- Prepared action preview is read-only and currently `base_mcp_status_check`.
- Base MCP provider and storage adapters are draft-only and not runtime-wired.
- Telegram remains read-only and must keep refusing wallet/onchain execution.

## Findings

### F1 - No Wallet Provider Path Exists Yet

There is no wagmi, viem, ethers, Coinbase Wallet SDK, or Base Account SDK path in
the app today.

Decision: Phase 6C must start with an explicit provider choice and dependency
review before implementation.

### F2 - Demo Approval Must Not Become Real Signing Accidentally

`WalletApprovalModal` currently says "Approve Demo" and only changes local demo
state.

Decision: keep demo approval separate from real wallet signing. A future real
wallet handoff must have separate state labels and fail-closed checks.

### F3 - Prepared Payload Is Not Yet A Signing Payload

Phase 6B intentionally keeps the first candidate read-only:
`base_mcp_status_check`.

Decision: 6C must not sign `base_mcp_status_check`. The first signable payload
requires a separate prepared-action kind, reviewed unsigned transaction shape,
and owner-scoped storage that has passed SQL verification.

### F4 - Transaction Hash Persistence Must Stay Post-Submission Only

`approval_requests.tx_hash` exists in the schema for future use, but dashboard
reads do not fetch it.

Decision: only persist `tx_hash` after user-initiated wallet submission returns a
hash. Never persist a hash placeholder or raw provider response.

### F5 - Telegram Must Not Bypass Dashboard/Wallet Approval

Telegram currently refuses execution. This must remain true while wallet
signing is introduced.

Decision: Telegram can at most point the owner to the dashboard after the
dashboard path is safe. It must not trigger wallet prompts.

### F6 - Provider Path Is Chosen But Not Installed

The selected first path is Wagmi + Viem with the Base Account connector first,
Coinbase Wallet connector second, and injected wallets later.

Decision: do not install or wire wallet dependencies until the UI-only signing
state model is added and reviewed. `walletExecution` remains disabled.

## Phase 6C Entry Conditions

Do not implement live signing until:

- Phase 6B review packet is pushed and verified.
- Prepared-action storage SQL is approved, applied, and verified.
- A first signable action kind is selected separately from
  `base_mcp_status_check`.
- Wallet provider dependency is reviewed.
- Chain/network mismatch behavior is defined.
- User rejection behavior is defined.
- Transaction state machine is defined.

## Candidate State Machine

Initial 6C signing state should be explicit:

- `preview_ready`
- `review_required`
- `wallet_prompt_requested`
- `wallet_prompt_opened`
- `user_rejected`
- `submitted`
- `failed`
- `confirmed`

No state should imply onchain completion before a transaction hash exists.

## No-Go Items

- no arbitrary swaps
- no arbitrary transfers
- no arbitrary contract calls
- no Telegram wallet prompts
- no backend signing
- no service-role transaction submission
- no storage of private keys, seed phrases, or wallet secrets
- no browser `VITE_` private keys or Base MCP API keys
- no raw calldata as the primary UI

## Required Verification Before Implementation

- `npm run check:phase-6b`
- `npm run check:base-mcp`
- `npm run check:prepared-actions`
- `npm run check:privacy`
- `npm run check:functions`
- `npm run build`
- targeted wallet handoff tests after provider code exists

## Current Recommendation

Do not implement live signing yet. The next safe step is a Phase 6C plan plus a
wallet-provider decision record, then a UI-only signing state model with no
provider dependency.
