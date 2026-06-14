# Phase 6C Wallet Signing Handoff Plan

Phase 6C goal: define and implement the first user-initiated wallet signing
handoff without custody, hidden execution, or Telegram bypass.

Status: plan only. No live signing is enabled.

## Source Audit

Audit artifact:

- `docs/phase-6C-wallet-signing-handoff-audit.md`

Required predecessor:

- `docs/phase-6B-review-packet.md`

## Product Rule

Kyra may prepare context, but the user's wallet makes the final signing and
submission decision.

Kyra must never:

- hold a private key
- ask for a seed phrase
- sign in backend code
- submit a transaction from Telegram
- hide transaction details from the owner

## Implementation Order

1. Wallet provider decision record
   - choose first provider path
   - document dependency and security tradeoffs
   - confirm Base chain support

2. UI-only signing state model
   - add explicit states without provider dependency
   - keep `walletExecution` disabled
   - keep demo modal separate from real signing labels

3. Owner review surface
   - show action kind, route, chain, value summary, risk, expiry
   - show wallet/network readiness
   - show reject/cancel before wallet prompt

4. Prepared action storage activation
   - only after SQL apply approval
   - only after verifier passes
   - storage remains owner-scoped

5. Provider integration behind a disabled gate
   - no Telegram path
   - no automatic prompt on page load
   - prompt only after explicit owner click

6. Submission/result tracking
   - store `tx_hash` only after wallet submission returns a hash
   - store sanitized failures
   - keep public profiles share-safe

## First Signable Candidate Requirements

The first signable action must not be `base_mcp_status_check`.

It must have:

- reviewed action kind
- owner-scoped prepared action record
- bounded unsigned transaction summary
- chain id
- target/route summary
- spend/value summary
- expiry
- risk classification
- reject path
- user-initiated wallet prompt

## State Model Draft

```ts
type WalletSigningState =
  | "not_ready"
  | "preview_ready"
  | "review_required"
  | "wallet_prompt_requested"
  | "wallet_prompt_opened"
  | "user_rejected"
  | "submitted"
  | "failed"
  | "confirmed";
```

Rules:

- `wallet_prompt_requested` requires an owner click.
- `submitted` requires a wallet submission hash.
- `confirmed` requires confirmation data, not just a local optimistic update.
- `failed` stores a sanitized reason only.

## Test Targets

- Signed-out user cannot request wallet prompt.
- Wrong owner cannot view or approve another prepared action.
- Owner can reject without wallet prompt.
- Unsupported action kind fails closed.
- Wrong chain/network blocks signing.
- User rejection does not create `tx_hash`.
- Provider error is sanitized.
- Telegram execution request remains refused.
- Public profile does not expose prepared action internals.

## Exit Criteria

Phase 6C is ready for implementation only when:

- wallet provider path is chosen
- state model is typed
- owner review UI copy is clear
- prepared-action SQL path is approved or explicitly mocked
- no Telegram bypass exists
- no private material can enter app state
