# Robinhood Chain Mainnet Runbook

## Configuration

Frontend production:

- VITE_KYRA_CHAIN_RELEASE_TARGET=robinhood_mainnet
- VITE_KYRA_ROBINHOOD_MAINNET_WINDOW=owner_mainnet_cutover
- VITE_KYRA_ROBINHOOD_MAINNET_RELEASE=owner_release_approved
- controlled submission flags remain independently gated

Backend:

- KYRA_CHAIN_KEY=robinhood_mainnet
- KYRA_CHAIN_ID=4663
- KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED=true
- RPC URL and allowed hosts are backend-only secrets
- chain status and action preparation require a dedicated shared secret
- transaction-result-closeout requires an authenticated account JWT
- execution result writes are service-only; owners receive RLS-scoped read access

Netlify production builds with npm run build:robinhood-mainnet.

## Pre-Deploy

1. Run npm run check:product.
2. Run npm run build:robinhood-mainnet.
3. Apply and verify pending Supabase migrations.
4. Deploy only current Edge Functions, including transaction-result-closeout.
5. Verify execution_results migration, RLS policy, scope trigger, status constraint, and transaction-hash uniqueness.
6. Confirm legacy provider functions are absent.
7. Verify no raw secret pattern is committed.


## Smoke Test

- create or sign in to an account
- deploy a Robinhood agent
- open its public profile
- link Telegram and verify read-only reply
- connect and disconnect a compatible wallet
- verify provider identity and chain match
- prepare and review an action
- confirm Telegram and public execution remain blocked
- run one zero-value owner self-transfer before any value-bearing release
- wait for a confirmed receipt and the backend closeout status `saved`
- confirm owner-only receipt and support data remain private
- disable the submitter and verify rollback before recording release approval

## Rollback

Disable transaction submission flags first. Revoke active live windows, disconnect the wallet session, and keep read-only product capabilities online. Do not expose provider payloads or secrets in incident evidence.
