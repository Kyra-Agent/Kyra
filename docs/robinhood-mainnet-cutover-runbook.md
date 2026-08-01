# Robinhood Chain Mainnet Runbook

> Historical original-cutover runbook. References to the fixed owner
> self-transfer describe the initial release evidence. The current T1 bounded
> transfer policy in the Transaction Expansion Roadmap supersedes those limits.

## Configuration

Frontend production:

- VITE_KYRA_CHAIN_RELEASE_TARGET=robinhood_mainnet
- VITE_KYRA_ROBINHOOD_MAINNET_WINDOW=owner_mainnet_cutover
- VITE_KYRA_ROBINHOOD_MAINNET_RELEASE=owner_release_approved
- VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=owner_approved_window
- VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=owner_low_value_window
- submission remains restricted to the fixed owner self-transfer policy

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
3. Confirm linked Supabase migration parity, including transaction-intent receipt binding and Telegram delivery retry state.
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
- prepare the backend-bound fixed `0.0001 ETH` owner self-transfer
- verify the recipient exactly matches the connected owner wallet and calldata is `0x`
- explicitly approve the one-time wallet prompt
- wait for a confirmed receipt and the backend closeout status `saved`
- confirm owner-only receipt and support data remain private
- disable the submitter and verify rollback before recording release approval

## Mainnet Evidence

Historical sanitized production evidence recorded on 2026-07-25:

- Robinhood Chain mainnet transaction confirmed by the connected wallet provider
- owner-controlled self-transfer with zero ETH value and no calldata
- provider transaction hash matched the Kyra owner dashboard result
- result monitoring reached `closed confirmed`
- one owner-only `execution_results` record was present in the production database
- Telegram and public-profile execution remained blocked
- transaction address and full hash are intentionally omitted from public documentation

At the original cutover, the value-bearing release was narrower than general wallet execution:

- exact value: `0.0001 ETH`
- recipient: the same connected owner wallet
- calldata: `0x`
- authenticated private dashboard and selected persisted agent only
- immutable backend policy version 2 intent with a 10-minute expiry
- one-time owner approval, receipt verification, and owner-only closeout
- swaps, token approvals, arbitrary transfers, Telegram execution, public-profile execution, and automation remain blocked

The owner dashboard reported backend closeout `saved`, and disconnect/reset
invalidated the live window without replay. The explicit owner-controlled release
decision is recorded. Telegram, public-profile, autonomous, token-approval,
arbitrary-calldata, and hidden-signing execution remain blocked.

## July 27 Hardening Closeout

The following migrations are applied and verified in the linked production database:

- `20260726120000_transaction_intent_receipt_verification.sql`
- `20260726121000_verify_transaction_intent_receipt_verification.sql`
- `20260726122000_telegram_delivery_retry.sql`
- `20260726123000_verify_telegram_delivery_retry.sql`

The updated transaction-intent, result-closeout, and Telegram webhook functions are active. The Robinhood mainnet frontend is published, and authenticated intent, delayed-receipt, Telegram retry, privacy, and rollback checks pass. The production state was reconfirmed on 2026-07-28.

## Rollback

Disable transaction submission flags first. Revoke active live windows, disconnect the wallet session, and keep read-only product capabilities online. Do not expose provider payloads or secrets in incident evidence.
