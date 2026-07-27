# Transaction Intent Prepare

Authenticated owner-only boundary for creating an immutable Robinhood Chain transaction intent before the wallet prompt opens.

The function validates the account session, workspace, deployed agent, Robinhood mainnet chain identity, allowlisted action kind, address and calldata shape, zero-value policy, freshness, and runtime gates. It writes the reviewed recipient, value, calldata, chain, owner, workspace, agent, and expiry once, then returns only the scoped identifier and sanitized review fields required by the browser flow.

## Safety Contract

- No private key, seed phrase, signature, signed payload, provider credential, Telegram token, or LLM secret is accepted.
- Telegram and public profiles cannot call this route.
- New intents are zero-value and no-calldata only in the current release lane.
- The database owns identity and scope; browser-authored owner or status claims are not trusted.
- Replays, stale requests, chain drift, agent drift, and malformed addresses fail closed.

## Deployment Order

1. Apply `20260726120000_transaction_intent_receipt_verification.sql`.
2. Run `20260726121000_verify_transaction_intent_receipt_verification.sql`.
3. Deploy this function and `transaction-result-closeout` together.
4. Run authenticated intent, expiry, scope-drift, and delayed-receipt smoke tests.
