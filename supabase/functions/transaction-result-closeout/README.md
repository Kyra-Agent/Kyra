# Transaction Result Closeout

Authenticated owner-only boundary for verifying a Robinhood Chain submission and persisting sanitized terminal evidence.

The browser sends only the workspace ID, deployed agent ID, prepared-action ID, and transaction hash. The function reloads the immutable prepared action, derives owner and intent scope from the database, verifies Robinhood mainnet chain identity, fetches the transaction and receipt through the backend RPC, compares hash/from/to/value/calldata/status, and writes a sanitized result.

## Safety Contract

- Browser-authored transaction status, failure code, wallet identity, and receipt details are ignored.
- RPC URL and allowed hosts are backend-only secrets and must use HTTPS.
- New closeouts require an unexpired stored intent.
- A previously accepted hash can finish after intent expiry only when the existing owner, intent, and hash binding matches exactly.
- Raw provider payloads, calldata copies, nonces, signatures, private keys, seed phrases, Telegram tokens, and secret values are not persisted.
- Owners receive scoped result reads; writes remain service-only.

## Idempotency

The service derives its idempotency key from the authenticated owner, stored prepared action, and transaction hash. Repeated receipt checks update the same scoped result instead of creating duplicates.

## Deployment Order

Deploy only after the transaction-intent migration and verifier pass. Keep runtime submission fail-closed if receipt verification, RLS, scope triggers, or the backend RPC is unavailable.
