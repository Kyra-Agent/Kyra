# Robinhood Chain Mainnet Cutover Runbook

Date: 2026-07-24

Status: public Robinhood Chain product cutover candidate. Managed mainnet read-only access, exact chain binding, normal user agent deployment, and desktop wallet connect/disconnect are verified. Public transaction submission remains disabled pending one bounded receipt and rollback exercise.

## Verified Network Contract

Official Robinhood Chain sources were checked on 2026-07-24:

- chain ID: `4663` (`0x1237`)
- native gas token: ETH
- explorer: `https://robinhoodchain.blockscout.com`
- public RPC: `https://rpc.mainnet.chain.robinhood.com`
- compatible clients: standard EVM wallets and Wagmi/Viem tooling
- production provider policy: managed backend endpoint, not a public browser credential

Sources:

- https://docs.robinhood.com/chain/connecting/
- https://docs.robinhood.com/chain/add-network-to-wallet/
- https://status.robinhoodchain.offchain.io/

Public RPC is not Kyra's production transaction provider. Backend capability checks use a managed endpoint stored as a Supabase secret. The provider supplies chain access only; it has no wallet authority.

## Public Release Boundary

Netlify production uses `npm run build:robinhood-mainnet`. The runtime selects Robinhood Chain only when all release assertions agree:

- Vite mode: `robinhood-mainnet`
- `VITE_KYRA_CHAIN_RELEASE_TARGET=robinhood_mainnet`
- `VITE_KYRA_ROBINHOOD_MAINNET_WINDOW=owner_mainnet_cutover`
- `VITE_KYRA_ROBINHOOD_MAINNET_RELEASE=owner_release_approved`

These are public build assertions, not secrets. Backend ownership, chain, provider, rate-limit, action, and submission gates remain authoritative.

The first public cutover keeps both transaction flags disabled:

- `VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=disabled`
- `VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=disabled`

This allows Robinhood Chain agent deployment, wallet connectivity, and action review without opening transaction submission.

## Secret Boundary

Required backend values are configured through Supabase secrets only:

- `KYRA_CHAIN_STATUS_PROVIDER_ENABLED`
- `KYRA_CHAIN_PROVIDER_SHARED_SECRET`
- `KYRA_CHAIN_RPC_PROVIDER=managed_private`
- `KYRA_ROBINHOOD_MAINNET_RPC_URL`
- `KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS`
- `KYRA_CHAIN_KEY=robinhood_mainnet`
- `KYRA_CHAIN_ID=4663`
- `KYRA_CHAIN_ACTION_PREPARE_ENABLED`
- `KYRA_CHAIN_STATUS_ENDPOINT`
- `KYRA_CHAIN_STATUS_ENDPOINT_HOST`
- `KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED`

Never put RPC credentials, wallet keys, Telegram tokens, wallet addresses, transaction hashes, or raw provider responses in repository evidence, Netlify public variables, screenshots, logs, chat, or documentation.

## Verified Gates

- full Robinhood Chain Testnet workflow completed
- managed mainnet provider returned exact chain ID `4663`
- hostname allowlist and HTTPS provider validation are active
- mainnet agent deployment is enabled with exact chain binding
- normal user-account mainnet agent deployment passed
- desktop EVM wallet connect/disconnect passed
- Telegram and public profiles remain unable to sign or submit
- signed-out dashboard hides private operational state
- transaction submission remains fail-closed

## Remaining Transaction Gate

Before calling mainnet transaction execution live:

- verify the intended wallet path on supported desktop and mobile clients
- select a deployed `robinhood_mainnet` agent
- freeze one zero-value or explicitly bounded low-value action
- complete deterministic policy and NYX-05 risk review
- record explicit Kyra approval
- open one controlled transaction window
- confirm the exact action in the user wallet
- observe a confirmed receipt
- save only a sanitized private closeout
- exercise emergency disable and legacy rollback

## Controlled Sequence

1. Deploy the Robinhood Chain product build with transaction flags disabled.
2. Verify signed-out privacy, user sign-in, agent selection, public profile, Telegram read-only behavior, and wallet connect/disconnect.
3. Keep provider and deployment health under observation.
4. Freeze one bounded action and complete policy and NYX-05 review.
5. Open only the single controlled submission window after explicit approval.
6. Confirm in the user wallet and monitor the receipt.
7. Record sanitized pass/fail closeout and immediately close the window.
8. Exercise emergency disable and rollback before wider eligibility is considered.

## Rollback

If provider health, chain binding, wallet behavior, receipt monitoring, privacy, or policy checks fail:

1. Keep submission and low-value runtime flags disabled.
2. Set `KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED=false` if deployment scope is affected.
3. Disable chain preparation or provider gates if backend scope is affected.
4. Restore the last known-good release target.
5. Keep Telegram and public profiles read-only.
6. Rotate affected credentials and preserve sanitized failure evidence.
7. Re-run every automated gate before requesting another controlled window.

## Required Automated Checks

- `npm run check:robinhood-migration`
- `npm run check:phase-8-all`
- `npm run check:privacy`
- `npm run check:robinhood-public-cutover`
- `npm audit --audit-level=high`
- `npm run build:robinhood-mainnet`
- `git diff --check`
- secret scan

## Live Configuration Audit

Checked on 2026-07-24 without reading or exporting secret values:

- Netlify identity, Supabase project, and GitHub remote are Kyra-owned
- scoped mainnet RPC URL and hostname allowlist exist in Supabase
- deployed chain-status provider returned exact chain ID `4663`
- `KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED=true` for exact-chain agent deployment
- `KYRA_CHAIN_ACTION_PREPARE_ENABLED=false` at the last backend audit
- public transaction submission remains disabled for the first cutover deploy

## Current Decision

Robinhood Chain public product positioning, normal user agent deployment, wallet connectivity, and approval-first action review: release candidate.

Mainnet transaction execution: controlled and not yet a public live claim. It remains blocked until a bounded receipt and rollback exercise complete successfully.

Kyra is independent and must not imply affiliation with, sponsorship by, or endorsement from Robinhood.
