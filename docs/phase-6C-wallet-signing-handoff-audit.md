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
- Wagmi, Viem, React Query, and Base Account dependencies are installed behind
  `src/providers/WalletProviderBoundary.tsx`; the actual runtime providers live
  in `src/providers/WalletRuntimeProviders.tsx`.
- `WalletApprovalModal` is a demo modal and does not call a wallet provider.
- Dashboard wallet readiness is owner-only and derived from `wallet_policies`.
- Dashboard approval reads do not fetch `prepared_tx` or `tx_hash`.
- Prepared action preview is read-only and currently `base_mcp_status_check`.
- Base MCP provider and storage adapters are draft-only and not runtime-wired.
- Telegram remains read-only and must keep refusing wallet/onchain execution.
- UI-only wallet signing state model exists in `src/types/walletSigning.ts`.
- `WalletApprovalModal` displays the signing state as read-only demo context and
  does not open a wallet provider.
- `WalletApprovalModal` displays unsigned handoff validation context without
  showing raw calldata as the primary UI.
- Unsigned transaction handoff model exists in
  `src/types/unsignedTransactionHandoff.ts` and keeps gas payment on the
  connected wallet.
- User rejection and Base network mismatch are represented with sanitized typed
  failure codes before provider installation.

## Findings

### F1 - Wallet Provider Path Is Installed But Gated

Wagmi, Viem, React Query, and Base Account dependencies are installed. The root
app is wrapped in `WalletProviderBoundary`, but that boundary returns children
without `WagmiProvider` while `walletExecution` is disabled. Runtime provider
code is lazy-loaded only when wallet execution is enabled.

Decision: keep `walletExecution` disabled until owner-click prompt behavior,
prepared-action storage, and first signable action are reviewed.

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

Decision: only persist `tx_hash` after user-initiated wallet submission returns
a hash. Never persist a hash placeholder or raw provider response.

### F5 - Telegram Must Not Bypass Dashboard/Wallet Approval

Telegram currently refuses execution. This must remain true while wallet signing
is introduced.

Decision: Telegram can at most point the owner to the dashboard after the
dashboard path is safe. It must not trigger wallet prompts.

### F6 - Provider Path Is Installed But Not Enabled

The selected first path is Wagmi + Viem with the Base Account connector first,
Coinbase Wallet connector second, and injected wallets later.

Decision: dependencies may stay installed, but wallet execution remains
disabled. No wallet prompt should open on page load or from Telegram.

### F7 - Signing State Model Is UI-Only

`src/types/walletSigning.ts` defines state transitions without importing wallet
provider dependencies or calling browser wallet APIs.

Decision: keep this state model as the boundary for future UI work. Provider
code must adapt to it, not bypass it.

### F8 - Review Surface Is Still Demo-Only

The home approval modal now shows signing-state context, but demo approval still
resets without creating `submitted`, `confirmed`, or `tx_hash` state.

Decision: this is acceptable as a UI-only bridge. Do not treat demo approval as
real wallet approval.

### F9 - Unsigned Handoff Is Typed But Not Wired

`src/types/unsignedTransactionHandoff.ts` defines the first browser-safe
unsigned transaction handoff contract. It requires Base chain id `8453`,
`connected_wallet` as gas payer, bounded expiry, valid target address, hex
calldata, and safe wei value formatting.

Decision: keep this as a local validator until wallet provider dependencies are
installed. The contract forbids private keys, seed phrases, Telegram tokens, raw
provider payloads, and `txHash` before submission.

### F10 - Rejection And Network Mismatch Are Sanitized

`src/types/walletSigning.ts` now defines wallet signing failure codes for user
rejection, Base network mismatch, unavailable providers, unsupported actions,
expired handoffs, and unknown provider failures.

Decision: provider-specific errors must collapse to sanitized copy. Failed
states before `submitted` must not carry a transaction hash.

### F11 - Owner Review Surface Shows Handoff Validation

`WalletApprovalModal` now displays the unsigned handoff status, chain, connected
wallet gas payer, expiry, value summary, and sanitized block reason if the
handoff is invalid.

Decision: keep this as demo review UI only. It must not open a wallet prompt,
display raw calldata as the primary UI, or persist a transaction hash.

## Phase 6C Entry Conditions

Do not implement live signing until:

- Phase 6B review packet is pushed and verified.
- Prepared-action storage SQL is approved, applied, and verified.
- A first signable action kind is selected separately from
  `base_mcp_status_check`.
- Wallet provider dependency is reviewed and installed behind a disabled gate.
- Chain/network mismatch behavior is defined.
- User rejection behavior is defined.
- Transaction state machine is defined.
- Unsigned handoff validation passes before provider integration.

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
- `npm run test:unsigned-handoff`
- `npm run build`
- targeted wallet handoff tests after provider code exists

## Current Recommendation

Do not implement live signing yet. The next safe step is a UI-only owner review
flow for unsigned handoff validation, then wallet provider dependency
installation behind a disabled gate after approval.
