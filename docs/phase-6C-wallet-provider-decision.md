# Phase 6C Wallet Provider Decision

Decision date: 2026-06-15

Status: decision record only. No dependency is installed, no provider is wired,
and `walletExecution` remains disabled.

## Decision

Use `wagmi` with `viem` as the first wallet integration path, starting with a
Base-first connector set:

1. `baseAccount()` as the preferred Base-native connector.
2. `coinbaseWallet()` as a fallback connector.
3. `injected()` only after the first two paths are reviewed.

Do not use direct raw `window.ethereum` as the primary app integration.

## Why

- Wagmi is already React-oriented and documents wallet connection, chain,
  signing, and transaction hooks.
- Viem provides typed low-level Ethereum primitives and is the underlying stack
  Wagmi expects for blockchain operations.
- Wagmi has a `baseAccount` connector for the Base Account SDK and a
  `coinbaseWallet` connector.
- EIP-1193 remains the browser provider standard, but using it directly would
  push more wallet state, error handling, chain switching, and connector logic
  into Kyra code.

References:

- Wagmi getting started: https://wagmi.sh/react/getting-started
- Wagmi `baseAccount` connector: https://wagmi.sh/react/api/connectors/baseAccount
- Wagmi `coinbaseWallet` connector: https://wagmi.sh/react/api/connectors/coinbaseWallet
- Viem getting started: https://viem.sh/docs/getting-started
- EIP-1193 provider API: https://eips.ethereum.org/EIPS/eip-1193
- Base Account product overview: https://www.base.org/build/base-account

## Dependency Boundary

Do not install yet. The future install candidate is:

```powershell
npm install wagmi viem @tanstack/react-query @base-org/account
```

This install requires a separate approval because it changes bundle size,
browser wallet behavior, and user-facing consent flows.

## Required Runtime Gates

The first provider implementation must keep:

- `appConfig.integrations.walletExecution === "disabled"` until reviewed
- no automatic wallet prompt on page load
- no Telegram-triggered wallet prompt
- no signing call without explicit owner click
- no transaction submission before prepared-action storage is approved
- no `tx_hash` persistence until wallet submission returns a hash

## Rejected Options

### Direct EIP-1193 First

Rejected as the first integration path.

Reason: lower dependency count, but too much app-owned wallet state and error
handling for the first production wallet path.

### Ethers First

Rejected for now.

Reason: the app needs a React wallet connection layer and Base-specific
connector path before it needs a broad provider abstraction.

### Coinbase Wallet SDK Direct First

Deferred.

Reason: useful fallback, but Wagmi connector support lets Kyra keep provider
state and hooks in one integration boundary.

## Security Requirements

The provider path must never:

- request private keys
- request seed phrases
- store wallet secrets
- store raw provider errors
- submit from backend code
- trigger from Telegram
- trigger on page load
- sign `base_mcp_status_check`

## Implementation Sequence

1. Add UI-only wallet signing state types.
2. Add provider dependency only after approval.
3. Add `WagmiProvider` and `QueryClientProvider` behind a disabled wallet gate.
4. Add connection status read-only UI.
5. Add chain validation for Base.
6. Add explicit owner-click prompt flow.
7. Add sanitized rejection/error states.
8. Add submission and receipt tracking only after a real signable action exists.

## Test Criteria

- No provider dependency exists before install approval.
- Build passes with wallet execution disabled.
- Signed-out users cannot request a wallet prompt.
- Telegram cannot request a wallet prompt.
- Wrong network blocks signing.
- User rejection does not create a transaction hash.
- Provider errors are sanitized.
- Public pages never expose wallet internals.
