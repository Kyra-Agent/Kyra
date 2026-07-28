# Kyra Transaction Intent Prepare

Production status: active as the authenticated owner-only immutable intent boundary.

Before a wallet prompt can open, the function validates the account session, workspace, selected deployed agent, Robinhood Chain mainnet identity, allowlisted action, recipient, value, calldata shape, freshness, and runtime gates. It persists the reviewed owner, workspace, agent, chain, recipient, value, calldata, and expiry binding once, then returns only the scoped identifier and sanitized review fields required by the browser.

## Safety Contract

- Telegram and public profiles cannot call this route.
- Private keys, seed phrases, signatures, signed payloads, provider credentials, Telegram tokens, and LLM secrets are rejected.
- The current release lane accepts one exact 0.0001 ETH, no-calldata owner self-transfer intent only.
- Browser-authored owner, scope, status, and receipt claims are not trusted.
- Replays, stale requests, chain drift, agent drift, scope drift, and malformed addresses fail closed.
- Database triggers and RLS independently preserve owner and agent scope.

The intent and verifier migrations are synchronized in production, and this function is deployed with transaction result closeout. Runtime submission remains independently gated per transaction.
