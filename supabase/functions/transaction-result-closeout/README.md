# Kyra Transaction Result Closeout

Production status: active as the authenticated owner-only receipt-verification boundary.

The browser submits only scoped record identifiers and a transaction hash. The function reloads the immutable prepared intent, derives owner and action scope from the database, verifies Robinhood Chain mainnet identity, fetches the transaction and receipt from the backend RPC, compares hash, sender, recipient, value, calldata, and status, and persists sanitized terminal evidence.

## Safety Contract

- Browser-authored transaction status, failure code, wallet identity, and receipt details are ignored.
- RPC URL and allowed hosts remain backend-only and HTTPS-only.
- New closeouts require an unexpired stored intent.
- A previously accepted hash may finish after intent expiry only when owner, intent, and hash bindings still match exactly.
- Raw provider payloads, calldata copies, nonces, signatures, keys, seed phrases, Telegram tokens, and secret values are never persisted.
- Owners receive RLS-scoped reads; writes remain service-only.

## Idempotency And Failure Handling

The service derives its idempotency key from the authenticated owner, stored prepared action, and transaction hash. Repeated receipt checks update the same scoped result. Provider delay remains pending; scope drift, rejected receipts, malformed evidence, or unavailable verification fail closed.

The intent, verifier, RLS, and closeout migrations are synchronized in production. Submission stays disabled whenever receipt verification or backend RPC evidence is unavailable.
