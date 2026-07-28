# Kyra Chain Action Prepare

Production status: active, authenticated, and runtime-gated.

This Edge Function creates an owner-scoped, read-only chain-status prepared action. The current allowlist contains `chain_status_check`. It binds the authenticated account, workspace, persisted agent, reviewed chain key and chain ID, request freshness, persistent rate limit, exact provider result, and sanitized owner-only prepared-action record.

## Security Contract

- Telegram and public profiles cannot invoke this route.
- The function accepts no recipient, token amount, calldata, approval, wallet address, signature, signed payload, private key, seed phrase, Telegram token, transaction hash, or raw provider error.
- Runtime enablement, provider endpoint, endpoint hostname, shared secret, protocol, chain key, and chain ID must pass exact validation.
- Missing ownership, stale requests, rate-limit failures, chain drift, provider drift, or malformed results fail closed.
- Responses contain bounded status data only.

Deployment does not imply transaction authority. This function prepares read-only evidence and never signs or submits.
