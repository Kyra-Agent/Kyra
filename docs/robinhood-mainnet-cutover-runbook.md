# Robinhood Chain Mainnet Cutover Runbook

Date: 2026-07-24

Status: software hardening is committed and the managed mainnet provider has
passed an authenticated read-only chain-ID check. Public production remains on
Base. Robinhood Chain transactions stay blocked until every owner and
infrastructure gate in this runbook passes.

## Verified Network Contract

The official Robinhood Chain documentation was checked on 2026-07-24:

- chain ID: `4663` (`0x1237`)
- native gas token: ETH
- explorer: `https://robinhoodchain.blockscout.com`
- public RPC: `https://rpc.mainnet.chain.robinhood.com`
- production providers: Alchemy is recommended; QuickNode, Blockdaemon, dRPC,
  and Validation Cloud are also documented options
- compatible wallets: Robinhood Wallet and EVM browser wallets such as MetaMask

Sources:

- https://docs.robinhood.com/chain/connecting/
- https://docs.robinhood.com/chain/add-network-to-wallet/
- https://status.robinhoodchain.offchain.io/

Public RPC is not a production provider. It is rate-limited and may only support
bounded browser-side wallet reads. Kyra backend capability checks require a
Kyra-owned managed provider endpoint stored as a Supabase secret.

## Release Boundary

Default builds remain on Base. A Robinhood mainnet frontend build is selected
only when all four public release markers match:

- Vite mode: `robinhood-mainnet`
- `VITE_KYRA_CHAIN_RELEASE_TARGET=robinhood_mainnet`
- `VITE_KYRA_ROBINHOOD_MAINNET_WINDOW=owner_mainnet_cutover`
- `VITE_KYRA_ROBINHOOD_MAINNET_RELEASE=owner_release_approved`

These markers are release assertions, not security secrets. Backend provider,
deploy, ownership, chain, rate-limit, and transaction gates remain authoritative.
A partial or mistyped frontend configuration falls back to Base.

## Secret Boundary

Configure values through Supabase secrets. Do not write values into the repo,
Netlify public variables, screenshots, logs, chat, or documentation.

Required backend names for the controlled window:

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

No wallet private key, Telegram token, provider key, wallet address, or transaction hash
belongs in repository evidence. Wallet connection stays in browser memory and
every transaction requires the connected owner wallet confirmation.

## Cutover Gates

### Automated

- `npm run check:robinhood-migration`
- `npm run check:phase-8-all`
- `npm run check:privacy`
- `npm audit --audit-level=high`
- `npm run build`
- a mainnet-mode build with all release markers
- secret scan and `git diff --check`

### Owner And Infrastructure

- Kyra-owned managed production RPC created and stored only in Supabase
- read-only mainnet capability check succeeds with exact chain ID `4663`
- desktop and mobile wallet connection verified
- one deployed agent is bound to `robinhood_mainnet`
- one frozen zero-value or explicitly bounded low-value action is reviewed
- NYX-05 risk review and owner approval are recorded
- owner explicitly approves the controlled mainnet window
- wallet confirms the exact reviewed action
- receipt reaches confirmed status and owner-only closeout is sanitized
- emergency disable and last-known-good Base rollback are exercised

## Controlled Sequence

1. Keep Netlify on `npm run build` and Base while provider checks are prepared.
2. Configure the managed RPC secrets with provider and hostname allowlists.
3. Enable read-only chain status and action preparation; verify chain/account
   drift fails closed.
4. Build a Robinhood mainnet preview using `npm run build:robinhood-mainnet`
   with all release markers, while submission flags remain disabled.
5. Verify signed-out privacy, owner sign-in, desktop/mobile wallet connection,
   selected mainnet agent binding, and receipt monitoring.
6. Freeze one reviewed action, record explicit owner release approval, and open
   only the controlled submission flags for that window.
7. Confirm the action in the owner wallet, monitor the receipt, and save only a
   sanitized pass/fail closeout.
8. Change the production build command and public chain copy atomically only
   after the controlled receipt passes.
9. Monitor provider, frontend, Supabase, Telegram read-only behavior, and wallet
   failure rates through the rollback window.

## Rollback

If provider health, chain binding, wallet behavior, receipt monitoring, privacy,
or policy checks fail:

1. Set submission and low-value runtime flags to disabled.
2. Set `KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED=false`.
3. Disable chain action preparation and chain status provider gates.
4. Restore Netlify to the last known-good Base build.
5. Keep Telegram and public agents read-only.
6. Rotate affected provider credentials and preserve sanitized failure evidence.
7. Re-run all automated gates before requesting another owner window.

## Live Configuration Audit

Checked on 2026-07-24 without reading or exporting secret values:

- Netlify still uses the normal Base build and has no Robinhood mainnet release markers
- scoped Robinhood mainnet RPC URL and hostname allowlist exist in Supabase; values were not read or exported
- deployed chain-status-provider returned exact chain ID 4663 in authenticated read-only mode
- KYRA_CHAIN_ACTION_PREPARE_ENABLED=false
- KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED=true (agent deployment only; no signing or submission)
- no accidental mainnet transaction gate or public cutover is active

## Current Decision

Software and read-only provider readiness: verified.

Release decision: blocked pending owner desktop/mobile verification, explicit
mainnet approval, one controlled mainnet receipt, and rollback exercise.
Robinhood Chain must not be advertised as Kyra's live transaction lane before
those gates pass.
