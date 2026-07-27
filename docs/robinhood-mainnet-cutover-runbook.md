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
- transaction-intent-prepare and transaction-result-closeout require an authenticated account JWT
- prepared intents and execution result writes are service-only; owners receive RLS-scoped read access

Netlify production builds with npm run build:robinhood-mainnet.

## Pre-Deploy

1. Run npm run check:product.
2. Run npm run build:robinhood-mainnet.
3. Apply and verify pending Supabase migrations, including transaction-intent receipt binding and Telegram delivery retry state.
4. Deploy only current Edge Functions, including transaction-intent-prepare, transaction-result-closeout, and telegram-webhook.
5. Verify prepared-action foreign keys, execution-result receipt fields, RLS policies, scope triggers, status constraints, and transaction-hash uniqueness.
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

## Mainnet Evidence

Sanitized production evidence recorded on 2026-07-25:

- Robinhood Chain mainnet transaction confirmed by the connected wallet provider
- owner-controlled self-transfer with zero ETH value and no calldata
- provider transaction hash matched the Kyra owner dashboard result
- result monitoring reached `closed confirmed`
- one owner-only `execution_results` record was present in the production database
- Telegram and public-profile execution remained blocked
- transaction address and full hash are intentionally omitted from public documentation

The owner dashboard reported backend closeout `saved`, and disconnect/reset
invalidated the live window without replay. The explicit owner-controlled release
decision is recorded. Telegram, public-profile, autonomous, token-approval,
arbitrary-calldata, and hidden-signing execution remain blocked.

## July 27 Hardening Release Candidate

Before this batch is called live, apply and verify these migrations in order:

- `20260726120000_transaction_intent_receipt_verification.sql`
- `20260726121000_verify_transaction_intent_receipt_verification.sql`
- `20260726122000_telegram_delivery_retry.sql`
- `20260726123000_verify_telegram_delivery_retry.sql`

Then deploy the updated transaction-intent, result-closeout, and Telegram webhook functions, publish the Robinhood mainnet frontend build, and rerun authenticated intent, delayed-receipt, Telegram retry, privacy, and rollback smoke tests.
## Rollback

Disable transaction submission flags first. Revoke active live windows, disconnect the wallet session, and keep read-only product capabilities online. Do not expose provider payloads or secrets in incident evidence.
